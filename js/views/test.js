/**
 * Màn hình Kiểm tra Unit/Level & Review sách (#/test):
 * - Đề kiểm tra 20 câu trộn 4 dạng (Trắc nghiệm, Điền từ, Xếp chữ, Nghe–viết).
 * - Bài Review Level 1 (Trang 22, 12 câu) và Level 2 (Trang 41, 12 câu) đúng như trong sách.
 * - Chấm điểm, xem lại câu sai kèm nghĩa tiếng Việt, ghi nhận lapses+1 vào SRS và lưu lịch sử điểm.
 */
import {
  generateMixedTest,
  getBookReviews,
  normalizeAnswerText,
  normalizeLetters,
  scrambleWordLetters,
} from "../exercises.js";
import { I18N, formatText } from "../i18n.js";
import { iconVolume } from "../icons.js";
import { isSpeechSupported, speakText } from "../speech.js";
import {
  getTestHistory,
  getTodayIso,
  getUnitDirectory,
  getWordById,
  recordExerciseAnswer,
  saveTestResult,
} from "../store.js";
import { escapeHtml, formatUnitLabel } from "../utils.js";

const testState = {
  tab: "mixed", // "mixed" | "review1" | "review2"
  scopeType: "unit", // "unit" | "level-A1" | "level-A2"
  unitKey: "",
  phase: "setup", // "setup" | "active" | "result"
  questions: [],
  testTitle: "",
  targetKey: "",
  currentIdx: 0,
  answers: {}, // idx -> string
  unscrambleChosen: {}, // idx -> number[]
  unscrambleTilesByQ: {}, // idx -> [{idx, char}]
  startedAt: 0,
  result: null,
  reviewAnswers: {}, // num -> string
  reviewBook: null,
};

