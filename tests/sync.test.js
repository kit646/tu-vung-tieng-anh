import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSyncConfig,
  exportProgressPayload,
  getAllSrs,
  getStreak,
  getSyncConfig,
  getTestHistory,
  recordCardReview,
  resetAllProgress,
  saveTestResult,
  STORAGE_KEYS,
  updateSyncConfig,
} from "../js/store.js";
import {
  applyTransferCode,
  computeStreakCount,
  decodeSetupConfig,
  decodeTransferCode,
  encodeSetupConfig,
  encodeTransferCode,
  findExistingSyncGist,
  GIST_FILENAME,
  mergeProgressPayloads,
  syncWithGist,
} from "../js/sync.js";

function setupMemoryStorage() {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };
  return mem;
}

function makeJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

test("computeStreakCount & mergeProgressPayloads: smart merge SRS, streak và tests (tối đa 50)", () => {
  setupMemoryStorage();

  assert.equal(computeStreakCount({ "2026-11-16": 2, "2026-11-18": 1, "2026-11-19": 3 }, "2026-11-19"), 2);
  assert.equal(computeStreakCount({}, "2026-11-19"), 0);

  const localPayload = {
    app: "vocab-app",
    version: 1,
    data: {
      [STORAGE_KEYS.SRS]: {
        "w-newer-local": { box: 3, ease: 2.6, interval: 4, due: "2026-11-23", lapses: 0, updatedAt: 2000 },
        "w-newer-remote": { box: 1, ease: 2.5, interval: 1, due: "2026-11-20", lapses: 0, updatedAt: 1000 },
        "w-only-laptop": { box: 2, ease: 2.55, interval: 3, due: "2026-11-22", lapses: 0, updatedAt: 1500 },
        "w-timestamp-vs-legacy": { box: 2, ease: 2.5, interval: 2, due: "2026-11-21", lapses: 0, updatedAt: 500 },
      },
      [STORAGE_KEYS.STREAK]: {
        count: 1,
        lastDate: "2026-11-18",
        history: { "2026-11-17": 2, "2026-11-18": 1 },
      },
      [STORAGE_KEYS.TESTS]: [
        { id: "t-shared", title: "Unit 1", score: 8, total: 10, dateIso: "2026-11-18" },
        ...Array.from({ length: 30 }, (_, i) => ({
          id: `t-local-${String(i).padStart(2, "0")}`,
          title: `Local ${i}`,
          score: 9,
          total: 10,
          dateIso: "2026-11-17",
        })),
      ],
    },
  };

  const remotePayload = {
    app: "vocab-app",
    version: 1,
    data: {
      [STORAGE_KEYS.SRS]: {
        "w-newer-local": { box: 1, ease: 2.4, interval: 1, due: "2026-11-20", lapses: 1, updatedAt: 1000 },
        "w-newer-remote": { box: 4, ease: 2.7, interval: 9, due: "2026-11-28", lapses: 0, updatedAt: 3000 },
        "w-only-phone": { box: 1, ease: 2.5, interval: 1, due: "2026-11-20", lapses: 0, updatedAt: 2500 },
        "w-timestamp-vs-legacy": { box: 4, ease: 2.5, interval: 6, due: "2026-11-25", lapses: 0 },
      },
      [STORAGE_KEYS.STREAK]: {
        count: 2,
        lastDate: "2026-11-19",
        history: { "2026-11-18": 4, "2026-11-19": 2 },
      },
      [STORAGE_KEYS.TESTS]: [
        { id: "t-shared", title: "Unit 1", score: 8, total: 10, dateIso: "2026-11-18" },
        ...Array.from({ length: 30 }, (_, i) => ({
          id: `t-remote-${String(i).padStart(2, "0")}`,
          title: `Remote ${i}`,
          score: 10,
          total: 10,
          dateIso: "2026-11-19",
        })),
      ],
    },
  };

  const merged = mergeProgressPayloads(localPayload, remotePayload);
  const srs = merged.data[STORAGE_KEYS.SRS];
  assert.equal(srs["w-newer-local"].box, 3);
  assert.equal(srs["w-newer-remote"].box, 4);
  assert.equal(srs["w-only-laptop"].box, 2);
  assert.equal(srs["w-only-phone"].box, 1);
  assert.equal(srs["w-timestamp-vs-legacy"].updatedAt, 500);

  const streak = merged.data[STORAGE_KEYS.STREAK];
  assert.equal(streak.lastDate, "2026-11-19");
  assert.equal(streak.count, 3);
  assert.deepEqual(streak.history, {
    "2026-11-17": 2,
    "2026-11-18": 4,
    "2026-11-19": 2,
  });

  const tests = merged.data[STORAGE_KEYS.TESTS];
  assert.equal(tests.length, 50);
  assert.equal(tests[0].dateIso, "2026-11-19");
  assert.equal(tests.filter((t) => t.id === "t-shared").length, 1);
});

