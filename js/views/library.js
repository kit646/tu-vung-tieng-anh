/**
 * Màn hình Thư viện (#/library và #/library/:level/:unit):
 * Duyệt theo Level/Nguồn -> Unit -> danh sách từ, tìm kiếm không phân biệt hoa thường, lọc từ loại.
 */
import { I18N, formatText } from "../i18n.js";
import { iconArrowLeft, iconClose, iconSearch, iconVolume } from "../icons.js";
import { isSpeechSupported, speakText } from "../speech.js";
import {
  getUnitDirectory,
  getUnitMeta,
  getUnitStats,
  getWordsForUnit,
  searchAndFilterWords,
} from "../store.js";
import {
  escapeHtml,
  formatUnitLabel,
  renderSourceBadges,
  renderSrsBadge,
} from "../utils.js";

const libraryState = {
  query: "",
  sourceGroup: "all",
  pos: "all",
  viewMode: "units",
};

const SOURCE_FILTERS = [
  { value: "all", label: () => I18N.library.sourceAll },
  { value: "book-a1", label: () => I18N.library.sourceA1Book },
  { value: "wordlist-a2", label: () => I18N.library.sourceA2Wordlist },
  { value: "book-a2", label: () => I18N.library.sourceA2Book },
];

const POS_FILTERS = [
  { value: "all", label: () => I18N.library.posAll },
  { value: "noun", label: () => "noun" },
  { value: "verb", label: () => "verb" },
  { value: "adj", label: () => "adj" },
  { value: "adv", label: () => "adv" },
  { value: "phrase", label: () => "phrase" },
  { value: "prep", label: () => "prep" },
  { value: "interj", label: () => "interj" },
];

function matchesPos(word, posFilter) {
  if (posFilter === "all") return true;
  const p = word.pos.toLowerCase();
  if (posFilter === "noun") return p === "noun" || p === "plural noun";
  if (posFilter === "prep") return p === "prep" || p === "preposition";
  return p === posFilter;
}

function renderWordListHtml(words, backHash) {
  if (!words.length) {
    return `
      <div class="panel state-box">
        <h2 class="section-title">${escapeHtml(I18N.library.noResultsTitle)}</h2>
        <p>${escapeHtml(I18N.library.noResultsDesc)}</p>
        <button type="button" class="btn btn-secondary" data-action="reset-filters">
          ${escapeHtml(I18N.library.resetFilters)}
        </button>
      </div>`;
  }

  const speechAvailable = isSpeechSupported();
  const rows = words
    .map((w) => {
      const ipaHtml = w.ipa ? `<span class="ipa-text">/${escapeHtml(w.ipa)}/</span>` : "";
      const speakBtn = speechAvailable
        ? `<button type="button" class="btn-icon" data-speak="${escapeHtml(w.word)}" aria-label="${escapeHtml(
            formatText(I18N.controls.speakWord, { word: w.word })
          )}">${iconVolume(18)}</button>`
        : "";
      const backParam = backHash ? `?back=${encodeURIComponent(backHash)}` : "";
      return `
        <li class="word-row">
          <a class="word-row-main" href="#/word/${encodeURIComponent(w.id)}${backParam}">
            <div class="word-row-top">
              <span class="word-headword">${escapeHtml(w.word)}</span>
              <span class="badge badge-pos">${escapeHtml(w.pos)}</span>
              ${ipaHtml}
              ${renderSourceBadges(w)}
            </div>
            <div class="word-meaning-vi">${escapeHtml(w.meaning_vi)}</div>
          </a>
          <div class="word-row-actions">
            ${renderSrsBadge(w.id)}
            ${speakBtn}
          </div>
        </li>`;
    })
    .join("");

  return `
    <div class="panel">
      <div class="panel-header">
        <span class="unit-item-meta tabular-nums">${escapeHtml(
          formatText(I18N.library.resultsCount, { count: words.length })
        )}</span>
      </div>
      <ul class="word-list">${rows}</ul>
    </div>`;
}

