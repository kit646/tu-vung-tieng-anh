/**
 * Màn hình Chi tiết từ (#/word/:id):
 * Hiển thị IPA, định nghĩa EN, nghĩa VI, tất cả câu ví dụ, nút phát âm (1.0x / 0.8x) và trạng thái SRS.
 */
import { I18N, formatText } from "../i18n.js";
import { iconArrowLeft, iconArrowRight, iconVolume } from "../icons.js";
import { parseRoute } from "../router.js";
import { isSpeechSupported, speakText } from "../speech.js";
import {
  getCachedData,
  getTodayIso,
  getWordById,
  getWordSrs,
  getWordsForUnit,
  markWordDueToday,
} from "../store.js";
import {
  escapeHtml,
  formatUnitLabel,
  renderSourceBadges,
  renderSrsBadge,
} from "../utils.js";

function formatDueText(srs) {
  if (!srs || srs.box === 0 || !srs.due) {
    return I18N.srs.notStarted;
  }
  const today = getTodayIso();
  if (srs.due <= today) {
    return I18N.srs.dueToday;
  }
  const diffMs = new Date(srs.due) - new Date(today);
  const diffDays = Math.max(1, Math.round(diffMs / 86400000));
  return formatText(I18N.srs.dueInDays, { days: diffDays });
}

function getSiblingContext(word, backHash) {
  let list = [];
  if (backHash && backHash.startsWith("#/library/")) {
    const backRoute = parseRoute(backHash);
    if (backRoute.name === "library-unit") {
      const source = backRoute.query.get("source") || "all";
      list = getWordsForUnit(backRoute.params.level, backRoute.params.unit, source);
    }
  }
  if (!list.length) {
    list = getWordsForUnit(word.level, word.unit, "all");
  }
  if (!list.length) {
    list = getCachedData()?.vocab || [];
  }
  const index = list.findIndex((item) => item.id === word.id);
  if (index === -1 || list.length <= 1) {
    return { prevWord: null, nextWord: null, index: 0, total: list.length };
  }
  return {
    prevWord: index > 0 ? list[index - 1] : null,
    nextWord: index < list.length - 1 ? list[index + 1] : null,
    index,
    total: list.length,
  };
}

function buildWordHref(wordId, backHash) {
  const backParam = backHash ? `?back=${encodeURIComponent(backHash)}` : "";
  return `#/word/${encodeURIComponent(wordId)}${backParam}`;
}

