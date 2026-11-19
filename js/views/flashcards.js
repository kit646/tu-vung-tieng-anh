/**
 * Màn hình Flashcard & Lặp lại ngắt quãng (SM-2/Leitner 5 hộp).
 * Hỗ trợ chọn nguồn (đến hạn / theo Unit / từ hay sai / từ mới), tối đa 20 thẻ/phiên,
 * chiều hiển thị EN->VI hoặc VI->EN, animation lật thẻ (tôn trọng prefers-reduced-motion),
 * phím tắt Space / 1 / 2 / 3 / R và tóm tắt cuối phiên.
 */
import { I18N, formatText } from "../i18n.js";
import { iconVolume } from "../icons.js";
import { previewIntervals } from "../srs.js";
import { isSpeechSupported, speakText } from "../speech.js";
import {
  getDueWords,
  getFlashcardDeck,
  getNewWords,
  getSettings,
  getTodayIso,
  getUnitDirectory,
  getWeakWords,
  getWordSrs,
  recordCardReview,
  updateSettings,
} from "../store.js";
import { escapeHtml, formatUnitLabel } from "../utils.js";

const SESSION_LIMIT = 20;

const sessionState = {
  mode: "due",
  unitKey: "",
  direction: "en-vi",
  deck: [],
  index: 0,
  flipped: false,
  stats: { good: 0, hard: 0, again: 0 },
  missedWords: [],
  finished: false,
};

function formatIntervalLabel(days) {
  if (days <= 0) return I18N.flashcards.intervalNow;
  return formatText(I18N.flashcards.intervalDays, { days });
}

function resolveInitialUnitKey(route, units) {
  const level = route.query.get("level")?.toUpperCase();
  const unit = Number(route.query.get("unit"));
  const source = route.query.get("source");
  if (level && unit) {
    const exact = units.find(
      (u) => u.level === level && u.unit === unit && (!source || u.source === source)
    );
    if (exact) return exact.key;
  }
  return sessionState.unitKey || units[0]?.key || "";
}

function startNewSession(mode, unitKey) {
  sessionState.mode = mode;
  sessionState.unitKey = unitKey;
  sessionState.deck = getFlashcardDeck({
    mode,
    unitKey,
    limit: SESSION_LIMIT,
  });
  sessionState.index = 0;
  sessionState.flipped = false;
  sessionState.stats = { good: 0, hard: 0, again: 0 };
  sessionState.missedWords = [];
  sessionState.finished = false;
}

function renderEmptyCard(mode) {
  let title = I18N.flashcards.emptyDueTitle;
  let desc = I18N.flashcards.emptyDueDesc;
  let actionHtml = `
    <button type="button" class="btn btn-primary" data-switch-mode="new">
      ${escapeHtml(I18N.flashcards.studyNewBtn)}
    </button>
    <a class="btn btn-secondary" href="#/practice">${escapeHtml(I18N.home.practiceNow)}</a>
  `;

  if (mode === "weak") {
    title = I18N.flashcards.emptyWeakTitle;
    desc = I18N.flashcards.emptyWeakDesc;
    actionHtml = `
      <button type="button" class="btn btn-primary" data-switch-mode="due">
        ${escapeHtml(I18N.flashcards.sourceDue.replace(" ({count})", ""))}
      </button>
      <a class="btn btn-secondary" href="#/library">${escapeHtml(
        I18N.placeholderScreens.goToLibrary
      )}</a>
    `;
  } else if (mode === "new") {
    title = I18N.flashcards.emptyNewTitle;
    desc = I18N.flashcards.emptyNewDesc;
    actionHtml = `
      <button type="button" class="btn btn-primary" data-switch-mode="due">
        ${escapeHtml(I18N.flashcards.sourceDue.replace(" ({count})", ""))}
      </button>
    `;
  } else if (mode === "unit") {
    title = I18N.flashcards.emptyUnitTitle;
    desc = I18N.flashcards.emptyUnitDesc;
  }

  return `
    <div class="panel state-box">
      <h2 class="section-title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(desc)}</p>
      <div class="btn-row">${actionHtml}</div>
    </div>
  `;
}

