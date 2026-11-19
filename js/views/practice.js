/**
 * Màn hình Bài tập thực hành (#/practice):
 * - Sử dụng bài tập gốc từ data/exercises.json (12 Unit sách) VÀ tự sinh bài tập cho 7 Unit Wordlist.
 * - 5 dạng bài: Nối từ (kéo thả + chạm trên mobile), Điền từ (word bank), Trắc nghiệm, Xếp chữ (chạm chữ cái), Nghe – viết.
 * - Phản hồi ngay đúng/sai kèm nghĩa VI; từ sai tự động đưa lại vào SRS (lapses + 1).
 */
import {
  getPracticeSetForUnit,
  normalizeAnswerText,
  normalizeLetters,
  scrambleWordLetters,
} from "../exercises.js";
import { I18N, formatText } from "../i18n.js";
import { iconVolume } from "../icons.js";
import { isSpeechSupported, speakText } from "../speech.js";
import { getUnitDirectory, getWordById, recordExerciseAnswer } from "../store.js";
import { escapeHtml, formatUnitLabel } from "../utils.js";

const MODES = [
  { key: "matching", label: () => I18N.practice.modeMatching },
  { key: "fill", label: () => I18N.practice.modeFill },
  { key: "mcq", label: () => I18N.practice.modeMcq },
  { key: "unscramble", label: () => I18N.practice.modeUnscramble },
  { key: "listen", label: () => I18N.practice.modeListen },
];

const practiceState = {
  unitKey: "",
  mode: "matching",
  practiceSet: null,
  // Trạng thái chung cho dạng câu tuần tự (fill, mcq, unscramble, listen)
  index: 0,
  correctCount: 0,
  answeredCount: 0,
  checked: false,
  lastIsCorrect: false,
  finished: false,
  selectedFillWord: "",
  selectedMcqOption: "",
  unscrambleTiles: [],
  unscrambleChosen: [],
  listenInput: "",
  // Trạng thái riêng cho Nối từ (matching)
  matchSelectedWordIdx: null,
  matchSelectedDefIdx: null,
  matchMatchedPairs: {}, // wordIdx -> defIdx
  matchWrongFlash: null, // { wordIdx, defIdx }
  matchFeedback: null, // { isCorrect, word, meaningVi }
  matchWrongCount: 0,
};

function resolveInitialUnitKey(route, units) {
  const level = route.query.get("level")?.toUpperCase();
  const unit = Number(route.query.get("unit"));
  const source = route.query.get("source");
  if (level && unit) {
    const found = units.find(
      (u) => u.level === level && u.unit === unit && (!source || u.source === source)
    );
    if (found) return found.key;
  }
  return practiceState.unitKey || units[0]?.key || "";
}

function resetQuestionState() {
  practiceState.checked = false;
  practiceState.lastIsCorrect = false;
  practiceState.selectedFillWord = "";
  practiceState.selectedMcqOption = "";
  practiceState.listenInput = "";
  practiceState.unscrambleChosen = [];

  if (practiceState.mode === "unscramble") {
    const items = practiceState.practiceSet?.D?.items || [];
    const item = items[practiceState.index];
    if (item) {
      const rawChars = item.scrambled
        ? item.scrambled.split(/\s+/).filter(Boolean)
        : scrambleWordLetters(item.answer);
      practiceState.unscrambleTiles = rawChars.map((ch, idx) => ({
        idx,
        char: ch.toUpperCase(),
      }));
    } else {
      practiceState.unscrambleTiles = [];
    }
  }
}

function startModeRound(modeKey) {
  practiceState.mode = modeKey;
  practiceState.index = 0;
  practiceState.correctCount = 0;
  practiceState.answeredCount = 0;
  practiceState.finished = false;
  practiceState.matchSelectedWordIdx = null;
  practiceState.matchSelectedDefIdx = null;
  practiceState.matchMatchedPairs = {};
  practiceState.matchWrongFlash = null;
  practiceState.matchFeedback = null;
  practiceState.matchWrongCount = 0;
  resetQuestionState();
}