function renderUnitGridHtml(units) {
  if (!units.length) {
    return `
      <div class="panel state-box">
        <h2 class="section-title">${escapeHtml(I18N.library.noResultsTitle)}</h2>
        <p>${escapeHtml(I18N.library.noResultsDesc)}</p>
      </div>`;
  }

  return `
    <div class="unit-grid">
      ${units
        .map((u) => {
          const stats = getUnitStats(u.words);
          const srcLabel =
            u.source === "book" ? I18N.library.sourceBook : I18N.library.sourceWordlist;
          return `
            <a class="unit-item" href="#/library/${u.level}/${u.unit}?source=${u.source}">
              <div class="unit-item-top">
                <span class="badge badge-level">${escapeHtml(formatUnitLabel(u.level, u.unit))}</span>
                <span class="badge badge-pos">${escapeHtml(srcLabel)}</span>
              </div>
              <div class="unit-item-title">${escapeHtml(u.topic || u.title)}</div>
              <div class="unit-item-meta tabular-nums">${escapeHtml(
                formatText(I18N.library.unitWordCount, { count: u.words.length })
              )} · ${escapeHtml(
                formatText(I18N.library.unitLearnedCount, {
                  learned: stats.learned,
                  total: stats.total,
                })
              )}</div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${stats.percent}%"></div>
              </div>
            </a>`;
        })
        .join("")}
    </div>`;
}

function attachSpeakHandlers(root) {
  root.querySelectorAll("[data-speak]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      speakText(btn.getAttribute("data-speak"));
    });
  });
}