function renderSummaryHtml() {
  const total = sessionState.stats.good + sessionState.stats.hard + sessionState.stats.again;
  const missedCount = sessionState.missedWords.length;
  const missedListHtml = missedCount
    ? `
      <div class="detail-block" style="width: 100%; text-align: left">
        <div class="detail-label">${escapeHtml(
          formatText(I18N.flashcards.summaryMissedHeading, { count: missedCount })
        )}</div>
        <ul class="word-list">
          ${sessionState.missedWords
            .map(
              (w) => `
            <li class="word-row">
              <a class="word-row-main" href="#/word/${encodeURIComponent(w.id)}?back=${encodeURIComponent("#/flashcards")}">
                <div class="word-row-top">
                  <span class="word-headword">${escapeHtml(w.word)}</span>
                  <span class="badge badge-pos">${escapeHtml(w.pos)}</span>
                </div>
                <div class="word-meaning-vi">${escapeHtml(w.meaning_vi)}</div>
              </a>
            </li>`
            )
            .join("")}
        </ul>
      </div>`
    : "";

  const drillMissedBtn = missedCount
    ? `<button type="button" class="btn btn-primary" data-action="drill-missed">${escapeHtml(
        formatText(I18N.flashcards.reviewMissedBtn, { count: missedCount })
      )}</button>`
    : "";

  return `
    <section class="panel state-box" aria-live="polite">
      <h2 class="page-title">${escapeHtml(I18N.flashcards.summaryTitle)}</h2>
      <p class="tabular-nums">${escapeHtml(
        formatText(I18N.flashcards.summaryTotal, { total })
      )}</p>
      <div class="stat-row" style="width: 100%; max-width: 520px">
        <div class="stat-cell">
          <div class="stat-cell-num tabular-nums">${sessionState.stats.good}</div>
          <div class="stat-cell-label">${escapeHtml(I18N.flashcards.summaryGood)}</div>
        </div>
        <div class="stat-cell">
          <div class="stat-cell-num tabular-nums">${sessionState.stats.hard}</div>
          <div class="stat-cell-label">${escapeHtml(I18N.flashcards.summaryHard)}</div>
        </div>
        <div class="stat-cell">
          <div class="stat-cell-num tabular-nums">${sessionState.stats.again}</div>
          <div class="stat-cell-label">${escapeHtml(I18N.flashcards.summaryAgain)}</div>
        </div>
      </div>
      ${missedListHtml}
      <div class="btn-row">
        ${drillMissedBtn}
        <button type="button" class="btn ${missedCount ? "btn-secondary" : "btn-primary"}" data-action="restart-session">
          ${escapeHtml(I18N.flashcards.nextBatchBtn)}
        </button>
        <a class="btn btn-ghost" href="#/home">${escapeHtml(I18N.flashcards.backHomeBtn)}</a>
      </div>
    </section>
  `;
}

