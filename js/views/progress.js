/**
 * Màn hình Tiến độ (#/progress):
 * - Thống kê số từ theo trạng thái (Đã thuộc / Đang học / Mới) và chuỗi ngày học (streak).
 * - Biểu đồ 14 ngày gần nhất bằng SVG thuần.
 * - Tiến độ % theo từng Unit.
 * - Top 10 từ hay sai kèm nút "Ôn ngay".
 * - Xuất / Nhập file JSON sao lưu và Đặt lại toàn bộ tiến độ (kèm hộp thoại xác nhận).
 */
import { I18N, formatText } from "../i18n.js";
import { iconCopy, iconFlame, iconSync, iconVolume } from "../icons.js";
import { navigateTo } from "../router.js";
import { isSpeechSupported, speakText } from "../speech.js";
import {
  clearSyncConfig,
  exportProgressPayload,
  getAllSrs,
  getLast14DaysActivity,
  getOverallStats,
  getStreak,
  getSyncConfig,
  getTodayIso,
  getUnitDirectory,
  getUnitStats,
  getWeakWords,
  importProgressPayload,
  markWordDueToday,
  resetAllProgress,
  updateSyncConfig,
} from "../store.js";
import {
  applyTransferCode,
  buildQuickSetupUrl,
  buildQuickTransferUrl,
  decodeSetupConfig,
  encodeTransferCode,
  onSyncStatusChange,
  syncWithGist,
} from "../sync.js";
import { escapeHtml, formatUnitLabel } from "../utils.js";

function render14DaySvgChart(days) {
  const width = 560;
  const height = 190;
  const padLeft = 14;
  const padRight = 14;
  const padTop = 26;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const baselineY = padTop + chartH;

  const maxCount = Math.max(4, ...days.map((d) => d.count));
  const stepX = chartW / days.length;
  const barW = Math.max(16, Math.floor(stepX * 0.56));

  const barsSvg = days
    .map((day, idx) => {
      const barH = day.count > 0 ? Math.max(6, Math.round((day.count / maxCount) * chartH)) : 3;
      const x = Math.round(padLeft + idx * stepX + (stepX - barW) / 2);
      const y = baselineY - barH;
      const centerX = Math.round(x + barW / 2);
      const fillColor =
        day.count > 0
          ? day.isToday
            ? "var(--success)"
            : "var(--accent)"
          : "var(--border-subtle)";
      const labelText = day.isToday ? I18N.progress.todayShort : day.shortLabel;
      const ariaLabel = formatText(I18N.progress.chartBarLabel, {
        date: day.dateIso,
        count: day.count,
      });

      const valueSvg =
        day.count > 0
          ? `<text x="${centerX}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-secondary)">${day.count}</text>`
          : "";

      // Show every label on desktop-width viewBox with readable spacing
      const dateLabelSvg =
        idx % 2 === 0 || day.isToday
          ? `<text x="${centerX}" y="${baselineY + 18}" text-anchor="middle" font-size="10.5" font-weight="${
              day.isToday ? "700" : "500"
            }" fill="${day.isToday ? "var(--text-primary)" : "var(--text-muted)"}">${escapeHtml(
              labelText
            )}</text>`
          : "";

      return `
        <g aria-label="${escapeHtml(ariaLabel)}">
          <title>${escapeHtml(ariaLabel)}</title>
          <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${fillColor}" />
          ${valueSvg}
          ${dateLabelSvg}
        </g>`;
    })
    .join("");

  return `
    <div class="chart-svg-wrap">
      <svg class="activity-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(
        I18N.progress.chartTitle
      )}">
        <line x1="${padLeft}" y1="${baselineY}" x2="${
    width - padRight
  }" y2="${baselineY}" stroke="var(--border-subtle)" stroke-width="1" />
        ${barsSvg}
      </svg>
    </div>
  `;
}

