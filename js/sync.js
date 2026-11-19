/**
 * Đồng bộ tiến độ học tập giữa nhiều thiết bị (Laptop <-> Điện thoại):
 * 1) Tự động đồng bộ 2 chiều qua GitHub Secret Gist (miễn phí, dùng token quyền gist).
 * 2) Hợp nhất thông minh (Smart Merge) từng từ theo updatedAt, streak history và lịch sử kiểm tra.
 * 3) Mã / Link chuyển nhanh không cần token (nén gzip + base64url).
 */

import { addDaysIso, normalizeSrsState } from "./srs.js";
import {
  STORAGE_KEYS,
  applyMergedData,
  exportProgressPayload,
  getSyncConfig,
  getTodayIso,
  onProgressChange,
  updateSyncConfig,
} from "./store.js";

export const GIST_FILENAME = "vocab-app-sync.json";
const GIST_API_BASE = "https://api.github.com/gists";

const statusListeners = new Set();
let autoSyncInitialized = false;
let debounceTimer = null;
let inFlightSync = null;
let lastVisibilitySyncAt = 0;

export function onSyncStatusChange(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function notifySyncStatus(statusObj) {
  for (const listener of statusListeners) {
    try {
      listener(statusObj);
    } catch {
      // ignore subscriber errors
    }
  }
}

function extractParts(payload) {
  const source = payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
  const rawSrs =
    source[STORAGE_KEYS.SRS] && typeof source[STORAGE_KEYS.SRS] === "object"
      ? source[STORAGE_KEYS.SRS]
      : {};
  const rawStreak =
    source[STORAGE_KEYS.STREAK] && typeof source[STORAGE_KEYS.STREAK] === "object"
      ? source[STORAGE_KEYS.STREAK]
      : {};
  const rawTests = Array.isArray(source[STORAGE_KEYS.TESTS]) ? source[STORAGE_KEYS.TESTS] : [];
  return { rawSrs, rawStreak, rawTests };
}

function pickNewerSrs(a, b) {
  const ua = Number(a.updatedAt || 0);
  const ub = Number(b.updatedAt || 0);
  if (ua > 0 && ub > 0 && ua !== ub) {
    return ua > ub ? a : b;
  }
  if (ua > 0 && ub === 0) return a;
  if (ub > 0 && ua === 0) return b;
  if (a.box !== b.box) return a.box > b.box ? a : b;
  if (a.interval !== b.interval) return a.interval > b.interval ? a : b;
  if (a.due !== b.due) {
    if (!a.due) return b;
    if (!b.due) return a;
    return a.due > b.due ? a : b;
  }
  return a.lapses >= b.lapses ? a : b;
}

export function computeStreakCount(history, lastDate) {
  if (!lastDate || !history || typeof history !== "object") return 0;
  let count = 0;
  let cursor = lastDate;
  while (Number(history[cursor] || 0) > 0) {
    count += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return count;
}

/**
 * Gộp thông minh 2 bản sao tiến độ (không ghi đè mất dữ liệu giữa laptop và điện thoại).
 */
export function mergeProgressPayloads(localPayload, remotePayload) {
  const local = extractParts(localPayload);
  const remote = extractParts(remotePayload);

  // 1. Gộp SRS từng từ
  const mergedSrs = {};
  const allWordIds = new Set([...Object.keys(local.rawSrs), ...Object.keys(remote.rawSrs)]);
  for (const wordId of allWordIds) {
    const hasLocal = Boolean(local.rawSrs[wordId] && typeof local.rawSrs[wordId] === "object");
    const hasRemote = Boolean(remote.rawSrs[wordId] && typeof remote.rawSrs[wordId] === "object");
    if (hasLocal && hasRemote) {
      mergedSrs[wordId] = pickNewerSrs(
        normalizeSrsState(local.rawSrs[wordId]),
        normalizeSrsState(remote.rawSrs[wordId])
      );
    } else if (hasLocal) {
      mergedSrs[wordId] = normalizeSrsState(local.rawSrs[wordId]);
    } else if (hasRemote) {
      mergedSrs[wordId] = normalizeSrsState(remote.rawSrs[wordId]);
    }
  }

  // 2. Gộp lịch sử & streak
  const mergedHistory = {};
  const localHist =
    local.rawStreak.history && typeof local.rawStreak.history === "object"
      ? local.rawStreak.history
      : {};
  const remoteHist =
    remote.rawStreak.history && typeof remote.rawStreak.history === "object"
      ? remote.rawStreak.history
      : {};
  const allDates = new Set([...Object.keys(localHist), ...Object.keys(remoteHist)]);
  for (const dateIso of allDates) {
    const val = Math.max(0, Number(localHist[dateIso] || 0), Number(remoteHist[dateIso] || 0));
    if (val > 0) mergedHistory[dateIso] = val;
  }

  const candidateDates = [
    ...Object.keys(mergedHistory),
    typeof local.rawStreak.lastDate === "string" ? local.rawStreak.lastDate : "",
    typeof remote.rawStreak.lastDate === "string" ? remote.rawStreak.lastDate : "",
  ].filter(Boolean);
  candidateDates.sort();
  const lastDate = candidateDates.length ? candidateDates[candidateDates.length - 1] : null;

  const computedCount = computeStreakCount(mergedHistory, lastDate);
  const fallbackCount =
    Object.keys(mergedHistory).length === 0
      ? Math.max(Number(local.rawStreak.count || 0), Number(remote.rawStreak.count || 0))
      : 0;
  const mergedStreak = {
    count: Math.max(computedCount, fallbackCount),
    lastDate,
    history: mergedHistory,
  };

  // 3. Gộp lịch sử kiểm tra (khử trùng lặp, mới nhất lên đầu, tối đa 50)
  const testMap = new Map();
  for (const item of [...local.rawTests, ...remote.rawTests]) {
    if (!item || typeof item !== "object") continue;
    const key =
      item.id || `${item.dateIso || ""}|${item.targetKey || ""}|${item.score ?? ""}|${item.total ?? ""}`;
    if (!testMap.has(key)) {
      testMap.set(key, item);
    }
  }
  const mergedTests = Array.from(testMap.values())
    .sort((a, b) => {
      const da = String(a.dateIso || "");
      const db = String(b.dateIso || "");
      if (da !== db) return db.localeCompare(da);
      return String(b.id || "").localeCompare(String(a.id || ""));
    })
    .slice(0, 50);

  return {
    app: "vocab-app",
    version: 1,
    exportedAt: getTodayIso(),
    data: {
      [STORAGE_KEYS.SRS]: mergedSrs,
      [STORAGE_KEYS.STREAK]: mergedStreak,
      [STORAGE_KEYS.TESTS]: mergedTests,
    },
  };
}

function gistHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function formatHttpError(status) {
  if (status === 401 || status === 403) {
    return "Token GitHub không hợp lệ hoặc thiếu quyền gist (HTTP " + status + ").";
  }
  if (status === 404) {
    return "Không tìm thấy Gist đồng bộ (HTTP 404).";
  }
  return "Lỗi kết nối GitHub Gist (HTTP " + status + ").";
}

export async function findExistingSyncGist(token, fetchImpl = fetch) {
  const res = await fetchImpl(`${GIST_API_BASE}?per_page=30`, {
    method: "GET",
    headers: gistHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(formatHttpError(res.status));
  }
  const list = await res.json();
  if (!Array.isArray(list)) return null;
  return list.find((g) => g?.files && Object.prototype.hasOwnProperty.call(g.files, GIST_FILENAME)) || null;
}

async function createSyncGist(token, payload, fetchImpl) {
  const res = await fetchImpl(GIST_API_BASE, {
    method: "POST",
    headers: gistHeaders(token),
    body: JSON.stringify({
      description: "Vocab A1-A2 Sync Progress",
      public: false,
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(payload, null, 2),
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(formatHttpError(res.status));
  }
  return res.json();
}

async function patchSyncGist(token, gistId, payload, fetchImpl) {
  const res = await fetchImpl(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`, {
    method: "PATCH",
    headers: gistHeaders(token),
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: {
          content: JSON.stringify(payload, null, 2),
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(formatHttpError(res.status));
  }
  return res.json();
}

export async function syncWithGist({ forcePushOnly = false, fetchImpl = fetch } = {}) {
  if (inFlightSync && fetchImpl === fetch) {
    return inFlightSync;
  }

  const run = async () => {
    const cfg = getSyncConfig();
    const token = (cfg.token || "").trim();
    if (!token) {
      return { ok: false, error: "Chưa nhập GitHub Token." };
    }

    updateSyncConfig({ lastStatus: "syncing", lastError: "" });
    notifySyncStatus({ status: "syncing", error: "", dataChanged: false });

    try {
      let gistId = (cfg.gistId || "").trim();
      const localPayload = exportProgressPayload();

      if (!gistId) {
        if (!forcePushOnly) {
          const existing = await findExistingSyncGist(token, fetchImpl);
          if (existing?.id) {
            gistId = existing.id;
          }
        }
        if (!gistId) {
          const created = await createSyncGist(token, localPayload, fetchImpl);
          const nowIso = new Date().toISOString();
          updateSyncConfig({
            gistId: created.id,
            lastSyncAt: nowIso,
            lastStatus: "synced",
            lastError: "",
          });
          notifySyncStatus({ status: "synced", lastSyncAt: nowIso, dataChanged: false });
          return {
            ok: true,
            created: true,
            gistId: created.id,
            wordCount: Object.keys(localPayload.data[STORAGE_KEYS.SRS]).length,
            testCount: localPayload.data[STORAGE_KEYS.TESTS].length,
            dataChanged: false,
          };
        }
      }

      if (forcePushOnly) {
        await patchSyncGist(token, gistId, localPayload, fetchImpl);
        const nowIso = new Date().toISOString();
        updateSyncConfig({
          gistId,
          lastSyncAt: nowIso,
          lastStatus: "synced",
          lastError: "",
        });
        notifySyncStatus({ status: "synced", lastSyncAt: nowIso, dataChanged: false });
        return {
          ok: true,
          gistId,
          wordCount: 0,
          testCount: 0,
          dataChanged: false,
        };
      }

      const getRes = await fetchImpl(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`, {
        method: "GET",
        headers: gistHeaders(token),
        cache: "no-store",
      });

      if (getRes.status === 404) {
        const recreated = await createSyncGist(token, localPayload, fetchImpl);
        const nowIso = new Date().toISOString();
        updateSyncConfig({
          gistId: recreated.id,
          lastSyncAt: nowIso,
          lastStatus: "synced",
          lastError: "",
        });
        notifySyncStatus({ status: "synced", lastSyncAt: nowIso, dataChanged: false });
        return {
          ok: true,
          created: true,
          gistId: recreated.id,
          wordCount: Object.keys(localPayload.data[STORAGE_KEYS.SRS]).length,
          testCount: localPayload.data[STORAGE_KEYS.TESTS].length,
          dataChanged: false,
        };
      }

      if (!getRes.ok) {
        throw new Error(formatHttpError(getRes.status));
      }

      const gistJson = await getRes.json();
      const fileEntry = gistJson?.files?.[GIST_FILENAME];
      let remotePayload = null;
      if (fileEntry) {
        let rawText = fileEntry.content || "";
        if (fileEntry.truncated && fileEntry.raw_url) {
          const rawRes = await fetchImpl(fileEntry.raw_url, { cache: "no-store" });
          if (rawRes.ok) {
            rawText = await rawRes.text();
          }
        }
        if (rawText.trim()) {
          remotePayload = JSON.parse(rawText);
        }
      }

      const merged = remotePayload
        ? mergeProgressPayloads(localPayload, remotePayload)
        : localPayload;

      const beforeSig = JSON.stringify({
        srs: localPayload.data[STORAGE_KEYS.SRS],
        streak: localPayload.data[STORAGE_KEYS.STREAK],
        tests: localPayload.data[STORAGE_KEYS.TESTS],
      });
      const afterSig = JSON.stringify({
        srs: merged.data[STORAGE_KEYS.SRS],
        streak: merged.data[STORAGE_KEYS.STREAK],
        tests: merged.data[STORAGE_KEYS.TESTS],
      });
      const dataChanged = beforeSig !== afterSig;

      applyMergedData(merged.data);

      const remoteSig = remotePayload
        ? JSON.stringify({
            srs: extractParts(remotePayload).rawSrs,
            streak: extractParts(remotePayload).rawStreak,
            tests: extractParts(remotePayload).rawTests,
          })
        : "";
      if (!remotePayload || remoteSig !== afterSig) {
        await patchSyncGist(token, gistId, merged, fetchImpl);
      }

      const nowIso = new Date().toISOString();
      updateSyncConfig({
        gistId,
        lastSyncAt: nowIso,
        lastStatus: "synced",
        lastError: "",
      });
      notifySyncStatus({ status: "synced", lastSyncAt: nowIso, dataChanged });

      return {
        ok: true,
        gistId,
        wordCount: Object.keys(merged.data[STORAGE_KEYS.SRS]).length,
        testCount: merged.data[STORAGE_KEYS.TESTS].length,
        dataChanged,
      };
    } catch (err) {
      const msg = err?.message || "Đồng bộ thất bại.";
      updateSyncConfig({ lastStatus: "error", lastError: msg });
      notifySyncStatus({ status: "error", error: msg, dataChanged: false });
      return { ok: false, error: msg };
    }
  };

  if (fetchImpl === fetch) {
    inFlightSync = run().finally(() => {
      inFlightSync = null;
    });
    return inFlightSync;
  }
  return run();
}

export function initAutoSync() {
  if (autoSyncInitialized) return;
  autoSyncInitialized = true;

  onProgressChange((reason) => {
    const cfg = getSyncConfig();
    if (!cfg.token || !cfg.autoSync) return;
    if (reason === "reset") {
      if (debounceTimer) clearTimeout(debounceTimer);
      syncWithGist({ forcePushOnly: true });
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncWithGist();
    }, 2000);
  });

  const initialCfg = getSyncConfig();
  if (initialCfg.token && initialCfg.autoSync) {
    lastVisibilitySyncAt = Date.now();
    syncWithGist();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const cfg = getSyncConfig();
      if (!cfg.token || !cfg.autoSync) return;
      if (Date.now() - lastVisibilitySyncAt < 30000) return;
      lastVisibilitySyncAt = Date.now();
      syncWithGist();
    });
  }
}

// --- Quick Transfer Code & Quick Setup Link Helpers ---

function bytesToBase64Url(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(b64u) {
  const padded = b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function compressUtf8(text) {
  const rawBytes = new TextEncoder().encode(text);
  if (typeof CompressionStream === "undefined") {
    return { prefix: "V1.u.", bytes: rawBytes };
  }
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(rawBytes);
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return { prefix: "V1.z.", bytes: new Uint8Array(buf) };
}

async function decompressBytes(prefix, bytes) {
  if (prefix === "V1.u.") {
    return new TextDecoder().decode(bytes);
  }
  if (prefix === "V1.z.") {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("Trình duyệt không hỗ trợ giải nén mã đồng bộ.");
    }
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder().decode(buf);
  }
  throw new Error("Mã đồng bộ không hợp lệ.");
}

function compactPayload(payload) {
  const { rawSrs, rawStreak, rawTests } = extractParts(payload);
  const s = {};
  for (const [id, entry] of Object.entries(rawSrs)) {
    const n = normalizeSrsState(entry);
    s[id] = [n.box, n.ease, n.interval, n.due, n.lapses, n.updatedAt || 0];
  }
  return {
    v: 1,
    s,
    k: {
      c: Number(rawStreak.count || 0),
      d: rawStreak.lastDate || null,
      h: rawStreak.history || {},
    },
    t: rawTests.slice(0, 50),
  };
}

function expandCompactPayload(obj) {
  if (!obj || typeof obj !== "object" || obj.v !== 1 || !obj.s || typeof obj.s !== "object") {
    throw new Error("Dữ liệu mã đồng bộ không đúng định dạng.");
  }
  const srs = {};
  for (const [id, arr] of Object.entries(obj.s)) {
    if (!Array.isArray(arr)) continue;
    srs[id] = normalizeSrsState({
      box: arr[0],
      ease: arr[1],
      interval: arr[2],
      due: arr[3],
      lapses: arr[4],
      updatedAt: arr[5] || undefined,
    });
  }
  const streak = {
    count: Number(obj.k?.c || 0),
    lastDate: typeof obj.k?.d === "string" ? obj.k.d : null,
    history: obj.k?.h && typeof obj.k.h === "object" ? obj.k.h : {},
  };
  const tests = Array.isArray(obj.t) ? obj.t.slice(0, 50) : [];
  return {
    app: "vocab-app",
    version: 1,
    exportedAt: getTodayIso(),
    data: {
      [STORAGE_KEYS.SRS]: srs,
      [STORAGE_KEYS.STREAK]: streak,
      [STORAGE_KEYS.TESTS]: tests,
    },
  };
}

export async function encodeTransferCode(payload = exportProgressPayload()) {
  const compact = JSON.stringify(compactPayload(payload));
  const { prefix, bytes } = await compressUtf8(compact);
  return `${prefix}${bytesToBase64Url(bytes)}`;
}

export async function decodeTransferCode(code) {
  const trimmed = String(code || "").trim();
  if (!trimmed.startsWith("V1.z.") && !trimmed.startsWith("V1.u.")) {
    throw new Error("Mã đồng bộ phải bắt đầu bằng V1.z. hoặc V1.u.");
  }
  const prefix = trimmed.slice(0, 5);
  const b64 = trimmed.slice(5);
  const jsonText = await decompressBytes(prefix, base64UrlToBytes(b64));
  return expandCompactPayload(JSON.parse(jsonText));
}

export async function applyTransferCode(code) {
  const remotePayload = await decodeTransferCode(code);
  const merged = mergeProgressPayloads(exportProgressPayload(), remotePayload);
  applyMergedData(merged.data);
  return {
    wordCount: Object.keys(merged.data[STORAGE_KEYS.SRS]).length,
    testCount: merged.data[STORAGE_KEYS.TESTS].length,
  };
}

export function encodeSetupConfig({ token, gistId = "" }) {
  const raw = JSON.stringify({ t: String(token || "").trim(), g: String(gistId || "").trim() });
  return bytesToBase64Url(new TextEncoder().encode(raw));
}

export function decodeSetupConfig(encoded) {
  const jsonText = new TextDecoder().decode(base64UrlToBytes(String(encoded || "").trim()));
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object" || !parsed.t) {
    throw new Error("Link cài đặt đồng bộ không hợp lệ.");
  }
  return { token: String(parsed.t), gistId: String(parsed.g || "") };
}

export function buildQuickTransferUrl(code) {
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "index.html";
  return `${base}#/progress?syncData=${encodeURIComponent(code)}`;
}

export function buildQuickSetupUrl({ token, gistId = "" }) {
  const encoded = encodeSetupConfig({ token, gistId });
  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "index.html";
  return `${base}#/progress?syncConfig=${encodeURIComponent(encoded)}`;
}