function renderCardStageHtml() {
  const word = sessionState.deck[sessionState.index];
  const total = sessionState.deck.length;
  const currentNum = sessionState.index + 1;
  const pct = Math.round((currentNum / total) * 100);
  const srs = getWordSrs(word.id);
  const intervals = previewIntervals(srs, getTodayIso());
  const speechAvailable = isSpeechSupported();
  const isEnFirst = sessionState.direction === "en-vi";
  const boxBadge = `<span class="badge badge-pos tabular-nums">${escapeHtml(
    formatText(I18N.srs.boxLabel, { box: srs.box })
  )}</span>`;

  const speakWordBtn = speechAvailable
    ? `<button type="button" class="btn-icon" data-card-speak="${escapeHtml(
        word.word
      )}" aria-label="${escapeHtml(
        formatText(I18N.controls.speakWord, { word: word.word })
      )}">${iconVolume(18)}</button>`
    : "";

  const speakExBtn = speechAvailable
    ? `<button type="button" class="btn-icon" data-card-speak="${escapeHtml(
        word.example
      )}" aria-label="${escapeHtml(I18N.controls.speakExample)}">${iconVolume(18)}</button>`
    : "";

  const frontContent = isEnFirst
    ? `
      <div class="flashcard-headword">${escapeHtml(word.word)}</div>
      <div class="badge-row">
        <span class="badge badge-pos">${escapeHtml(word.pos)}</span>
        ${word.ipa ? `<span class="ipa-text">/${escapeHtml(word.ipa)}/</span>` : ""}
      </div>
      ${speakWordBtn}`
    : `
      <div class="flashcard-meaning">${escapeHtml(word.meaning_vi)}</div>
      <div class="badge-row">
        <span class="badge badge-pos">${escapeHtml(word.pos)}</span>
      </div>`;

  const backContent = isEnFirst
    ? `
      <div class="flashcard-meaning">${escapeHtml(word.meaning_vi)}</div>
      <p class="flashcard-def">${escapeHtml(word.definition_en)}</p>
      <div class="flashcard-example-box">
        <span class="example-sentence">${escapeHtml(word.example)}</span>
        ${speakExBtn}
      </div>`
    : `
      <div class="flashcard-headword">${escapeHtml(word.word)}</div>
      <div class="badge-row">
        <span class="badge badge-pos">${escapeHtml(word.pos)}</span>
        ${word.ipa ? `<span class="ipa-text">/${escapeHtml(word.ipa)}/</span>` : ""}
        ${speakWordBtn}
      </div>
      <p class="flashcard-def">${escapeHtml(word.definition_en)}</p>
      <div class="flashcard-example-box">
        <span class="example-sentence">${escapeHtml(word.example)}</span>
        ${speakExBtn}
      </div>`;

  const controlsHtml = sessionState.flipped
    ? `
      <div class="srs-grade-grid">
        <button type="button" class="btn-srs btn-srs-again" data-grade="again">
          <span class="btn-srs-title"><kbd class="kbd-hint">1</kbd> ${escapeHtml(
            I18N.flashcards.again
          )}</span>
          <span class="btn-srs-meta">${escapeHtml(formatIntervalLabel(intervals.again))}</span>
        </button>
        <button type="button" class="btn-srs btn-srs-hard" data-grade="hard">
          <span class="btn-srs-title"><kbd class="kbd-hint">2</kbd> ${escapeHtml(
            I18N.flashcards.hard
          )}</span>
          <span class="btn-srs-meta tabular-nums">${escapeHtml(
            formatIntervalLabel(intervals.hard)
          )}</span>
        </button>
        <button type="button" class="btn-srs btn-srs-good" data-grade="good">
          <span class="btn-srs-title"><kbd class="kbd-hint">3</kbd> ${escapeHtml(
            I18N.flashcards.good
          )}</span>
          <span class="btn-srs-meta tabular-nums">${escapeHtml(
            formatIntervalLabel(intervals.good)
          )}</span>
        </button>
      </div>`
    : `
      <div style="display: flex; justify-content: center">
        <button type="button" id="flip-card-btn" class="btn btn-primary" style="min-width: 220px">
          <span>${escapeHtml(I18N.flashcards.flipBtn)}</span>
          <kbd class="kbd-hint">Space</kbd>
        </button>
      </div>`;

  return `
    <div class="flashcard-progress-bar">
      <div class="flashcard-progress-meta tabular-nums">
        <span>${escapeHtml(
          formatText(I18N.flashcards.cardCounter, { current: currentNum, total })
        )}</span>
        <span>${pct}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
    </div>

    <div class="flashcard-wrapper">
      <div
        id="active-flashcard"
        class="flashcard-card ${sessionState.flipped ? "is-flipped" : ""}"
        role="button"
        tabindex="0"
        aria-pressed="${sessionState.flipped}"
        aria-label="${escapeHtml(I18N.flashcards.flipPrompt)}"
      >
        <div class="flashcard-face flashcard-face-front" aria-hidden="${sessionState.flipped}">
          <div class="flashcard-face-top">
            <span class="badge badge-level">${escapeHtml(
              formatUnitLabel(word.level, word.unit)
            )}</span>
            ${boxBadge}
          </div>
          <div class="flashcard-face-center">${frontContent}</div>
          <div class="flashcard-face-footer">
            <span>${escapeHtml(I18N.flashcards.flipPrompt)}</span>
          </div>
        </div>

        <div class="flashcard-face flashcard-face-back" aria-hidden="${!sessionState.flipped}">
          <div class="flashcard-face-top">
            <span class="badge badge-level">${escapeHtml(word.word)}</span>
            ${boxBadge}
          </div>
          <div class="flashcard-face-center">${backContent}</div>
          <div class="flashcard-face-footer">
            <span>${escapeHtml(I18N.flashcards.backLabel)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flashcard-actions">${controlsHtml}</div>
  `;
}