export function renderWordDetailView(container, route) {
  const word = getWordById(route.params.id);
  const backHash = route.query.get("back") || "#/library";

  if (!word) {
    container.innerHTML = `
      <div class="page-stack">
        <div>
          <a class="btn btn-ghost" href="#/library">
            ${iconArrowLeft(18)}
            <span>${escapeHtml(I18N.controls.backToLibrary)}</span>
          </a>
        </div>
        <div class="panel state-box">
          <h1 class="page-title">${escapeHtml(I18N.wordDetail.notFoundTitle)}</h1>
          <p>${escapeHtml(I18N.wordDetail.notFoundDesc)}</p>
          <a class="btn btn-primary" href="#/library">${escapeHtml(I18N.controls.backToLibrary)}</a>
        </div>
      </div>`;
    return;
  }

  const speechAvailable = isSpeechSupported();
  const srs = getWordSrs(word.id);
  const today = getTodayIso();
  const alreadyDue = Boolean(srs.due && srs.due <= today);
  const posText = I18N.posLabels[word.pos.toLowerCase()] || word.pos;
  const examples = word.examples?.length ? word.examples : [word.example];

  const backLabel = backHash.startsWith("#/library/")
    ? formatText(I18N.controls.backToUnit, {
        label: formatUnitLabel(word.level, word.unit),
      })
    : I18N.controls.backToLibrary;

  const { prevWord, nextWord, index, total } = getSiblingContext(word, backHash);
  const pagerHtml =
    total > 1
      ? `
        <nav class="word-pager" aria-label="${escapeHtml(I18N.wordDetail.nextWord)}">
          ${
            prevWord
              ? `<a id="word-prev-link" class="btn btn-secondary" href="${escapeHtml(
                  buildWordHref(prevWord.id, backHash)
                )}" title="${escapeHtml(prevWord.word)}">
                  ${iconArrowLeft(18)}
                  <span>${escapeHtml(I18N.wordDetail.prevWord)}</span>
                  <kbd class="kbd-hint">←</kbd>
                </a>`
              : `<button type="button" id="word-prev-link" class="btn btn-secondary" disabled>
                  ${iconArrowLeft(18)}
                  <span>${escapeHtml(I18N.wordDetail.prevWord)}</span>
                </button>`
          }
          <span class="word-pager-count tabular-nums">${escapeHtml(
            formatText(I18N.wordDetail.wordPosition, { current: index + 1, total })
          )}</span>
          ${
            nextWord
              ? `<a id="word-next-link" class="btn btn-secondary" href="${escapeHtml(
                  buildWordHref(nextWord.id, backHash)
                )}" title="${escapeHtml(nextWord.word)}">
                  <span>${escapeHtml(I18N.wordDetail.nextWord)}</span>
                  <kbd class="kbd-hint">→</kbd>
                  ${iconArrowRight(18)}
                </a>`
              : `<button type="button" id="word-next-link" class="btn btn-secondary" disabled>
                  <span>${escapeHtml(I18N.wordDetail.nextWord)}</span>
                  ${iconArrowRight(18)}
                </button>`
          }
        </nav>`
      : "";

  const audioButtonsHtml = speechAvailable
    ? `
      <div class="badge-row">
        <button type="button" class="btn btn-primary" data-speak-word="1.0" aria-label="${escapeHtml(
          formatText(I18N.controls.speakWord, { word: word.word })
        )}">
          ${iconVolume(18)}
          <span>${escapeHtml(I18N.controls.speakNormal)}</span>
          <kbd class="kbd-hint">R</kbd>
        </button>
        <button type="button" class="btn btn-secondary" data-speak-word="0.8">
          ${iconVolume(18)}
          <span>${escapeHtml(I18N.controls.speakSlow)}</span>
        </button>
      </div>`
    : "";

  const bookExtraHtml =
    word.book_definition_en && word.book_definition_en !== word.definition_en
      ? `
      <div class="detail-block">
        <div class="detail-label">${escapeHtml(I18N.wordDetail.bookNoteLabel)} (${escapeHtml(
          formatUnitLabel(word.book_level, word.book_unit)
        )})</div>
        <p>${escapeHtml(word.book_definition_en)}</p>
        ${
          word.book_definition_vi
            ? `<p class="translation-vi">${escapeHtml(word.book_definition_vi)}</p>`
            : ""
        }
      </div>`
      : "";

  container.innerHTML = `
    <div class="page-stack">
      <div class="word-nav-bar">
        <a id="word-back-link" class="btn btn-ghost" href="${escapeHtml(backHash)}">
          ${iconArrowLeft(18)}
          <span>${escapeHtml(backLabel)}</span>
          <kbd class="kbd-hint">Esc</kbd>
        </a>
        ${pagerHtml}
      </div>

      <div class="word-detail-grid">
        <article class="panel">
          <div class="badge-row">
            <span class="badge badge-level">${escapeHtml(
              formatUnitLabel(word.level, word.unit)
            )}</span>
            <span class="badge badge-pos">${escapeHtml(word.topic)}</span>
            ${renderSourceBadges(word)}
          </div>

          <div class="word-hero-head">
            <div>
              <h1 class="word-hero-title">${escapeHtml(word.word)}</h1>
              <div class="badge-row" style="margin-top: var(--space-2)">
                <span class="badge badge-pos">${escapeHtml(posText)}</span>
                ${
                  word.ipa
                    ? `<span class="ipa-text">/${escapeHtml(word.ipa)}/</span>`
                    : ""
                }
              </div>
            </div>
            ${audioButtonsHtml}
          </div>

          <div class="meaning-highlight">
            <div class="meaning-highlight-label">${escapeHtml(I18N.wordDetail.meaningViLabel)}</div>
            <div class="meaning-highlight-text">${escapeHtml(word.meaning_vi)}</div>
          </div>

          <div class="detail-block">
            <div class="detail-label">${escapeHtml(I18N.wordDetail.definitionEnLabel)}</div>
            <p>${escapeHtml(word.definition_en)}</p>
            ${
              word.definition_vi
                ? `<p class="translation-vi">${escapeHtml(word.definition_vi)}</p>`
                : ""
            }
          </div>
          ${bookExtraHtml}

          <div class="detail-block">
            <div class="detail-label">${escapeHtml(
              formatText(I18N.wordDetail.examplesLabel, { count: examples.length })
            )}</div>
            <ul class="example-list">
              ${examples
                .map((ex, idx) => {
                  const exVi = word.examples_vi?.[idx] || "";
                  return `
                <li class="example-item">
                  <div class="example-text-group">
                    <span class="example-sentence">${escapeHtml(ex)}</span>
                    ${exVi ? `<span class="translation-vi">${escapeHtml(exVi)}</span>` : ""}
                  </div>
                  ${
                    speechAvailable
                      ? `<button type="button" class="btn-icon" data-speak-example="${escapeHtml(
                          ex
                        )}" aria-label="${escapeHtml(I18N.controls.speakExample)}">${iconVolume(
                          18
                        )}</button>`
                      : ""
                  }
                </li>`;
                })
                .join("")}
            </ul>
          </div>
        </article>

        <aside class="panel" aria-labelledby="srs-status-heading">
          <div class="panel-header">
            <h2 id="srs-status-heading" class="section-title">${escapeHtml(
              I18N.wordDetail.srsCardTitle
            )}</h2>
            ${renderSrsBadge(word.id)}
          </div>

          <div class="page-stack" style="gap: var(--space-2)">
            <p class="tabular-nums">${escapeHtml(
              formatText(I18N.srs.boxLabel, { box: srs.box })
            )}</p>
            <p class="tabular-nums">${escapeHtml(formatDueText(srs))}</p>
            <p class="tabular-nums">${escapeHtml(
              formatText(I18N.srs.lapsesLabel, { count: srs.lapses || 0 })
            )}</p>
          </div>

          <div class="btn-row">
            <button
              type="button"
              id="queue-review-btn"
              class="btn ${alreadyDue ? "btn-secondary" : "btn-primary"}"
              ${alreadyDue ? "disabled" : ""}
            >
              ${escapeHtml(
                alreadyDue ? I18N.wordDetail.alreadyDue : I18N.wordDetail.queueForReview
              )}
            </button>
            <a class="btn btn-secondary" href="#/flashcards">
              ${escapeHtml(I18N.wordDetail.practiceInFlashcards)}
            </a>
          </div>
        </aside>
      </div>
    </div>
  `;

  container.querySelectorAll("[data-speak-word]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rate = Number(btn.getAttribute("data-speak-word"));
      speakText(word.word, rate);
    });
  });

  container.querySelectorAll("[data-speak-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      speakText(btn.getAttribute("data-speak-example"));
    });
  });

  const queueBtn = container.querySelector("#queue-review-btn");
  queueBtn?.addEventListener("click", () => {
    markWordDueToday(word.id);
    renderWordDetailView(container, route);
  });
}