test("Transfer code: encode/decode round-trip, applyTransferCode gộp không ghi đè, và từ chối mã lỗi", async () => {
  setupMemoryStorage();

  // Tạo dữ liệu từ "máy tính" rồi xuất transfer code
  recordCardReview("a2-u1-laptop", "good", "2026-11-18");
  saveTestResult({ id: "t-laptop", title: "Unit 1", score: 9, total: 10, percent: 90, durationSec: 40, dateIso: "2026-11-18" });
  const laptopCode = await encodeTransferCode(exportProgressPayload("2026-11-18"));
  assert.ok(laptopCode.startsWith("V1.z.") || laptopCode.startsWith("V1.u."));

  const decoded = await decodeTransferCode(laptopCode);
  assert.equal(decoded.data[STORAGE_KEYS.SRS]["a2-u1-laptop"].box, 1);
  assert.equal(decoded.data[STORAGE_KEYS.TESTS].length, 1);

  // Chuyển sang "điện thoại" đang có dữ liệu riêng
  resetAllProgress();
  recordCardReview("a2-u2-phone", "good", "2026-11-19");
  saveTestResult({ id: "t-phone", title: "Unit 2", score: 10, total: 10, percent: 100, durationSec: 30, dateIso: "2026-11-19" });

  const applied = await applyTransferCode(laptopCode);
  assert.equal(applied.wordCount, 2);
  assert.equal(applied.testCount, 2);

  const srsAfter = getAllSrs();
  assert.ok(srsAfter["a2-u1-laptop"]);
  assert.ok(srsAfter["a2-u2-phone"]);
  assert.equal(getStreak().count, 2);
  assert.equal(getTestHistory().length, 2);

  await assert.rejects(() => decodeTransferCode(""));
  await assert.rejects(() => decodeTransferCode("INVALID_PREFIX.abc"));
  await assert.rejects(() => decodeTransferCode("V1.u.not-valid-json"));
});

test("Setup config encode/decode round-trip và xử lý payload không hợp lệ", () => {
  const encodedFull = encodeSetupConfig({ token: "ghp_demoToken123", gistId: "gist-abc" });
  assert.deepEqual(decodeSetupConfig(encodedFull), { token: "ghp_demoToken123", gistId: "gist-abc" });

  const encodedTokenOnly = encodeSetupConfig({ token: "github_pat_xyz" });
  assert.deepEqual(decodeSetupConfig(encodedTokenOnly), { token: "github_pat_xyz", gistId: "" });

  assert.throws(() => decodeSetupConfig(""));
  assert.throws(() => decodeSetupConfig(Buffer.from(JSON.stringify({ g: "missing-token" })).toString("base64url")));
});