function loadUnit(unitKey, modeKey = practiceState.mode) {
  practiceState.unitKey = unitKey;
  practiceState.practiceSet = getPracticeSetForUnit(unitKey);
  startModeRound(modeKey);
}

function getCurrentItems() {
  const ps = practiceState.practiceSet;
  if (!ps) return [];
  if (practiceState.mode === "matching") return ps.A?.items || [];
  if (practiceState.mode === "fill") return ps.B?.items || [];
  if (practiceState.mode === "mcq") return ps.C?.items || [];
  if (practiceState.mode === "unscramble") return ps.D?.items || [];
  if (practiceState.mode === "listen") return ps.listen?.items || [];
  return [];
}

function renderFeedbackBannerHtml(isCorrect, answerWord, wordId) {
  const vocabWord = getWordById(wordId);
  const meaningVi = vocabWord?.meaning_vi || "";
  const speechAvailable = isSpeechSupported();
  const titleText = isCorrect
    ? I18N.practice.correctMsg
    : formatText(I18N.practice.wrongMsg, { answer: answerWord });

  return `
    <div class="feedback-banner ${isCorrect ? "feedback-correct" : "feedback-wrong"}" role="status" aria-live="polite">
      <div class="feedback-title">
        <span>${escapeHtml(titleText)}</span>
        ${
          speechAvailable
            ? `<button type="button" class="btn-icon" data-speak-text="${escapeHtml(
                answerWord
              )}" aria-label="${escapeHtml(
                formatText(I18N.controls.speakWord, { word: answerWord })
              )}">${iconVolume(18)}</button>`
            : ""
        }
      </div>
      ${
        meaningVi
          ? `<p><strong>${escapeHtml(I18N.practice.meaningPrefix)}</strong> ${escapeHtml(
              meaningVi
            )}</p>`
          : ""
      }
      ${!isCorrect ? `<p>${escapeHtml(I18N.practice.srsLapseNote)}</p>` : ""}
    </div>
  `;
}

function renderMatchingStage() {
  const items = getCurrentItems();
  const total = items.length;
  const matchedCount = Object.keys(practiceState.matchMatchedPairs).length;
  const matchedDefIndices = new Set(Object.values(practiceState.matchMatchedPairs));

  if (total > 0 && matchedCount === total) {
    const score = Math.max(0, total - practiceState.matchWrongCount);
    const percent = Math.round((score / total) * 100);
    return `
      <section class="panel state-box" aria-live="polite">
        <h2 class="page-title">${escapeHtml(I18N.practice.roundSummaryTitle)}</h2>
        <p class="tabular-nums">${escapeHtml(
          formatText(I18N.practice.roundSummaryScore, {
            correct: score,
            total,
            percent,
          })
        )}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-action="retry-mode">${escapeHtml(
            I18N.practice.retryRoundBtn
          )}</button>
          ${
            practiceState.practiceSet?.isGenerated
              ? `<button type="button" class="btn btn-secondary" data-action="regen-unit">${escapeHtml(
                  I18N.practice.newSetBtn
                )}</button>`
              : ""
          }
        </div>
      </section>
    `;
  }

  const wordsColHtml = items
    .map((it, idx) => {
      const isMatched = idx in practiceState.matchMatchedPairs;
      const isSelected = practiceState.matchSelectedWordIdx === idx;
      const isWrong = practiceState.matchWrongFlash?.wordIdx === idx;
      const cls = [
        "match-item",
        isMatched ? "is-matched" : "",
        isSelected ? "is-selected" : "",
        isWrong ? "is-wrong" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button
          type="button"
          class="${cls}"
          data-match-word="${idx}"
          draggable="${!isMatched}"
          ${isMatched ? "disabled" : ""}
        >
          <span>${idx + 1}. ${escapeHtml(it.word)}</span>
        </button>`;
    })
    .join("");

  const defsColHtml = items
    .map((it, idx) => {
      const isMatched = matchedDefIndices.has(idx);
      const isSelected = practiceState.matchSelectedDefIdx === idx;
      const isWrong = practiceState.matchWrongFlash?.defIdx === idx;
      const cls = [
        "match-item",
        isMatched ? "is-matched" : "",
        isSelected ? "is-selected" : "",
        isWrong ? "is-wrong" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button
          type="button"
          class="${cls}"
          data-match-def="${idx}"
          ${isMatched ? "disabled" : ""}
        >
          <span>${escapeHtml(it.definition)}</span>
        </button>`;
    })
    .join("");

  const fb = practiceState.matchFeedback;
  const fbHtml = fb ? renderFeedbackBannerHtml(fb.isCorrect, fb.word, fb.wordId) : "";

  return `
    <section class="panel page-stack" style="gap: var(--space-4)">
      <div class="panel-header" style="margin-bottom: 0">
        <p class="page-subtitle" style="margin: 0">${escapeHtml(I18N.practice.matchingInstr)}</p>
        <span class="badge badge-level tabular-nums">${escapeHtml(
          formatText(I18N.practice.matchingDoneCount, { done: matchedCount, total })
        )}</span>
      </div>
      <div class="matching-grid">
        <div class="matching-col">
          <div class="matching-col-title">${escapeHtml(I18N.practice.matchingColWords)}</div>
          ${wordsColHtml}
        </div>
        <div class="matching-col">
          <div class="matching-col-title">${escapeHtml(I18N.practice.matchingColDefs)}</div>
          ${defsColHtml}
        </div>
      </div>
      ${fbHtml}
    </section>
  `;
}

function renderSequentialStage() {
  const items = getCurrentItems();
  const total = items.length;
  if (!total) {
    return `<div class="panel state-box"><p>${escapeHtml(I18N.library.noResultsTitle)}</p></div>`;
  }

  if (practiceState.finished) {
    const percent = Math.round((practiceState.correctCount / total) * 100);
    return `
      <section class="panel state-box" aria-live="polite">
        <h2 class="page-title">${escapeHtml(I18N.practice.roundSummaryTitle)}</h2>
        <p class="tabular-nums">${escapeHtml(
          formatText(I18N.practice.roundSummaryScore, {
            correct: practiceState.correctCount,
            total,
            percent,
          })
        )}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-action="retry-mode">${escapeHtml(
            I18N.practice.retryRoundBtn
          )}</button>
          ${
            practiceState.practiceSet?.isGenerated
              ? `<button type="button" class="btn btn-secondary" data-action="regen-unit">${escapeHtml(
                  I18N.practice.newSetBtn
                )}</button>`
              : ""
          }
          <a class="btn btn-ghost" href="#/test">${escapeHtml(I18N.practice.goToTestBtn)}</a>
        </div>
      </section>
    `;
  }

  const item = items[practiceState.index];
  const currentNum = practiceState.index + 1;
  const pct = Math.round((currentNum / total) * 100);
  const nextLabel =
    currentNum === total ? I18N.practice.finishRoundBtn : I18N.practice.nextBtn;

  let bodyHtml = "";
  let actionHtml = "";

  if (practiceState.mode === "fill") {
    const bank = practiceState.practiceSet.B.word_bank || [];
    const filledSlot = `<span class="blank-slot">${escapeHtml(
      practiceState.selectedFillWord || "____"
    )}</span>`;
    const renderedSentence = escapeHtml(item.sentence).replace("____", filledSlot);

    bodyHtml = `
      <p class="page-subtitle" style="margin: 0">${escapeHtml(I18N.practice.fillInstr)}</p>
      <div class="sentence-prompt">${renderedSentence}</div>
      <div class="filter-group">
        <span class="filter-label">${escapeHtml(I18N.practice.wordBankLabel)}</span>
        <div class="word-bank">
          ${bank
            .map(
              (w) => `
            <button
              type="button"
              class="bank-chip ${practiceState.selectedFillWord === w ? "is-selected" : ""}"
              data-fill-word="${escapeHtml(w)}"
              ${practiceState.checked ? "disabled" : ""}
            >${escapeHtml(w)}</button>`
            )
            .join("")}
        </div>
      </div>
    `;
    actionHtml = practiceState.checked
      ? `<button type="button" id="ex-next-btn" class="btn btn-primary">${escapeHtml(
          nextLabel
        )} <kbd class="kbd-hint">Enter</kbd></button>`
      : `<button type="button" id="ex-check-btn" class="btn btn-primary" ${
          practiceState.selectedFillWord ? "" : "disabled"
        }>${escapeHtml(I18N.practice.checkBtn)} <kbd class="kbd-hint">Enter</kbd></button>`;
  } else if (practiceState.mode === "mcq") {
    bodyHtml = `
      <p class="page-subtitle" style="margin: 0">${escapeHtml(I18N.practice.mcqInstr)}</p>
      <div class="sentence-prompt">${escapeHtml(item.question)}</div>
      <div class="mcq-list" role="radiogroup" aria-label="${escapeHtml(I18N.practice.modeMcq)}">
        ${item.options
          .map((opt, oIdx) => {
            const isSelected = practiceState.selectedMcqOption === opt;
            const isRight = opt === item.answer;
            let cls = "mcq-option";
            if (practiceState.checked) {
              if (isRight) cls += " is-correct";
              else if (isSelected) cls += " is-wrong";
            } else if (isSelected) {
              cls += " is-selected";
            }
            return `
              <button
                type="button"
                class="${cls}"
                data-mcq-opt="${escapeHtml(opt)}"
                ${practiceState.checked ? "disabled" : ""}
              >
                <span>${escapeHtml(opt)}</span>
                <kbd class="kbd-hint">${oIdx + 1}</kbd>
              </button>`;
          })
          .join("")}
      </div>
    `;
    actionHtml = practiceState.checked
      ? `<button type="button" id="ex-next-btn" class="btn btn-primary">${escapeHtml(
          nextLabel
        )} <kbd class="kbd-hint">Enter</kbd></button>`
      : "";
  } else if (practiceState.mode === "unscramble") {
    const chosenSet = new Set(practiceState.unscrambleChosen);
    const chosenTilesHtml = practiceState.unscrambleChosen.length
      ? practiceState.unscrambleChosen
          .map((tileIdx, posIdx) => {
            const tile = practiceState.unscrambleTiles[tileIdx];
            return `
              <button
                type="button"
                class="letter-tile is-placed"
                data-unplace-pos="${posIdx}"
                ${practiceState.checked ? "disabled" : ""}
              >${escapeHtml(tile?.char || "")}</button>`;
          })
          .join("")
      : `<span class="page-subtitle" style="margin: 0">${escapeHtml(
          I18N.practice.unscrambleInstr
        )}</span>`;

    const trayHtml = practiceState.unscrambleTiles
      .map(
        (t) => `
        <button
          type="button"
          class="letter-tile"
          data-place-tile="${t.idx}"
          ${practiceState.checked || chosenSet.has(t.idx) ? "disabled" : ""}
        >${escapeHtml(t.char)}</button>`
      )
      .join("");

    bodyHtml = `
      <p class="page-subtitle" style="margin: 0">${escapeHtml(I18N.practice.unscrambleInstr)}</p>
      <div class="sentence-prompt">${escapeHtml(item.hint)}</div>
      <div class="tile-slots" aria-live="polite">${chosenTilesHtml}</div>
      <div class="tile-tray">${trayHtml}</div>
      <div class="btn-row" style="margin-top: 0">
        <button type="button" class="btn btn-secondary" id="unscramble-bksp-btn" ${
          practiceState.checked || !practiceState.unscrambleChosen.length ? "disabled" : ""
        }>${escapeHtml(I18N.practice.unscrambleBackspace)} <kbd class="kbd-hint">Bksp</kbd></button>
        <button type="button" class="btn btn-ghost" id="unscramble-clear-btn" ${
          practiceState.checked || !practiceState.unscrambleChosen.length ? "disabled" : ""
        }>${escapeHtml(I18N.practice.unscrambleClear)}</button>
      </div>
    `;
    actionHtml = practiceState.checked
      ? `<button type="button" id="ex-next-btn" class="btn btn-primary">${escapeHtml(
          nextLabel
        )} <kbd class="kbd-hint">Enter</kbd></button>`
      : `<button type="button" id="ex-check-btn" class="btn btn-primary" ${
          practiceState.unscrambleChosen.length ? "" : "disabled"
        }>${escapeHtml(I18N.practice.checkBtn)} <kbd class="kbd-hint">Enter</kbd></button>`;
  } else if (practiceState.mode === "listen") {
    const speechAvailable = isSpeechSupported();
    const audioControls = speechAvailable
      ? `
        <div class="btn-row" style="margin-top: 0">
          <button type="button" class="btn btn-primary" data-listen-play="1.0">
            ${iconVolume(18)}
            <span>${escapeHtml(I18N.practice.listenBtn)}</span>
            <kbd class="kbd-hint">R</kbd>
          </button>
          <button type="button" class="btn btn-secondary" data-listen-play="0.8">
            ${iconVolume(18)}
            <span>${escapeHtml(I18N.practice.listenSlowBtn)}</span>
          </button>
        </div>`
      : `<p class="study-tip-box">${escapeHtml(I18N.practice.listenNoSpeech)} (${escapeHtml(
          item.definition_en
        )})</p>`;

    bodyHtml = `
      <p class="page-subtitle" style="margin: 0">${escapeHtml(I18N.practice.listenInstr)}</p>
      ${audioControls}
      <div class="sentence-prompt">
        <strong>${escapeHtml(I18N.practice.listenHintLabel)}</strong> ${escapeHtml(
      item.hintSentence
    )}
      </div>
      <div>
        <label for="listen-answer-input" class="sr-only">${escapeHtml(
          I18N.practice.listenInputPlaceholder
        )}</label>
        <input
          id="listen-answer-input"
          class="text-answer-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="${escapeHtml(I18N.practice.listenInputPlaceholder)}"
          value="${escapeHtml(practiceState.listenInput)}"
          ${practiceState.checked ? "disabled" : ""}
        />
      </div>
    `;
    actionHtml = practiceState.checked
      ? `<button type="button" id="ex-next-btn" class="btn btn-primary">${escapeHtml(
          nextLabel
        )} <kbd class="kbd-hint">Enter</kbd></button>`
      : `<button type="button" id="ex-check-btn" class="btn btn-primary" ${
          practiceState.listenInput.trim() ? "" : "disabled"
        }>${escapeHtml(I18N.practice.checkBtn)} <kbd class="kbd-hint">Enter</kbd></button>`;
  }

  const answerText = practiceState.mode === "mcq" ? item.answer_word : item.answer;
  const feedbackHtml = practiceState.checked
    ? renderFeedbackBannerHtml(practiceState.lastIsCorrect, answerText, item.word_id)
    : "";

  return `
    <section class="panel page-stack" style="gap: var(--space-4)">
      <div class="flashcard-progress-bar">
        <div class="flashcard-progress-meta tabular-nums">
          <span>${escapeHtml(
            formatText(I18N.practice.questionCounter, { current: currentNum, total })
          )}</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%"></div>
        </div>
      </div>

      ${bodyHtml}
      ${feedbackHtml}
      <div class="btn-row" style="margin-top: 0">${actionHtml}</div>
    </section>
  `;
}

export function renderPracticeView(container, route) {
  const units = getUnitDirectory();
  const desiredUnitKey = resolveInitialUnitKey(route, units);
  if (!practiceState.practiceSet || practiceState.unitKey !== desiredUnitKey) {
    loadUnit(desiredUnitKey, practiceState.mode);
  }

  function render() {
    const ps = practiceState.practiceSet;
    const unit = ps.unitEntry;
    const sourceBadge = ps.isGenerated ? I18N.practice.generatedBadge : I18N.practice.bookBadge;

    const tipHtml = ps.studyTip
      ? `<div class="study-tip-box"><strong>${escapeHtml(
          I18N.library.unitStudyTipPrefix
        )}</strong> ${escapeHtml(ps.studyTip)}</div>`
      : "";

    const stageHtml =
      practiceState.mode === "matching" ? renderMatchingStage() : renderSequentialStage();

    container.innerHTML = `
      <div class="page-stack">
        <div class="page-header">
          <div>
            <h1 class="page-title">${escapeHtml(I18N.practice.title)}</h1>
            <div class="badge-row" style="margin-top: var(--space-1)">
              <span class="badge badge-level">${escapeHtml(
                formatUnitLabel(unit.level, unit.unit)
              )}</span>
              <span class="badge badge-source">${escapeHtml(sourceBadge)}</span>
            </div>
          </div>
          <a class="btn btn-secondary" href="#/test?unitKey=${encodeURIComponent(unit.key)}">${escapeHtml(
            I18N.practice.goToTestBtn
          )}</a>
        </div>

        <section class="panel page-stack" style="gap: var(--space-3)">
          <div class="flashcard-toolbar">
            <div class="control-field">
              <label for="pr-unit-select" class="filter-label">${escapeHtml(
                I18N.practice.unitLabel
              )}</label>
              <select id="pr-unit-select" class="control-select">
                ${units
                  .map(
                    (u) =>
                      `<option value="${escapeHtml(u.key)}" ${
                        u.key === unit.key ? "selected" : ""
                      }>${escapeHtml(
                        `${formatUnitLabel(u.level, u.unit)} · ${u.topic || u.title} (${
                          u.source === "book" ? I18N.library.sourceBook : I18N.library.sourceWordlist
                        })`
                      )}</option>`
                  )
                  .join("")}
              </select>
            </div>
          </div>

          <div class="chip-group" role="tablist" aria-label="${escapeHtml(I18N.practice.title)}">
            ${MODES.map(
              (m) => `
              <button
                type="button"
                role="tab"
                class="chip"
                data-practice-mode="${m.key}"
                aria-selected="${practiceState.mode === m.key}"
                aria-pressed="${practiceState.mode === m.key}"
              >${escapeHtml(m.label())}</button>`
            ).join("")}
          </div>
          ${tipHtml}
        </section>

        ${stageHtml}
      </div>
    `;

    bindEvents();
  }

  function evaluateSequentialAnswer() {
    if (practiceState.checked || practiceState.finished) return;
    const items = getCurrentItems();
    const item = items[practiceState.index];
    if (!item) return;

    let isCorrect = false;
    if (practiceState.mode === "fill") {
      if (!practiceState.selectedFillWord) return;
      isCorrect =
        normalizeAnswerText(practiceState.selectedFillWord) === normalizeAnswerText(item.answer);
    } else if (practiceState.mode === "mcq") {
      if (!practiceState.selectedMcqOption) return;
      isCorrect = practiceState.selectedMcqOption === item.answer;
    } else if (practiceState.mode === "unscramble") {
      if (!practiceState.unscrambleChosen.length) return;
      const formed = practiceState.unscrambleChosen
        .map((idx) => practiceState.unscrambleTiles[idx]?.char || "")
        .join("");
      isCorrect = normalizeLetters(formed) === normalizeLetters(item.answer);
    } else if (practiceState.mode === "listen") {
      if (!practiceState.listenInput.trim()) return;
      isCorrect =
        normalizeAnswerText(practiceState.listenInput) === normalizeAnswerText(item.answer);
    }

    practiceState.checked = true;
    practiceState.lastIsCorrect = isCorrect;
    practiceState.answeredCount += 1;
    if (isCorrect) practiceState.correctCount += 1;

    recordExerciseAnswer(item.word_id, isCorrect);
    render();
  }

  function advanceSequential() {
    const items = getCurrentItems();
    if (practiceState.index + 1 >= items.length) {
      practiceState.finished = true;
    } else {
      practiceState.index += 1;
      resetQuestionState();
    }
    render();
  }

  function tryMatchPair(wordIdx, defIdx) {
    const items = getCurrentItems();
    const wordItem = items[wordIdx];
    const defItem = items[defIdx];
    if (!wordItem || !defItem) return;

    const isCorrect = wordItem.answer === defItem.definition;
    const vocabWord = getWordById(wordItem.word_id);
    if (isCorrect) {
      practiceState.matchMatchedPairs[wordIdx] = defIdx;
      practiceState.matchSelectedWordIdx = null;
      practiceState.matchSelectedDefIdx = null;
      practiceState.matchWrongFlash = null;
      practiceState.matchFeedback = {
        isCorrect: true,
        word: wordItem.word,
        wordId: wordItem.word_id,
        meaningVi: vocabWord?.meaning_vi || "",
      };
      recordExerciseAnswer(wordItem.word_id, true);
    } else {
      practiceState.matchWrongCount += 1;
      practiceState.matchWrongFlash = { wordIdx, defIdx };
      practiceState.matchSelectedWordIdx = null;
      practiceState.matchSelectedDefIdx = null;
      practiceState.matchFeedback = {
        isCorrect: false,
        word: wordItem.word,
        wordId: wordItem.word_id,
        meaningVi: vocabWord?.meaning_vi || "",
      };
      recordExerciseAnswer(wordItem.word_id, false);
    }
    render();
  }

  function bindEvents() {
    container.querySelector("#pr-unit-select")?.addEventListener("change", (e) => {
      loadUnit(e.target.value, practiceState.mode);
      render();
    });

    container.querySelectorAll("[data-practice-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        startModeRound(btn.getAttribute("data-practice-mode"));
        render();
      });
    });

    container.querySelector('[data-action="retry-mode"]')?.addEventListener("click", () => {
      startModeRound(practiceState.mode);
      render();
    });

    container.querySelector('[data-action="regen-unit"]')?.addEventListener("click", () => {
      loadUnit(practiceState.unitKey, practiceState.mode);
      render();
    });

    // Matching tap + drag-and-drop
    container.querySelectorAll("[data-match-word]").forEach((btn) => {
      const wIdx = Number(btn.getAttribute("data-match-word"));
      btn.addEventListener("click", () => {
        if (practiceState.matchSelectedDefIdx !== null) {
          tryMatchPair(wIdx, practiceState.matchSelectedDefIdx);
        } else {
          practiceState.matchSelectedWordIdx =
            practiceState.matchSelectedWordIdx === wIdx ? null : wIdx;
          practiceState.matchWrongFlash = null;
          render();
        }
      });
      btn.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/plain", String(wIdx));
        practiceState.matchSelectedWordIdx = wIdx;
      });
    });

    container.querySelectorAll("[data-match-def]").forEach((btn) => {
      const dIdx = Number(btn.getAttribute("data-match-def"));
      btn.addEventListener("click", () => {
        if (practiceState.matchSelectedWordIdx !== null) {
          tryMatchPair(practiceState.matchSelectedWordIdx, dIdx);
        } else {
          practiceState.matchSelectedDefIdx =
            practiceState.matchSelectedDefIdx === dIdx ? null : dIdx;
          practiceState.matchWrongFlash = null;
          render();
        }
      });
      btn.addEventListener("dragover", (e) => {
        e.preventDefault();
        btn.classList.add("is-dragover");
      });
      btn.addEventListener("dragleave", () => {
        btn.classList.remove("is-dragover");
      });
      btn.addEventListener("drop", (e) => {
        e.preventDefault();
        btn.classList.remove("is-dragover");
        const raw = e.dataTransfer?.getData("text/plain");
        const wIdx = raw !== "" && raw !== undefined ? Number(raw) : practiceState.matchSelectedWordIdx;
        if (wIdx !== null && !Number.isNaN(wIdx)) {
          tryMatchPair(wIdx, dIdx);
        }
      });
    });

    // Fill-in
    container.querySelectorAll("[data-fill-word]").forEach((btn) => {
      btn.addEventListener("click", () => {
        practiceState.selectedFillWord = btn.getAttribute("data-fill-word");
        render();
      });
    });

    // MCQ
    container.querySelectorAll("[data-mcq-opt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        practiceState.selectedMcqOption = btn.getAttribute("data-mcq-opt");
        evaluateSequentialAnswer();
      });
    });

    // Unscramble
    container.querySelectorAll("[data-place-tile]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-place-tile"));
        if (!practiceState.unscrambleChosen.includes(idx)) {
          practiceState.unscrambleChosen.push(idx);
          render();
        }
      });
    });

    container.querySelectorAll("[data-unplace-pos]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const posIdx = Number(btn.getAttribute("data-unplace-pos"));
        practiceState.unscrambleChosen.splice(posIdx, 1);
        render();
      });
    });

    container.querySelector("#unscramble-bksp-btn")?.addEventListener("click", () => {
      practiceState.unscrambleChosen.pop();
      render();
    });

    container.querySelector("#unscramble-clear-btn")?.addEventListener("click", () => {
      practiceState.unscrambleChosen = [];
      render();
    });

    // Listen & Write
    const listenInputEl = container.querySelector("#listen-answer-input");
    listenInputEl?.addEventListener("input", () => {
      practiceState.listenInput = listenInputEl.value;
      const checkBtn = container.querySelector("#ex-check-btn");
      if (checkBtn) checkBtn.disabled = !practiceState.listenInput.trim();
    });

    container.querySelectorAll("[data-listen-play]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = getCurrentItems()[practiceState.index];
        if (item) speakText(item.word, Number(btn.getAttribute("data-listen-play")));
      });
    });

    container.querySelectorAll("[data-speak-text]").forEach((btn) => {
      btn.addEventListener("click", () => {
        speakText(btn.getAttribute("data-speak-text"));
      });
    });

    container.querySelector("#ex-check-btn")?.addEventListener("click", evaluateSequentialAnswer);
    container.querySelector("#ex-next-btn")?.addEventListener("click", advanceSequential);
  }

  const controller = new AbortController();
  document.addEventListener(
    "keydown",
    (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";

      if (event.key === "Enter" && practiceState.mode !== "matching" && !practiceState.finished) {
        if (tag === "select") return;
        event.preventDefault();
        if (practiceState.checked) advanceSequential();
        else evaluateSequentialAnswer();
        return;
      }

      if (isInput || practiceState.finished) return;

      if (practiceState.mode === "mcq" && !practiceState.checked && ["1", "2", "3", "4"].includes(event.key)) {
        const item = getCurrentItems()[practiceState.index];
        const opt = item?.options?.[Number(event.key) - 1];
        if (opt) {
          event.preventDefault();
          practiceState.selectedMcqOption = opt;
          evaluateSequentialAnswer();
        }
        return;
      }

      if (practiceState.mode === "unscramble" && !practiceState.checked) {
        if (event.key === "Backspace") {
          event.preventDefault();
          practiceState.unscrambleChosen.pop();
          render();
          return;
        }
        if (/^[a-zA-Z]$/.test(event.key)) {
          const ch = event.key.toUpperCase();
          const chosenSet = new Set(practiceState.unscrambleChosen);
          const matchTile = practiceState.unscrambleTiles.find(
            (t) => !chosenSet.has(t.idx) && t.char === ch
          );
          if (matchTile) {
            event.preventDefault();
            practiceState.unscrambleChosen.push(matchTile.idx);
            render();
          }
          return;
        }
      }

      if (practiceState.mode === "listen" && (event.key === "r" || event.key === "R")) {
        const item = getCurrentItems()[practiceState.index];
        if (item) {
          event.preventDefault();
          speakText(item.word);
        }
      }
    },
    { signal: controller.signal }
  );

  render();
  return () => controller.abort();
}