function formatSyncStatusBadge(syncCfg) {
  if (!syncCfg.token) {
    return {
      cls: "badge-srs-new",
      text: I18N.sync.statusDisconnected,
    };
  }
  if (syncCfg.lastStatus === "syncing") {
    return {
      cls: "badge-srs-learning",
      text: I18N.sync.statusSyncing,
    };
  }
  if (syncCfg.lastStatus === "error") {
    return {
      cls: "badge-srs-learning",
      text: formatText(I18N.sync.statusError, { error: syncCfg.lastError || "?" }),
    };
  }
  if (syncCfg.lastSyncAt) {
    const dt = new Date(syncCfg.lastSyncAt);
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return {
      cls: "badge-srs-mastered",
      text: formatText(I18N.sync.statusSynced, { time: `${hh}:${mm}` }),
    };
  }
  return {
    cls: "badge-srs-new",
    text: I18N.sync.statusDisconnected,
  };
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  return false;
}

export function renderProgressView(container, route) {
  let notice = null; // { type: "success" | "error", text: string }
  let transferText = "";

  const incomingSyncData = route?.query?.get("syncData");
  const incomingSyncConfig = route?.query?.get("syncConfig");

  if (incomingSyncData) {
    window.history?.replaceState?.(null, "", "#/progress");
    applyTransferCode(incomingSyncData)
      .then((res) => {
        notice = {
          type: "success",
          text: formatText(I18N.sync.transferAppliedMsg, {
            words: res.wordCount,
            tests: res.testCount,
          }),
        };
        render();
      })
      .catch(() => {
        notice = { type: "error", text: I18N.sync.transferErrorMsg };
        render();
      });
  } else if (incomingSyncConfig) {
    window.history?.replaceState?.(null, "", "#/progress");
    try {
      const cfg = decodeSetupConfig(incomingSyncConfig);
      updateSyncConfig({
        token: cfg.token,
        gistId: cfg.gistId,
        autoSync: true,
        lastError: "",
      });
      render();
      syncWithGist().then((res) => {
        if (res.ok) {
          notice = {
            type: "success",
            text: formatText(I18N.sync.setupAppliedMsg, { words: res.wordCount }),
          };
        } else {
          notice = { type: "error", text: res.error || I18N.sync.setupInvalidMsg };
        }
        render();
      });
    } catch {
      notice = { type: "error", text: I18N.sync.setupInvalidMsg };
    }
  }

  function render() {
    const stats = getOverallStats();
    const streak = getStreak();
    const syncCfg = getSyncConfig();
    const syncBadge = formatSyncStatusBadge(syncCfg);
    const days14 = getLast14DaysActivity();
    const total14 = days14.reduce((sum, d) => sum + d.count, 0);
    const allWeak = getWeakWords();
    const top10Weak = allWeak.slice(0, 10);
    const allSrs = getAllSrs();
    const units = getUnitDirectory();
    const speechAvailable = isSpeechSupported();

    const masteredPct = stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0;
    const learningPct = stats.total ? Math.round((stats.learning / stats.total) * 100) : 0;

    const noticeHtml = notice
      ? `<div class="feedback-banner ${
          notice.type === "error" ? "feedback-wrong" : "feedback-correct"
        }" role="status" aria-live="polite"><p>${escapeHtml(notice.text)}</p></div>`
      : "";

    const weakListHtml = top10Weak.length
      ? `
        <ul class="word-list">
          ${top10Weak
            .map((w, idx) => {
              const lapses = allSrs[w.id]?.lapses || 0;
              const speakBtn = speechAvailable
                ? `<button type="button" class="btn-icon" data-speak-word="${escapeHtml(
                    w.word
                  )}" aria-label="${escapeHtml(
                    formatText(I18N.controls.speakWord, { word: w.word })
                  )}">${iconVolume(18)}</button>`
                : "";
              return `
                <li class="word-row">
                  <a class="word-row-main" href="#/word/${encodeURIComponent(
                    w.id
                  )}?back=${encodeURIComponent("#/progress")}">
                    <div class="word-row-top">
                      <span class="unit-item-meta tabular-nums">#${idx + 1}</span>
                      <span class="word-headword">${escapeHtml(w.word)}</span>
                      <span class="badge badge-pos">${escapeHtml(w.pos)}</span>
                      <span class="badge badge-srs-learning tabular-nums">${escapeHtml(
                        formatText(I18N.progress.weakLapses, { count: lapses })
                      )}</span>
                    </div>
                    <div class="word-meaning-vi">${escapeHtml(w.meaning_vi)}</div>
                  </a>
                  <div class="word-row-actions">
                    ${speakBtn}
                    <button type="button" class="btn btn-secondary" data-review-now="${escapeHtml(
                      w.id
                    )}">${escapeHtml(I18N.progress.weakReviewNow)}</button>
                  </div>
                </li>`;
            })
            .join("")}
        </ul>`
      : `<p class="page-subtitle">${escapeHtml(I18N.progress.weakEmpty)}</p>`;

    const unitsHtml = units
      .map((u) => {
        const uStats = getUnitStats(u.words);
        const uMasteredPct = uStats.total ? Math.round((uStats.mastered / uStats.total) * 100) : 0;
        const uLearningPct = Math.max(0, uStats.percent - uMasteredPct);
        const srcLabel = u.source === "book" ? I18N.library.sourceBook : I18N.library.sourceWordlist;
        return `
          <li class="unit-progress-row">
            <div class="unit-progress-top">
              <a class="unit-item-title" href="#/library/${u.level}/${u.unit}?source=${u.source}">
                ${escapeHtml(formatUnitLabel(u.level, u.unit))} · ${escapeHtml(u.topic || u.title)}
              </a>
              <div class="badge-row">
                <span class="badge badge-pos">${escapeHtml(srcLabel)}</span>
                <span class="unit-item-meta tabular-nums">${escapeHtml(
                  formatText(I18N.progress.unitProgressMeta, {
                    learned: uStats.learned,
                    total: uStats.total,
                    percent: uStats.percent,
                    mastered: uStats.mastered,
                  })
                )}</span>
              </div>
            </div>
            <div class="progress-track">
              <div class="progress-fill progress-fill-mastered" style="width: ${uMasteredPct}%"></div>
              <div class="progress-fill progress-fill-learning" style="width: ${uLearningPct}%"></div>
            </div>
          </li>`;
      })
      .join("");

    container.innerHTML = `
      <div class="page-stack">
        <div class="page-header">
          <div>
            <h1 class="page-title">${escapeHtml(I18N.progress.title)}</h1>
            <p class="page-subtitle">${escapeHtml(I18N.progress.subtitle)}</p>
          </div>
          <div class="badge badge-streak tabular-nums">
            ${iconFlame(16)}
            <span>${escapeHtml(
              formatText(I18N.progress.streakUnit, { count: streak.count || 0 })
            )}</span>
          </div>
        </div>

        ${noticeHtml}

        <section class="panel page-stack" style="gap: var(--space-4)">
          <div class="progress-kpi-grid">
            <div class="stat-cell">
              <div class="stat-cell-num tabular-nums">${stats.mastered}</div>
              <div class="stat-cell-label">${escapeHtml(I18N.progress.masteredLabel)}</div>
            </div>
            <div class="stat-cell">
              <div class="stat-cell-num tabular-nums">${stats.learning}</div>
              <div class="stat-cell-label">${escapeHtml(I18N.progress.learningLabel)}</div>
            </div>
            <div class="stat-cell">
              <div class="stat-cell-num tabular-nums">${stats.newCount}</div>
              <div class="stat-cell-label">${escapeHtml(I18N.progress.newLabel)}</div>
            </div>
            <div class="stat-cell">
              <div class="stat-cell-num tabular-nums">${escapeHtml(
                formatText(I18N.progress.streakUnit, { count: streak.count || 0 })
              )}</div>
              <div class="stat-cell-label">${escapeHtml(I18N.progress.streakLabel)}</div>
            </div>
          </div>
          <div class="progress-track" aria-label="${escapeHtml(I18N.progress.title)}">
            <div class="progress-fill progress-fill-mastered" style="width: ${masteredPct}%"></div>
            <div class="progress-fill progress-fill-learning" style="width: ${learningPct}%"></div>
          </div>
        </section>

        <div class="progress-split-grid">
          <section class="panel">
            <div class="panel-header">
              <h2 class="section-title">${escapeHtml(I18N.progress.chartTitle)}</h2>
              <span class="unit-item-meta tabular-nums">${escapeHtml(
                formatText(I18N.progress.chartTotal, { count: total14 })
              )}</span>
            </div>
            ${render14DaySvgChart(days14)}
          </section>

          <section class="panel">
            <div class="panel-header">
              <h2 class="section-title">${escapeHtml(I18N.progress.weakTitle)}</h2>
              ${
                allWeak.length
                  ? `<a class="btn btn-ghost" href="#/flashcards?mode=weak">${escapeHtml(
                      formatText(I18N.progress.weakAllBtn, { count: allWeak.length })
                    )}</a>`
                  : ""
              }
            </div>
            ${weakListHtml}
          </section>
        </div>

        <section class="panel">
          <div class="panel-header">
            <h2 class="section-title">${escapeHtml(I18N.progress.unitsTitle)}</h2>
          </div>
          <ul class="unit-progress-list">${unitsHtml}</ul>
        </section>

        <section class="panel" id="sync-panel">
          <div class="panel-header">
            <h2 class="section-title">${escapeHtml(I18N.sync.panelTitle)}</h2>
            <span class="badge ${syncBadge.cls}">${escapeHtml(syncBadge.text)}</span>
          </div>
          <p class="page-subtitle">${escapeHtml(I18N.sync.panelDesc)}</p>

          <div class="sync-section-divider page-stack" style="gap: var(--space-3)">
            <h3 class="section-title">${escapeHtml(I18N.sync.gistSectionTitle)}</h3>
            <details class="sync-guide">
              <summary>${escapeHtml(I18N.sync.gistGuideSummary)}</summary>
              <ol class="sync-guide-steps">
                <li>
                  ${escapeHtml(I18N.sync.gistStep1)}
                  <div style="margin-top: var(--space-1)">
                    <a
                      href="https://github.com/settings/tokens/new?scopes=gist&description=Vocab+A1-A2+Sync"
                      target="_blank"
                      rel="noopener noreferrer"
                    >${escapeHtml(I18N.sync.gistCreateTokenLink)}</a>
                  </div>
                </li>
                <li>${escapeHtml(I18N.sync.gistStep2)}</li>
                <li>${escapeHtml(I18N.sync.gistStep3)}</li>
              </ol>
            </details>

            <div class="sync-form-grid">
              <div class="filter-group">
                <label for="sync-token-input" class="filter-label">${escapeHtml(
                  I18N.sync.tokenLabel
                )}</label>
                <input
                  id="sync-token-input"
                  class="text-answer-input"
                  type="password"
                  autocomplete="off"
                  placeholder="${escapeHtml(I18N.sync.tokenPlaceholder)}"
                  value="${escapeHtml(syncCfg.token || "")}"
                />
              </div>
              <div class="filter-group">
                <label for="sync-gist-input" class="filter-label">${escapeHtml(
                  I18N.sync.gistIdLabel
                )}</label>
                <input
                  id="sync-gist-input"
                  class="text-answer-input"
                  type="text"
                  autocomplete="off"
                  placeholder="${escapeHtml(I18N.sync.gistIdPlaceholder)}"
                  value="${escapeHtml(syncCfg.gistId || "")}"
                />
              </div>
            </div>

            <label class="checkbox-row" for="sync-auto-checkbox">
              <input
                id="sync-auto-checkbox"
                type="checkbox"
                ${syncCfg.autoSync ? "checked" : ""}
              />
              <span>${escapeHtml(I18N.sync.autoSyncLabel)}</span>
            </label>

            <div class="btn-row" style="margin-top: 0">
              <button type="button" id="sync-save-btn" class="btn btn-primary">
                ${iconSync(18)}
                <span>${escapeHtml(I18N.sync.saveSyncBtn)}</span>
              </button>
              ${
                syncCfg.token
                  ? `<button type="button" id="sync-copy-setup-btn" class="btn btn-secondary">
                      ${iconCopy(18)}
                      <span>${escapeHtml(I18N.sync.copySetupLinkBtn)}</span>
                    </button>
                    <button type="button" id="sync-disconnect-btn" class="btn btn-ghost">
                      ${escapeHtml(I18N.sync.disconnectBtn)}
                    </button>`
                  : ""
              }
            </div>
            ${
              syncCfg.token
                ? `<p class="unit-item-meta">${escapeHtml(I18N.sync.setupLinkWarning)}</p>`
                : ""
            }
          </div>

          <div class="sync-section-divider page-stack" style="gap: var(--space-3)">
            <h3 class="section-title">${escapeHtml(I18N.sync.quickSectionTitle)}</h3>
            <p class="page-subtitle" style="margin: 0">${escapeHtml(
              I18N.sync.quickSectionDesc
            )}</p>
            <div class="btn-row" style="margin-top: 0">
              <button type="button" id="sync-generate-transfer-btn" class="btn btn-secondary">
                ${iconCopy(18)}
                <span>${escapeHtml(I18N.sync.generateTransferBtn)}</span>
              </button>
            </div>
            <div class="filter-group">
              <label for="sync-transfer-box" class="filter-label">${escapeHtml(
                I18N.sync.transferCodeLabel
              )}</label>
              <textarea
                id="sync-transfer-box"
                class="sync-code-box"
                placeholder="${escapeHtml(I18N.sync.transferCodePlaceholder)}"
              >${escapeHtml(transferText)}</textarea>
            </div>
            <div class="btn-row" style="margin-top: 0">
              <button type="button" id="sync-apply-transfer-btn" class="btn btn-secondary">
                ${escapeHtml(I18N.sync.applyTransferBtn)}
              </button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2 class="section-title">${escapeHtml(I18N.progress.backupTitle)}</h2>
          </div>
          <p class="page-subtitle">${escapeHtml(I18N.progress.backupDesc)}</p>
          <input id="progress-import-input" type="file" accept=".json,application/json" hidden />
          <div class="btn-row">
            <button type="button" id="progress-export-btn" class="btn btn-primary">
              ${escapeHtml(I18N.progress.exportBtn)}
            </button>
            <button type="button" id="progress-import-btn" class="btn btn-secondary">
              ${escapeHtml(I18N.progress.importBtn)}
            </button>
            <button type="button" id="progress-reset-btn" class="btn btn-danger">
              ${escapeHtml(I18N.progress.resetBtn)}
            </button>
          </div>
        </section>

        <dialog id="reset-confirm-dialog" class="confirm-dialog" aria-labelledby="reset-dialog-title">
          <h2 id="reset-dialog-title" class="section-title">${escapeHtml(
            I18N.progress.dialogTitle
          )}</h2>
          <p class="page-subtitle" style="margin-top: var(--space-2)">${escapeHtml(
            I18N.progress.dialogDesc
          )}</p>
          <div class="btn-row" style="justify-content: flex-end">
            <button type="button" id="reset-cancel-btn" class="btn btn-secondary">
              ${escapeHtml(I18N.progress.dialogCancel)}
            </button>
            <button type="button" id="reset-confirm-btn" class="btn btn-danger">
              ${escapeHtml(I18N.progress.dialogConfirm)}
            </button>
          </div>
        </dialog>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    container.querySelectorAll("[data-speak-word]").forEach((btn) => {
      btn.addEventListener("click", () => {
        speakText(btn.getAttribute("data-speak-word"));
      });
    });

    container.querySelectorAll("[data-review-now]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wordId = btn.getAttribute("data-review-now");
        markWordDueToday(wordId);
        navigateTo("#/flashcards?mode=weak");
      });
    });

    container.querySelector("#progress-export-btn")?.addEventListener("click", () => {
      const payload = exportProgressPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vocab-progress-${getTodayIso()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notice = { type: "success", text: I18N.progress.exportSuccess };
      render();
    });

    const importInput = container.querySelector("#progress-import-input");
    container.querySelector("#progress-import-btn")?.addEventListener("click", () => {
      importInput?.click();
    });

    importInput?.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const summary = importProgressPayload(parsed);
        notice = {
          type: "success",
          text: formatText(I18N.progress.importSuccess, {
            words: summary.wordCount,
            tests: summary.testCount,
          }),
        };
      } catch {
        notice = { type: "error", text: I18N.progress.importError };
      }
      render();
    });

    const dialog = container.querySelector("#reset-confirm-dialog");
    container.querySelector("#progress-reset-btn")?.addEventListener("click", () => {
      if (typeof dialog?.showModal === "function") {
        dialog.showModal();
      } else {
        dialog?.setAttribute("open", "");
      }
    });

    container.querySelector("#reset-cancel-btn")?.addEventListener("click", () => {
      if (typeof dialog?.close === "function") {
        dialog.close();
      } else {
        dialog?.removeAttribute("open");
      }
    });

    container.querySelector("#reset-confirm-btn")?.addEventListener("click", () => {
      resetAllProgress();
      if (typeof dialog?.close === "function") {
        dialog.close();
      } else {
        dialog?.removeAttribute("open");
      }
      notice = { type: "success", text: I18N.progress.resetSuccess };
      render();
    });

    // Cloud Gist Sync handlers
    container.querySelector("#sync-save-btn")?.addEventListener("click", async () => {
      const token = (container.querySelector("#sync-token-input")?.value || "").trim();
      const gistId = (container.querySelector("#sync-gist-input")?.value || "").trim();
      const autoSync = Boolean(container.querySelector("#sync-auto-checkbox")?.checked);

      if (!token) {
        notice = { type: "error", text: I18N.sync.needTokenMsg };
        render();
        return;
      }

      updateSyncConfig({ token, gistId, autoSync, lastError: "" });
      const res = await syncWithGist();
      if (res.ok) {
        notice = {
          type: "success",
          text: formatText(I18N.sync.syncedSuccessMsg, {
            words: res.wordCount,
            tests: res.testCount,
          }),
        };
      } else {
        notice = { type: "error", text: res.error };
      }
      render();
    });

    container.querySelector("#sync-copy-setup-btn")?.addEventListener("click", async () => {
      const cfg = getSyncConfig();
      const url = buildQuickSetupUrl({ token: cfg.token, gistId: cfg.gistId });
      const copied = await copyText(url);
      if (!copied) {
        transferText = url;
      }
      notice = {
        type: copied ? "success" : "error",
        text: copied ? I18N.sync.copySuccessMsg : I18N.sync.copyFailMsg,
      };
      render();
    });

    container.querySelector("#sync-disconnect-btn")?.addEventListener("click", () => {
      clearSyncConfig();
      notice = { type: "success", text: I18N.sync.disconnectedMsg };
      render();
    });

    // Quick Transfer Code & Link handlers
    const transferBox = container.querySelector("#sync-transfer-box");
    transferBox?.addEventListener("input", () => {
      transferText = transferBox.value;
    });

    container.querySelector("#sync-generate-transfer-btn")?.addEventListener("click", async () => {
      try {
        const code = await encodeTransferCode();
        transferText = code;
        const url = buildQuickTransferUrl(code);
        const copied = await copyText(url);
        notice = {
          type: "success",
          text: copied ? I18N.sync.transferCopiedMsg : I18N.sync.copyFailMsg,
        };
      } catch {
        notice = { type: "error", text: I18N.sync.transferErrorMsg };
      }
      render();
    });

    container.querySelector("#sync-apply-transfer-btn")?.addEventListener("click", async () => {
      const rawInput = (container.querySelector("#sync-transfer-box")?.value || "").trim();
      let code = rawInput;
      if (rawInput.includes("syncData=")) {
        try {
          const match = rawInput.match(/syncData=([^&#]+)/);
          if (match) code = decodeURIComponent(match[1]);
        } catch {
          // keep rawInput
        }
      }
      try {
        const summary = await applyTransferCode(code);
        transferText = "";
        notice = {
          type: "success",
          text: formatText(I18N.sync.transferAppliedMsg, {
            words: summary.wordCount,
            tests: summary.testCount,
          }),
        };
      } catch {
        notice = { type: "error", text: I18N.sync.transferErrorMsg };
      }
      render();
    });
  }

  const unsubSync = onSyncStatusChange((statusObj) => {
    if (statusObj.dataChanged) {
      render();
    } else {
      const badge = container.querySelector("#sync-panel .panel-header .badge");
      if (badge) {
        const info = formatSyncStatusBadge(getSyncConfig());
        badge.className = `badge ${info.cls}`;
        badge.textContent = info.text;
      }
    }
  });

  render();
  return () => unsubSync();
}