test("syncWithGist: tạo mới Gist trên laptop, tự tìm + merge trên điện thoại, reset forcePush và báo lỗi 401", async () => {
  setupMemoryStorage();

  // 1. Chưa nhập token -> trả lỗi không gọi fetch
  const noTokenRes = await syncWithGist({
    fetchImpl: async () => {
      throw new Error("should not call fetch without token");
    },
  });
  assert.equal(noTokenRes.ok, false);

  // 2. Laptop chưa có gistId: GET /gists trả rỗng -> POST tạo Secret Gist mới
  recordCardReview("a2-u1-computer", "good", "2026-11-18");
  updateSyncConfig({ token: "ghp_laptop_token", gistId: "" });

  let remoteStore = null;
  const callsLaptop = [];
  const fetchLaptop = async (url, init = {}) => {
    callsLaptop.push({ method: init.method || "GET", url });
    if (url.includes("/gists?per_page=30")) {
      return makeJsonResponse(200, []);
    }
    if (url === "https://api.github.com/gists" && init.method === "POST") {
      const body = JSON.parse(init.body);
      assert.equal(body.public, false);
      remoteStore = body.files[GIST_FILENAME].content;
      return makeJsonResponse(201, { id: "gist-001" });
    }
    throw new Error(`Unexpected request: ${init.method} ${url}`);
  };

  const resCreate = await syncWithGist({ fetchImpl: fetchLaptop });
  assert.equal(resCreate.ok, true);
  assert.equal(resCreate.created, true);
  assert.equal(resCreate.gistId, "gist-001");
  assert.equal(getSyncConfig().gistId, "gist-001");
  assert.equal(getSyncConfig().lastStatus, "synced");
  assert.equal(callsLaptop.map((c) => c.method).join(","), "GET,POST");

  // 3. Điện thoại chỉ có token (gistId rỗng) và đã học từ khác -> findExistingSyncGist + GET + PATCH merged
  setupMemoryStorage();
  recordCardReview("a2-u2-mobile", "good", "2026-11-19");
  updateSyncConfig({ token: "ghp_laptop_token", gistId: "" });

  const callsPhone = [];
  const fetchPhone = async (url, init = {}) => {
    const method = init.method || "GET";
    callsPhone.push({ method, url });
    if (url.includes("/gists?per_page=30")) {
      return makeJsonResponse(200, [
        { id: "other-gist", files: { "notes.txt": {} } },
        { id: "gist-001", files: { [GIST_FILENAME]: {} } },
      ]);
    }
    if (url === "https://api.github.com/gists/gist-001" && method === "GET") {
      return makeJsonResponse(200, {
        id: "gist-001",
        files: {
          [GIST_FILENAME]: { content: remoteStore, truncated: false },
        },
      });
    }
    if (url === "https://api.github.com/gists/gist-001" && method === "PATCH") {
      const body = JSON.parse(init.body);
      remoteStore = body.files[GIST_FILENAME].content;
      return makeJsonResponse(200, { id: "gist-001" });
    }
    throw new Error(`Unexpected phone request: ${method} ${url}`);
  };

  const found = await findExistingSyncGist("ghp_laptop_token", fetchPhone);
  assert.equal(found?.id, "gist-001");

  const resPhone = await syncWithGist({ fetchImpl: fetchPhone });
  assert.equal(resPhone.ok, true);
  assert.equal(resPhone.gistId, "gist-001");
  assert.equal(resPhone.wordCount, 2);
  assert.equal(resPhone.dataChanged, true);
  assert.ok(getAllSrs()["a2-u1-computer"]);
  assert.ok(getAllSrs()["a2-u2-mobile"]);
  assert.equal(getStreak().count, 2);
  assert.ok(callsPhone.some((c) => c.method === "PATCH"));

  // 4. forcePushOnly (sau reset) đẩy thẳng payload rỗng lên Gist mà không kéo lại dữ liệu cũ
  resetAllProgress();
  let forcedPatchBody = null;
  const resResetPush = await syncWithGist({
    forcePushOnly: true,
    fetchImpl: async (url, init = {}) => {
      assert.equal(init.method, "PATCH");
      assert.equal(url, "https://api.github.com/gists/gist-001");
      forcedPatchBody = JSON.parse(JSON.parse(init.body).files[GIST_FILENAME].content);
      return makeJsonResponse(200, { id: "gist-001" });
    },
  });
  assert.equal(resResetPush.ok, true);
  assert.deepEqual(forcedPatchBody.data[STORAGE_KEYS.SRS], {});

  // 5. Lỗi HTTP 401 cập nhật trạng thái error an toàn
  const res401 = await syncWithGist({
    fetchImpl: async () => makeJsonResponse(401, { message: "Bad credentials" }),
  });
  assert.equal(res401.ok, false);
  assert.match(res401.error, /401/);
  assert.equal(getSyncConfig().lastStatus, "error");

  clearSyncConfig();
  assert.equal(getSyncConfig().token, "");
});