function formatDuration(seconds) {
  const s = Math.max(1, Math.round(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function buildMixedSession() {
  const level = testState.scopeType === "level-A2" ? "A2" : "A1";
  const scope = testState.scopeType === "unit" ? "unit" : "level";
  const generated = generateMixedTest({
    scopeType: scope,
    unitKey: testState.unitKey,
    level,
    count: 20,
  });
  testState.testTitle = generated.title;
  testState.targetKey = generated.targetKey;
  testState.questions = generated.questions;
  testState.currentIdx = 0;
  testState.answers = {};
  testState.unscrambleChosen = {};
  testState.unscrambleTilesByQ = {};

  generated.questions.forEach((q, idx) => {
    if (q.type === "unscramble") {
      const chars = q.scrambled
        ? q.scrambled.split(/\s+/).filter(Boolean)
        : scrambleWordLetters(q.answer);
      testState.unscrambleTilesByQ[idx] = chars.map((ch, tIdx) => ({
        idx: tIdx,
        char: ch.toUpperCase(),
      }));
      testState.unscrambleChosen[idx] = [];
    }
  });

  testState.startedAt = Date.now();
  testState.result = null;
  testState.phase = "active";
}

function startBookReviewSession(levelStr) {
  const reviews = getBookReviews();
  const rev = reviews.find((r) => r.level === levelStr) || reviews[0];
  if (!rev) return;
  testState.reviewBook = rev;
  testState.reviewAnswers = {};
  testState.startedAt = Date.now();
  testState.result = null;
  testState.phase = "active";
}

function renderHistoryHtml() {
  const history = getTestHistory();
  if (!history.length) {
    return `<p class="page-subtitle">${escapeHtml(I18N.test.historyEmpty)}</p>`;
  }
  return `
    <ul class="history-list">
      ${history
        .slice(0, 10)
        .map(
          (item) => `
        <li class="history-row">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <div class="unit-item-meta tabular-nums">${escapeHtml(item.dateIso)} · ${escapeHtml(
            formatDuration(item.durationSec)
          )}</div>
          </div>
          <span class="badge ${
            item.percent >= 80 ? "badge-srs-mastered" : "badge-srs-learning"
          } tabular-nums">${item.score}/${item.total} (${item.percent}%)</span>
        </li>`
        )
        .join("")}
    </ul>
  `;
}

function renderResultHtml() {
  const res = testState.result;
  const wrongCount = res.wrongItems.length;
  const speechAvailable = isSpeechSupported();

  const wrongListHtml = wrongCount
    ? `
      <section class="panel">
        <div class="panel-header">
          <h2 class="section-title">${escapeHtml(
            formatText(I18N.test.wrongSectionTitle, { count: wrongCount })
          )}</h2>
        </div>
        <div>
          ${res.wrongItems
            .map((w) => {
              const vocabWord = getWordById(w.wordId);
              return `
              <article class="wrong-review-item">
                <div class="word-row-top" style="justify-content: space-between">
                  <strong>${escapeHtml(w.promptLabel)}</strong>
                  ${
                    speechAvailable
                      ? `<button type="button" class="btn-icon" data-speak-text="${escapeHtml(
                          w.correctAnswer
                        )}" aria-label="${escapeHtml(
                          formatText(I18N.controls.speakWord, { word: w.correctAnswer })
                        )}">${iconVolume(18)}</button>`
                      : ""
                  }
                </div>
                <p style="color: var(--danger-text)">${escapeHtml(
                  I18N.test.yourAnswerLabel
                )} <strong>${escapeHtml(w.userAnswer || I18N.test.noAnswerText)}</strong></p>
                <p style="color: var(--success-text)">${escapeHtml(
                  I18N.test.correctAnswerLabel
                )} <strong>${escapeHtml(w.correctAnswer)}</strong>${
                vocabWord?.meaning_vi ? ` — ${escapeHtml(vocabWord.meaning_vi)}` : ""
              }</p>
              </article>`;
            })
            .join("")}
        </div>
      </section>`
    : `
      <section class="panel state-box">
        <h2 class="section-title">${escapeHtml(I18N.test.allCorrectTitle)}</h2>
      </section>`;

  return `
    <section class="panel state-box" aria-live="polite">
      <h2 class="page-title">${escapeHtml(I18N.test.resultTitle)}</h2>
      <p class="page-subtitle">${escapeHtml(res.title)}</p>
      <div class="stat-value-lg tabular-nums">${escapeHtml(
        formatText(I18N.test.resultScore, {
          score: res.score,
          total: res.total,
          percent: res.percent,
        })
      )}</div>
      <p class="unit-item-meta tabular-nums">${escapeHtml(
        formatText(I18N.test.resultDuration, { time: formatDuration(res.durationSec) })
      )}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-action="retry-test">${escapeHtml(
          I18N.test.retryBtn
        )}</button>
        ${
          wrongCount > 0
            ? `<a class="btn btn-secondary" href="#/flashcards?mode=weak">${escapeHtml(
                formatText(I18N.test.practiceWeakBtn, { count: wrongCount })
              )}</a>`
            : ""
        }
        ${
          testState.tab === "mixed"
            ? `<button type="button" class="btn btn-ghost" data-action="setup-test">${escapeHtml(
                I18N.test.newTestBtn
              )}</button>`
            : ""
        }
      </div>
    </section>

    ${wrongListHtml}

    <section class="panel">
      <div class="panel-header">
        <h2 class="section-title">${escapeHtml(I18N.test.historyTitle)}</h2>
      </div>
      ${renderHistoryHtml()}
    </section>
  `;
}

function renderActiveMixedTest() {
  const idx = testState.currentIdx;
  const q = testState.questions[idx];
  const total = testState.questions.length;
  const answeredCount = testState.questions.filter(
    (_, qIdx) => Boolean((testState.answers[qIdx] || "").trim())
  ).length;
  const pct = Math.round(((idx + 1) / total) * 100);

  const typeLabels = {
    mcq: I18N.test.typeMcq,
    fill: I18N.test.typeFill,
    unscramble: I18N.test.typeUnscramble,
    listen: I18N.test.typeListen,
  };

  let questionHtml = "";
  if (q.type === "mcq") {
    const selected = testState.answers[idx] || "";
    questionHtml = `
      <div class="sentence-prompt">${escapeHtml(q.prompt)}</div>
      <div class="mcq-list">
        ${q.options
          .map((opt, oIdx) => {
            const cleanOpt = opt.replace(/^[a-d]\)\s*/i, "").trim();
            return `
              <button
                type="button"
                class="mcq-option ${selected === cleanOpt ? "is-selected" : ""}"
                data-test-mcq="${escapeHtml(cleanOpt)}"
              >
                <span>${escapeHtml(opt)}</span>
                <kbd class="kbd-hint">${oIdx + 1}</kbd>
              </button>`;
          })
          .join("")}
      </div>
    `;
  } else if (q.type === "fill") {
    const selected = testState.answers[idx] || "";
    const slot = `<span class="blank-slot">${escapeHtml(selected || "____")}</span>`;
    const rendered = escapeHtml(q.sentence).replace("____", slot);
    questionHtml = `
      <div class="sentence-prompt">${rendered}</div>
      <div class="word-bank">
        ${q.word_bank
          .map(
            (w) => `
          <button
            type="button"
            class="bank-chip ${selected === w ? "is-selected" : ""}"
            data-test-fill="${escapeHtml(w)}"
          >${escapeHtml(w)}</button>`
          )
          .join("")}
      </div>
    `;
  } else if (q.type === "unscramble") {
    const tiles = testState.unscrambleTilesByQ[idx] || [];
    const chosen = testState.unscrambleChosen[idx] || [];
    const chosenSet = new Set(chosen);
    const slotsHtml = chosen.length
      ? chosen
          .map(
            (tIdx, posIdx) => `
            <button type="button" class="letter-tile is-placed" data-test-unplace="${posIdx}">
              ${escapeHtml(tiles[tIdx]?.char || "")}
            </button>`
          )
          .join("")
      : `<span class="page-subtitle" style="margin: 0">${escapeHtml(
          I18N.practice.unscrambleInstr
        )}</span>`;
    const trayHtml = tiles
      .map(
        (t) => `
        <button type="button" class="letter-tile" data-test-place="${t.idx}" ${
          chosenSet.has(t.idx) ? "disabled" : ""
        }>${escapeHtml(t.char)}</button>`
      )
      .join("");

    questionHtml = `
      <div class="sentence-prompt">${escapeHtml(q.hint)}</div>
      <div class="tile-slots">${slotsHtml}</div>
      <div class="tile-tray">${trayHtml}</div>
      <div class="btn-row" style="margin-top: 0">
        <button type="button" class="btn btn-secondary" id="test-bksp-btn" ${
          chosen.length ? "" : "disabled"
        }>${escapeHtml(I18N.practice.unscrambleBackspace)}</button>
      </div>
    `;
  } else if (q.type === "listen") {
    const speechAvailable = isSpeechSupported();
    const audioHtml = speechAvailable
      ? `
        <div class="btn-row" style="margin-top: 0">
          <button type="button" class="btn btn-primary" data-test-listen="1.0">
            ${iconVolume(18)}
            <span>${escapeHtml(I18N.practice.listenBtn)}</span>
            <kbd class="kbd-hint">R</kbd>
          </button>
          <button type="button" class="btn btn-secondary" data-test-listen="0.8">
            ${iconVolume(18)}
            <span>${escapeHtml(I18N.practice.listenSlowBtn)}</span>
          </button>
        </div>`
      : `<p class="study-tip-box">${escapeHtml(I18N.practice.listenNoSpeech)} (${escapeHtml(
          q.definition_en
        )})</p>`;

    questionHtml = `
      ${audioHtml}
      <div class="sentence-prompt">
        <strong>${escapeHtml(I18N.practice.listenHintLabel)}</strong> ${escapeHtml(q.hintSentence)}
      </div>
      <input
        id="test-listen-input"
        class="text-answer-input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="${escapeHtml(I18N.practice.listenInputPlaceholder)}"
        value="${escapeHtml(testState.answers[idx] || "")}"
      />
    `;
  }

  return `
    <section class="panel page-stack" style="gap: var(--space-4)">
      <div class="panel-header" style="margin-bottom: 0">
        <div>
          <h2 class="section-title">${escapeHtml(testState.testTitle)}</h2>
          <p class="unit-item-meta tabular-nums">${escapeHtml(
            formatText(I18N.test.answeredProgress, { answered: answeredCount, total })
          )}</p>
        </div>
        <span class="badge badge-pos">${escapeHtml(typeLabels[q.type] || q.type)}</span>
      </div>

      <div class="flashcard-progress-bar">
        <div class="flashcard-progress-meta tabular-nums">
          <span>${escapeHtml(
            formatText(I18N.test.questionCounter, { current: idx + 1, total })
          )}</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%"></div>
        </div>
      </div>

      ${questionHtml}

      <div class="btn-row" style="justify-content: space-between; margin-top: 0">
        <div class="badge-row">
          <button type="button" class="btn btn-secondary" id="test-prev-btn" ${
            idx === 0 ? "disabled" : ""
          }>${escapeHtml(I18N.test.prevBtn)}</button>
          <button type="button" class="btn btn-secondary" id="test-next-btn" ${
            idx + 1 >= total ? "disabled" : ""
          }>${escapeHtml(I18N.test.nextBtn)}</button>
        </div>
        <button type="button" class="btn btn-primary" id="test-submit-btn">
          ${escapeHtml(I18N.test.submitBtn)}
        </button>
      </div>
    </section>
  `;
}

function renderActiveBookReview() {
  const rev = testState.reviewBook;
  if (!rev) return "";

  return `
    <section class="panel page-stack" style="gap: var(--space-4)">
      <div class="panel-header" style="margin-bottom: 0">
        <div>
          <h2 class="section-title">${escapeHtml(rev.title)}</h2>
          <p class="page-subtitle" style="margin: 0">${escapeHtml(I18N.test.reviewBankInstr)}</p>
        </div>
        <span class="badge badge-level">Trang ${rev.page}</span>
      </div>

      <div class="word-bank">
        ${rev.word_bank
          .map((w) => `<span class="badge badge-source">${escapeHtml(w)}</span>`)
          .join("")}
      </div>

      <div class="review-question-list">
        ${rev.items
          .map((it) => {
            const currentVal = testState.reviewAnswers[it.num] || "";
            return `
              <div class="review-question-row">
                <label for="rev-q-${it.num}" class="example-sentence">
                  <strong>${it.num}.</strong> ${escapeHtml(it.sentence)}
                </label>
                <select id="rev-q-${it.num}" class="control-select" data-rev-num="${it.num}">
                  <option value="">${escapeHtml(I18N.test.reviewSelectPlaceholder)}</option>
                  ${rev.word_bank
                    .map(
                      (w) =>
                        `<option value="${escapeHtml(w)}" ${
                          currentVal === w ? "selected" : ""
                        }>${escapeHtml(w)}</option>`
                    )
                    .join("")}
                </select>
              </div>`;
          })
          .join("")}
      </div>

      <div class="btn-row" style="margin-top: 0">
        <button type="button" class="btn btn-primary" id="review-submit-btn">
          ${escapeHtml(I18N.test.submitBtn)}
        </button>
      </div>
    </section>
  `;
}

function renderSetupScreen(units) {
  return `
    <section class="panel page-stack" style="gap: var(--space-4)">
      <div class="flashcard-toolbar">
        <div class="control-field">
          <label for="test-scope-select" class="filter-label">${escapeHtml(
            I18N.test.scopeLabel
          )}</label>
          <select id="test-scope-select" class="control-select">
            <option value="unit" ${testState.scopeType === "unit" ? "selected" : ""}>${escapeHtml(
              I18N.test.scopeUnit
            )}</option>
            <option value="level-A1" ${
              testState.scopeType === "level-A1" ? "selected" : ""
            }>${escapeHtml(I18N.test.scopeLevelA1)}</option>
            <option value="level-A2" ${
              testState.scopeType === "level-A2" ? "selected" : ""
            }>${escapeHtml(I18N.test.scopeLevelA2)}</option>
          </select>
        </div>

        ${
          testState.scopeType === "unit"
            ? `
        <div class="control-field">
          <label for="test-unit-select" class="filter-label">${escapeHtml(
            I18N.test.unitLabel
          )}</label>
          <select id="test-unit-select" class="control-select">
            ${units
              .map(
                (u) =>
                  `<option value="${escapeHtml(u.key)}" ${
                    u.key === testState.unitKey ? "selected" : ""
                  }>${escapeHtml(
                    `${formatUnitLabel(u.level, u.unit)} · ${u.topic || u.title} (${
                      u.source === "book" ? I18N.library.sourceBook : I18N.library.sourceWordlist
                    })`
                  )}</option>`
              )
              .join("")}
          </select>
        </div>`
            : ""
        }
      </div>

      <div class="btn-row" style="margin-top: 0">
        <button type="button" class="btn btn-primary" id="test-start-btn">
          ${escapeHtml(I18N.test.startBtn)}
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2 class="section-title">${escapeHtml(I18N.test.historyTitle)}</h2>
      </div>
      ${renderHistoryHtml()}
    </section>
  `;
}

export function renderTestView(container, route) {
  const units = getUnitDirectory();
  const qUnitKey = route.query.get("unitKey");
  if (qUnitKey && units.some((u) => u.key === qUnitKey)) {
    testState.unitKey = qUnitKey;
    testState.scopeType = "unit";
    testState.tab = "mixed";
    testState.phase = "setup";
  } else if (!testState.unitKey && units[0]) {
    testState.unitKey = units[0].key;
  }

  function render() {
    let contentHtml = "";
    if (testState.phase === "result" && testState.result) {
      contentHtml = renderResultHtml();
    } else if (testState.tab === "mixed") {
      contentHtml =
        testState.phase === "active" ? renderActiveMixedTest() : renderSetupScreen(units);
    } else {
      contentHtml = renderActiveBookReview();
    }

    container.innerHTML = `
      <div class="page-stack">
        <div class="page-header">
          <h1 class="page-title">${escapeHtml(I18N.test.title)}</h1>
        </div>

        <section class="panel">
          <div class="chip-group" role="tablist" aria-label="${escapeHtml(I18N.test.title)}">
            <button
              type="button"
              role="tab"
              class="chip"
              data-test-tab="mixed"
              aria-selected="${testState.tab === "mixed"}"
              aria-pressed="${testState.tab === "mixed"}"
            >${escapeHtml(I18N.test.modeMixed)}</button>
            <button
              type="button"
              role="tab"
              class="chip"
              data-test-tab="review1"
              aria-selected="${testState.tab === "review1"}"
              aria-pressed="${testState.tab === "review1"}"
            >${escapeHtml(I18N.test.modeReview1)}</button>
            <button
              type="button"
              role="tab"
              class="chip"
              data-test-tab="review2"
              aria-selected="${testState.tab === "review2"}"
              aria-pressed="${testState.tab === "review2"}"
            >${escapeHtml(I18N.test.modeReview2)}</button>
          </div>
        </section>

        ${contentHtml}
      </div>
    `;

    bindEvents();
  }

  function submitMixedTest() {
    const wrongItems = [];
    let score = 0;

    testState.questions.forEach((q, idx) => {
      const userAnswer = (testState.answers[idx] || "").trim();
      let isCorrect = false;
      if (q.type === "unscramble") {
        isCorrect =
          Boolean(userAnswer) && normalizeLetters(userAnswer) === normalizeLetters(q.answer);
      } else {
        isCorrect = normalizeAnswerText(userAnswer) === normalizeAnswerText(q.answer);
      }

      if (isCorrect) {
        score += 1;
      } else {
        const promptLabel =
          q.type === "mcq"
            ? q.prompt
            : q.type === "fill"
            ? q.sentence
            : q.type === "unscramble"
            ? `${q.scrambled} — ${q.hint}`
            : q.hintSentence;
        wrongItems.push({
          wordId: q.word_id,
          promptLabel,
          userAnswer,
          correctAnswer: q.answer,
        });
      }
      recordExerciseAnswer(q.word_id, isCorrect);
    });

    const total = testState.questions.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const durationSec = Math.max(1, Math.round((Date.now() - testState.startedAt) / 1000));

    saveTestResult({
      id: `res-${Date.now()}`,
      title: testState.testTitle,
      targetKey: testState.targetKey,
      score,
      total,
      percent,
      durationSec,
      dateIso: getTodayIso(),
      wrongCount: wrongItems.length,
    });

    testState.result = {
      title: testState.testTitle,
      score,
      total,
      percent,
      durationSec,
      wrongItems,
    };
    testState.phase = "result";
    render();
  }

  function submitBookReview() {
    const rev = testState.reviewBook;
    if (!rev) return;
    const wrongItems = [];
    let score = 0;

    rev.items.forEach((it) => {
      const userAnswer = (testState.reviewAnswers[it.num] || "").trim();
      const isCorrect = normalizeAnswerText(userAnswer) === normalizeAnswerText(it.answer);
      if (isCorrect) {
        score += 1;
      } else {
        wrongItems.push({
          wordId: it.word_id,
          promptLabel: `${it.num}. ${it.sentence}`,
          userAnswer,
          correctAnswer: it.answer,
        });
      }
      recordExerciseAnswer(it.word_id, isCorrect);
    });

    const total = rev.items.length;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const durationSec = Math.max(1, Math.round((Date.now() - testState.startedAt) / 1000));

    saveTestResult({
      id: `rev-${Date.now()}`,
      title: rev.title,
      targetKey: `review-${rev.level}`,
      score,
      total,
      percent,
      durationSec,
      dateIso: getTodayIso(),
      wrongCount: wrongItems.length,
    });

    testState.result = {
      title: rev.title,
      score,
      total,
      percent,
      durationSec,
      wrongItems,
    };
    testState.phase = "result";
    render();
  }

  function bindEvents() {
    container.querySelectorAll("[data-test-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextTab = btn.getAttribute("data-test-tab");
        testState.tab = nextTab;
        if (nextTab === "mixed") {
          testState.phase = "setup";
          testState.result = null;
        } else if (nextTab === "review1") {
          startBookReviewSession("A1");
        } else {
          startBookReviewSession("A2");
        }
        render();
      });
    });

    container.querySelector("#test-scope-select")?.addEventListener("change", (e) => {
      testState.scopeType = e.target.value;
      render();
    });

    container.querySelector("#test-unit-select")?.addEventListener("change", (e) => {
      testState.unitKey = e.target.value;
    });

    container.querySelector("#test-start-btn")?.addEventListener("click", () => {
      buildMixedSession();
      render();
    });

    container.querySelector('[data-action="setup-test"]')?.addEventListener("click", () => {
      testState.phase = "setup";
      testState.result = null;
      render();
    });

    container.querySelector('[data-action="retry-test"]')?.addEventListener("click", () => {
      if (testState.tab === "mixed") buildMixedSession();
      else if (testState.tab === "review1") startBookReviewSession("A1");
      else startBookReviewSession("A2");
      render();
    });

    // Active mixed test interactions
    container.querySelectorAll("[data-test-mcq]").forEach((btn) => {
      btn.addEventListener("click", () => {
        testState.answers[testState.currentIdx] = btn.getAttribute("data-test-mcq");
        render();
      });
    });

    container.querySelectorAll("[data-test-fill]").forEach((btn) => {
      btn.addEventListener("click", () => {
        testState.answers[testState.currentIdx] = btn.getAttribute("data-test-fill");
        render();
      });
    });

    container.querySelectorAll("[data-test-place]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = testState.currentIdx;
        const tileIdx = Number(btn.getAttribute("data-test-place"));
        const chosen = testState.unscrambleChosen[idx] || [];
        if (!chosen.includes(tileIdx)) {
          chosen.push(tileIdx);
          testState.unscrambleChosen[idx] = chosen;
          testState.answers[idx] = chosen
            .map((t) => testState.unscrambleTilesByQ[idx][t]?.char || "")
            .join("");
          render();
        }
      });
    });

    container.querySelectorAll("[data-test-unplace]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = testState.currentIdx;
        const pos = Number(btn.getAttribute("data-test-unplace"));
        const chosen = testState.unscrambleChosen[idx] || [];
        chosen.splice(pos, 1);
        testState.unscrambleChosen[idx] = chosen;
        testState.answers[idx] = chosen
          .map((t) => testState.unscrambleTilesByQ[idx][t]?.char || "")
          .join("");
        render();
      });
    });

    container.querySelector("#test-bksp-btn")?.addEventListener("click", () => {
      const idx = testState.currentIdx;
      const chosen = testState.unscrambleChosen[idx] || [];
      chosen.pop();
      testState.unscrambleChosen[idx] = chosen;
      testState.answers[idx] = chosen
        .map((t) => testState.unscrambleTilesByQ[idx][t]?.char || "")
        .join("");
      render();
    });

    const listenEl = container.querySelector("#test-listen-input");
    listenEl?.addEventListener("input", () => {
      testState.answers[testState.currentIdx] = listenEl.value;
    });

    container.querySelectorAll("[data-test-listen]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const q = testState.questions[testState.currentIdx];
        if (q) speakText(q.word, Number(btn.getAttribute("data-test-listen")));
      });
    });

    container.querySelector("#test-prev-btn")?.addEventListener("click", () => {
      if (testState.currentIdx > 0) {
        testState.currentIdx -= 1;
        render();
      }
    });

    container.querySelector("#test-next-btn")?.addEventListener("click", () => {
      if (testState.currentIdx + 1 < testState.questions.length) {
        testState.currentIdx += 1;
        render();
      }
    });

    container.querySelector("#test-submit-btn")?.addEventListener("click", submitMixedTest);

    // Book Review interactions
    container.querySelectorAll("[data-rev-num]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const num = Number(sel.getAttribute("data-rev-num"));
        testState.reviewAnswers[num] = sel.value;
      });
    });

    container.querySelector("#review-submit-btn")?.addEventListener("click", submitBookReview);

    container.querySelectorAll("[data-speak-text]").forEach((btn) => {
      btn.addEventListener("click", () => {
        speakText(btn.getAttribute("data-speak-text"));
      });
    });
  }

  const controller = new AbortController();
  document.addEventListener(
    "keydown",
    (event) => {
      if (testState.tab !== "mixed" || testState.phase !== "active") return;
      const q = testState.questions[testState.currentIdx];
      if (!q) return;

      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";

      if (event.key === "Enter" && tag !== "select") {
        event.preventDefault();
        if (testState.currentIdx + 1 < testState.questions.length) {
          testState.currentIdx += 1;
          render();
        } else {
          submitMixedTest();
        }
        return;
      }

      if (isInput) return;

      if (q.type === "mcq" && ["1", "2", "3", "4"].includes(event.key)) {
        const opt = q.options?.[Number(event.key) - 1];
        if (opt) {
          event.preventDefault();
          testState.answers[testState.currentIdx] = opt.replace(/^[a-d]\)\s*/i, "").trim();
          render();
        }
        return;
      }

      if (q.type === "listen" && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        speakText(q.word);
      }
    },
    { signal: controller.signal }
  );

  render();
  return () => controller.abort();
}