export function renderFlashcardsView(container, route) {
  const units = getUnitDirectory();
  const settings = getSettings();
  sessionState.direction = settings.cardDirection === "vi-en" ? "vi-en" : "en-vi";

  const requestedMode = route.query.get("mode");
  const hasUnitQuery = route.query.has("level") && route.query.has("unit");
  const initialMode = requestedMode || (hasUnitQuery ? "unit" : "due");
  const initialUnitKey = resolveInitialUnitKey(route, units);
  startNewSession(initialMode, initialUnitKey);

  function render() {
    const dueCount = getDueWords().length;
    const weakCount = getWeakWords().length;
    const newCount = getNewWords().length;

    let stageHtml = "";
    if (sessionState.finished) {
      stageHtml = renderSummaryHtml();
    } else if (!sessionState.deck.length) {
      stageHtml = renderEmptyCard(sessionState.mode);
    } else {
      stageHtml = renderCardStageHtml();
    }

    container.innerHTML = `
      <div class="page-stack">
        <div class="page-header">
          <h1 class="page-title">${escapeHtml(I18N.flashcards.title)}</h1>
        </div>

        <section class="panel" aria-label="${escapeHtml(I18N.flashcards.sourceLabel)}">
          <div class="flashcard-toolbar">
            <div class="control-field">
              <label for="fc-source-select" class="filter-label">${escapeHtml(
                I18N.flashcards.sourceLabel
              )}</label>
              <select id="fc-source-select" class="control-select">
                <option value="due" ${sessionState.mode === "due" ? "selected" : ""}>${escapeHtml(
                  formatText(I18N.flashcards.sourceDue, { count: dueCount })
                )}</option>
                <option value="unit" ${sessionState.mode === "unit" ? "selected" : ""}>${escapeHtml(
                  I18N.flashcards.sourceUnit
                )}</option>
                <option value="weak" ${sessionState.mode === "weak" ? "selected" : ""}>${escapeHtml(
                  formatText(I18N.flashcards.sourceWeak, { count: weakCount })
                )}</option>
                <option value="new" ${sessionState.mode === "new" ? "selected" : ""}>${escapeHtml(
                  formatText(I18N.flashcards.sourceNew, { count: newCount })
                )}</option>
              </select>
            </div>

            ${
              sessionState.mode === "unit"
                ? `
            <div class="control-field">
              <label for="fc-unit-select" class="filter-label">${escapeHtml(
                I18N.flashcards.unitLabel
              )}</label>
              <select id="fc-unit-select" class="control-select">
                ${units
                  .map(
                    (u) =>
                      `<option value="${escapeHtml(u.key)}" ${
                        sessionState.unitKey === u.key ? "selected" : ""
                      }>${escapeHtml(
                        `${formatUnitLabel(u.level, u.unit)} · ${u.topic || u.title} (${
                          u.words.length
                        })`
                      )}</option>`
                  )
                  .join("")}
              </select>
            </div>`
                : ""
            }

            <div class="control-field" style="flex: 0 1 180px">
              <span class="filter-label">${escapeHtml(I18N.flashcards.directionLabel)}</span>
              <div class="chip-group" role="group" aria-label="${escapeHtml(
                I18N.flashcards.directionLabel
              )}">
                <button type="button" class="chip" data-dir="en-vi" aria-pressed="${
                  sessionState.direction === "en-vi"
                }">${escapeHtml(I18N.flashcards.directionEnVi)}</button>
                <button type="button" class="chip" data-dir="vi-en" aria-pressed="${
                  sessionState.direction === "vi-en"
                }">${escapeHtml(I18N.flashcards.directionViEn)}</button>
              </div>
            </div>
          </div>
        </section>

        ${stageHtml}
      </div>
    `;

    bindEvents();
  }

  function flipCard() {
    if (sessionState.finished || !sessionState.deck.length) return;
    sessionState.flipped = !sessionState.flipped;
    render();
  }

  function submitGrade(grade) {
    if (sessionState.finished || !sessionState.deck.length || !sessionState.flipped) return;
    const word = sessionState.deck[sessionState.index];
    recordCardReview(word.id, grade);
    sessionState.stats[grade] += 1;

    if (grade === "again" && !sessionState.missedWords.some((w) => w.id === word.id)) {
      sessionState.missedWords.push(word);
    }

    if (sessionState.index + 1 >= sessionState.deck.length) {
      sessionState.finished = true;
    } else {
      sessionState.index += 1;
      sessionState.flipped = false;
    }
    render();
  }

  function bindEvents() {
    container.querySelector("#fc-source-select")?.addEventListener("change", (e) => {
      startNewSession(e.target.value, sessionState.unitKey);
      render();
    });

    container.querySelector("#fc-unit-select")?.addEventListener("change", (e) => {
      startNewSession("unit", e.target.value);
      render();
    });

    container.querySelectorAll("[data-dir]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextDir = btn.getAttribute("data-dir");
        sessionState.direction = nextDir;
        updateSettings({ cardDirection: nextDir });
        render();
      });
    });

    container.querySelectorAll("[data-switch-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        startNewSession(btn.getAttribute("data-switch-mode"), sessionState.unitKey);
        render();
      });
    });

    const cardEl = container.querySelector("#active-flashcard");
    cardEl?.addEventListener("click", (e) => {
      if (e.target.closest("[data-card-speak]")) return;
      flipCard();
    });
    cardEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        flipCard();
      }
    });

    container.querySelector("#flip-card-btn")?.addEventListener("click", flipCard);

    container.querySelectorAll("[data-card-speak]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        speakText(btn.getAttribute("data-card-speak"));
      });
    });

    container.querySelectorAll("[data-grade]").forEach((btn) => {
      btn.addEventListener("click", () => {
        submitGrade(btn.getAttribute("data-grade"));
      });
    });

    container.querySelector('[data-action="drill-missed"]')?.addEventListener("click", () => {
      sessionState.deck = [...sessionState.missedWords];
      sessionState.index = 0;
      sessionState.flipped = false;
      sessionState.stats = { good: 0, hard: 0, again: 0 };
      sessionState.missedWords = [];
      sessionState.finished = false;
      render();
    });

    container.querySelector('[data-action="restart-session"]')?.addEventListener("click", () => {
      startNewSession(sessionState.mode, sessionState.unitKey);
      render();
    });
  }

  const controller = new AbortController();
  document.addEventListener(
    "keydown",
    (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (sessionState.finished || !sessionState.deck.length) return;

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        flipCard();
        return;
      }

      if (event.key === "r" || event.key === "R") {
        const word = sessionState.deck[sessionState.index];
        if (word) {
          event.preventDefault();
          speakText(word.word);
        }
        return;
      }

      if (sessionState.flipped) {
        if (event.key === "1") {
          event.preventDefault();
          submitGrade("again");
        } else if (event.key === "2") {
          event.preventDefault();
          submitGrade("hard");
        } else if (event.key === "3") {
          event.preventDefault();
          submitGrade("good");
        }
      }
    },
    { signal: controller.signal }
  );

  render();
  return () => controller.abort();
}