export function renderLibraryView(container, route) {
  if (route.name === "library-unit") {
    renderLibraryUnitDetail(container, route);
    return;
  }

  const allUnits = getUnitDirectory();
  const totalWords = allUnits.reduce((acc, u) => acc + u.words.length, 0);

  container.innerHTML = `
    <div class="page-stack">
      <div class="page-header">
        <div>
          <h1 class="page-title">${escapeHtml(I18N.library.title)}</h1>
          <p class="page-subtitle">${escapeHtml(
            formatText(I18N.library.subtitle, { total: 362 || totalWords })
          )}</p>
        </div>
        <div class="chip-group" role="group" aria-label="${escapeHtml(I18N.library.viewModeLabel)}">
          <button type="button" class="chip" data-view-mode="units" aria-pressed="${
            libraryState.viewMode === "units"
          }">${escapeHtml(I18N.library.viewByUnits)}</button>
          <button type="button" class="chip" data-view-mode="words" aria-pressed="${
            libraryState.viewMode === "words"
          }">${escapeHtml(formatText(I18N.library.viewAllWords, { count: 362 }))}</button>
        </div>
      </div>

      <section class="panel" aria-label="${escapeHtml(I18N.library.searchLabel)}">
        <div class="page-stack" style="gap: var(--space-4)">
          <div class="search-box">
            <span class="search-icon">${iconSearch(18)}</span>
            <label for="library-search-input" class="sr-only">${escapeHtml(
              I18N.library.searchLabel
            )}</label>
            <input
              id="library-search-input"
              class="search-input"
              type="search"
              autocomplete="off"
              placeholder="${escapeHtml(I18N.library.searchPlaceholder)}"
              value="${escapeHtml(libraryState.query)}"
            />
            <kbd class="kbd-hint search-kbd">/</kbd>
            <button
              type="button"
              id="library-search-clear"
              class="search-clear"
              aria-label="${escapeHtml(I18N.library.clearSearch)}"
              ${libraryState.query ? "" : "hidden"}
            >${iconClose(16)}</button>
          </div>

          <div class="filter-group">
            <span class="filter-label">${escapeHtml(I18N.library.filterSourceLabel)}</span>
            <div class="chip-group" role="group" aria-label="${escapeHtml(
              I18N.library.filterSourceLabel
            )}">
              ${SOURCE_FILTERS.map(
                (f) =>
                  `<button type="button" class="chip" data-source-filter="${
                    f.value
                  }" aria-pressed="${libraryState.sourceGroup === f.value}">${escapeHtml(
                    f.label()
                  )}</button>`
              ).join("")}
            </div>
          </div>

          <div class="filter-group">
            <span class="filter-label">${escapeHtml(I18N.library.filterPosLabel)}</span>
            <div class="chip-group" role="group" aria-label="${escapeHtml(
              I18N.library.filterPosLabel
            )}">
              ${POS_FILTERS.map(
                (f) =>
                  `<button type="button" class="chip" data-pos-filter="${f.value}" aria-pressed="${
                    libraryState.pos === f.value
                  }">${escapeHtml(f.label())}</button>`
              ).join("")}
            </div>
          </div>
        </div>
      </section>

      <section id="library-results" aria-live="polite"></section>
    </div>
  `;

  const searchInput = container.querySelector("#library-search-input");
  const clearBtn = container.querySelector("#library-search-clear");
  const resultsEl = container.querySelector("#library-results");

  function updateResults() {
    const hasActiveWordFilter =
      libraryState.query.trim().length > 0 ||
      libraryState.pos !== "all" ||
      libraryState.viewMode === "words";

    if (clearBtn) {
      clearBtn.hidden = !libraryState.query;
    }

    if (hasActiveWordFilter) {
      const matched = searchAndFilterWords({
        query: libraryState.query,
        sourceGroup: libraryState.sourceGroup,
        pos: libraryState.pos,
      });
      resultsEl.innerHTML = renderWordListHtml(matched, "#/library");
    } else {
      const filteredUnits =
        libraryState.sourceGroup === "all"
          ? allUnits
          : allUnits.filter((u) => u.sourceGroup === libraryState.sourceGroup);
      resultsEl.innerHTML = renderUnitGridHtml(filteredUnits);
    }

    attachSpeakHandlers(resultsEl);
    resultsEl.querySelector('[data-action="reset-filters"]')?.addEventListener("click", () => {
      libraryState.query = "";
      libraryState.sourceGroup = "all";
      libraryState.pos = "all";
      renderLibraryView(container, route);
    });
  }

  searchInput.addEventListener("input", () => {
    libraryState.query = searchInput.value;
    updateResults();
  });

  clearBtn.addEventListener("click", () => {
    libraryState.query = "";
    searchInput.value = "";
    searchInput.focus();
    updateResults();
  });

  container.querySelectorAll("[data-source-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      libraryState.sourceGroup = btn.getAttribute("data-source-filter");
      container.querySelectorAll("[data-source-filter]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      updateResults();
    });
  });

  container.querySelectorAll("[data-pos-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      libraryState.pos = btn.getAttribute("data-pos-filter");
      container.querySelectorAll("[data-pos-filter]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      updateResults();
    });
  });

  container.querySelectorAll("[data-view-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      libraryState.viewMode = btn.getAttribute("data-view-mode");
      container.querySelectorAll("[data-view-mode]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      updateResults();
    });
  });

  updateResults();
}

function renderLibraryUnitDetail(container, route) {
  const { level, unit } = route.params;
  const sourceFilter = route.query.get("source") || "all";
  const meta = getUnitMeta(level, unit, sourceFilter);
  const unitWords = getWordsForUnit(level, unit, sourceFilter);
  const unitStats = getUnitStats(unitWords);

  let localQuery = "";
  let localPos = "all";
  const currentHash = `#/library/${level}/${unit}${
    sourceFilter !== "all" ? `?source=${encodeURIComponent(sourceFilter)}` : ""
  }`;

  const tipHtml = meta.studyTip
    ? `<div class="study-tip-box"><strong>${escapeHtml(
        I18N.library.unitStudyTipPrefix
      )}</strong> ${escapeHtml(meta.studyTip)}</div>`
    : "";

  container.innerHTML = `
    <div class="page-stack">
      <div>
        <a class="btn btn-ghost" href="#/library">
          ${iconArrowLeft(18)}
          <span>${escapeHtml(I18N.controls.backToLibrary)}</span>
        </a>
      </div>

      <section class="panel">
        <div class="badge-row" style="margin-bottom: var(--space-2)">
          <span class="badge badge-level">${escapeHtml(formatUnitLabel(level, unit))}</span>
          <span class="badge badge-pos tabular-nums">${escapeHtml(
            formatText(I18N.library.unitWordCount, { count: unitWords.length })
          )}</span>
        </div>
        <h1 class="page-title">${escapeHtml(meta.topic || meta.title)}</h1>
        <p class="page-subtitle tabular-nums">${escapeHtml(
          formatText(I18N.library.unitLearnedCount, {
            learned: unitStats.learned,
            total: unitStats.total,
          })
        )} (${unitStats.percent}%)</p>
        <div class="progress-track" style="margin-top: var(--space-3)">
          <div class="progress-fill" style="width: ${unitStats.percent}%"></div>
        </div>
        ${tipHtml}
        <div class="btn-row">
          <a class="btn btn-primary" href="#/flashcards?level=${encodeURIComponent(
            level
          )}&unit=${unit}">${escapeHtml(I18N.library.unitFlashcardsBtn)}</a>
          <a class="btn btn-secondary" href="#/practice?level=${encodeURIComponent(
            level
          )}&unit=${unit}">${escapeHtml(I18N.library.unitPracticeBtn)}</a>
        </div>
      </section>

      <section class="panel" aria-label="${escapeHtml(I18N.library.searchLabel)}">
        <div class="page-stack" style="gap: var(--space-3)">
          <div class="search-box">
            <span class="search-icon">${iconSearch(18)}</span>
            <label for="library-search-input" class="sr-only">${escapeHtml(
              I18N.library.searchLabel
            )}</label>
            <input
              id="library-search-input"
              class="search-input"
              type="search"
              autocomplete="off"
              placeholder="${escapeHtml(I18N.library.searchPlaceholder)}"
            />
            <kbd class="kbd-hint search-kbd">/</kbd>
            <button
              type="button"
              id="library-search-clear"
              class="search-clear"
              aria-label="${escapeHtml(I18N.library.clearSearch)}"
              hidden
            >${iconClose(16)}</button>
          </div>

          <div class="chip-group" role="group" aria-label="${escapeHtml(
            I18N.library.filterPosLabel
          )}">
            ${POS_FILTERS.map(
              (f) =>
                `<button type="button" class="chip" data-unit-pos="${f.value}" aria-pressed="${
                  f.value === "all"
                }">${escapeHtml(f.label())}</button>`
            ).join("")}
          </div>
        </div>
      </section>

      <section id="unit-word-results" aria-live="polite"></section>
    </div>
  `;

  const searchInput = container.querySelector("#library-search-input");
  const clearBtn = container.querySelector("#library-search-clear");
  const resultsEl = container.querySelector("#unit-word-results");

  function updateUnitResults() {
    const q = localQuery.trim().toLowerCase();
    clearBtn.hidden = !localQuery;
    const filtered = unitWords.filter((w) => {
      if (!matchesPos(w, localPos)) return false;
      if (!q) return true;
      return (
        w.word.toLowerCase().includes(q) ||
        w.meaning_vi.toLowerCase().includes(q) ||
        w.definition_en.toLowerCase().includes(q)
      );
    });
    resultsEl.innerHTML = renderWordListHtml(filtered, currentHash);
    attachSpeakHandlers(resultsEl);
    resultsEl.querySelector('[data-action="reset-filters"]')?.addEventListener("click", () => {
      localQuery = "";
      localPos = "all";
      searchInput.value = "";
      container.querySelectorAll("[data-unit-pos]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-unit-pos") === "all"));
      });
      updateUnitResults();
    });
  }

  searchInput.addEventListener("input", () => {
    localQuery = searchInput.value;
    updateUnitResults();
  });

  clearBtn.addEventListener("click", () => {
    localQuery = "";
    searchInput.value = "";
    searchInput.focus();
    updateUnitResults();
  });

  container.querySelectorAll("[data-unit-pos]").forEach((btn) => {
    btn.addEventListener("click", () => {
      localPos = btn.getAttribute("data-unit-pos");
      container.querySelectorAll("[data-unit-pos]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      updateUnitResults();
    });
  });

  updateUnitResults();
}
