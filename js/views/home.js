/**
 * Màn hình Trang chủ (#/home): số từ cần ôn hôm nay, streak, nút "Học ngay", tổng quan và lối tắt.
 */
import { I18N, formatText } from "../i18n.js";
import { iconArrowRight, iconAward, iconBook, iconCheckSquare, iconFlame } from "../icons.js";
import {
  getDueWords,
  getOverallStats,
  getStreak,
  getUnitDirectory,
  getUnitStats,
  getWeakWords,
} from "../store.js";
import { escapeHtml, formatUnitLabel } from "../utils.js";

export function renderHomeView(container) {
  const dueWords = getDueWords();
  const weakWords = getWeakWords();
  const streak = getStreak();
  const stats = getOverallStats();
  const units = getUnitDirectory();

  const dueCount = dueWords.length;
  const estMinutes = Math.max(1, Math.ceil(Math.min(dueCount || 10, 20) * 0.35));
  const masteredPct = stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0;
  const learningPct = stats.total ? Math.round((stats.learning / stats.total) * 100) : 0;

  const streakLabel =
    streak.count > 0
      ? formatText(I18N.home.streakDays, { count: streak.count })
      : I18N.home.streakZero;

  const dueWeakInQueue = dueWords.filter((w) => weakWords.some((wk) => wk.id === w.id)).length;

  const dueBlockHtml =
    dueCount > 0
      ? `
      <h2 class="section-title">${escapeHtml(I18N.home.dueTitle)}</h2>
      <div class="due-figure">
        <span class="stat-value-lg tabular-nums">${dueCount}</span>
        <span>${escapeHtml(formatText(I18N.home.dueCount, { count: dueCount }).replace(String(dueCount), "").trim())}</span>
      </div>
      <p class="page-subtitle">
        ${escapeHtml(formatText(I18N.home.dueTimeEstimate, { minutes: estMinutes }))}
        ${dueWeakInQueue > 0 ? ` · ${escapeHtml(formatText(I18N.home.dueWeakHint, { count: dueWeakInQueue }))}` : ""}
      </p>
      <div class="btn-row">
        <a class="btn btn-primary" href="#/flashcards">
          ${escapeHtml(formatText(I18N.home.startStudy, { count: dueCount }))}
        </a>
        <a class="btn btn-secondary" href="#/library">
          ${escapeHtml(I18N.home.browseLibrary)}
        </a>
      </div>`
      : `
      <h2 class="section-title">${escapeHtml(I18N.home.dueAllDoneTitle)}</h2>
      <p class="page-subtitle">${escapeHtml(I18N.home.dueAllDoneDesc)}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="#/flashcards">
          ${escapeHtml(I18N.home.studyNewBatch)}
        </a>
        <a class="btn btn-secondary" href="#/library">
          ${escapeHtml(I18N.home.browseLibrary)}
        </a>
      </div>`;

  const featuredUnits = units.slice(0, 6);

  container.innerHTML = `
    <div class="page-stack">
      <div class="page-header">
        <div>
          <h1 class="page-title">${escapeHtml(I18N.nav.home)}</h1>
          <p class="page-subtitle">${escapeHtml(I18N.home.greeting)}</p>
        </div>
        <div class="badge badge-streak tabular-nums">
          ${iconFlame(16)}
          <span>${escapeHtml(streakLabel)}</span>
        </div>
      </div>

      <section class="home-grid" aria-label="${escapeHtml(I18N.home.dueTitle)}">
        <article class="panel-hero">
          ${dueBlockHtml}
        </article>

        <article class="panel">
          <div class="panel-header">
            <h2 class="section-title">${escapeHtml(formatText(I18N.home.overviewTitle, { total: stats.total }))}</h2>
            <span class="badge badge-srs-mastered tabular-nums">${masteredPct}%</span>
          </div>
          <div class="progress-track" role="progressbar" aria-valuenow="${masteredPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(I18N.home.mastered)}">
            <div class="progress-fill progress-fill-mastered" style="width: ${masteredPct}%"></div>
            <div class="progress-fill progress-fill-learning" style="width: ${learningPct}%"></div>
          </div>
          <div class="stat-row">
            <div class="stat-cell">
              <div class="stat-cell-num tabular-nums">${stats.mastered}</div>
              <div class="stat-cell-label">${escapeHtml(I18N.home.mastered)}</div>
            </div>
            <div class="stat-cell">
              <div class="stat-cell-num tabular-nums">${stats.learning}</div>
              <div class="stat-cell-label">${escapeHtml(I18N.home.learning)}</div>
            </div>
            <div class="stat-cell">
              <div class="stat-cell-num tabular-nums">${stats.newCount}</div>
              <div class="stat-cell-label">${escapeHtml(I18N.home.newWords)}</div>
            </div>
          </div>
          <a class="btn btn-ghost" href="#/progress">
            <span>${escapeHtml(I18N.home.viewProgress)}</span>
            ${iconArrowRight(16)}
          </a>
        </article>
      </section>

      <section aria-labelledby="quick-actions-heading">
        <div class="panel-header">
          <h2 id="quick-actions-heading" class="section-title">${escapeHtml(I18N.home.quickActionsTitle)}</h2>
        </div>
        <div class="action-grid">
          <a class="action-link" href="#/practice">
            <div>
              <div class="action-link-title">${escapeHtml(I18N.home.actionPracticeTitle)}</div>
              <div class="action-link-meta">${escapeHtml(I18N.home.actionPracticeDesc)}</div>
            </div>
            ${iconCheckSquare(20)}
          </a>
          <a class="action-link" href="#/test">
            <div>
              <div class="action-link-title">${escapeHtml(I18N.home.actionTestTitle)}</div>
              <div class="action-link-meta">${escapeHtml(I18N.home.actionTestDesc)}</div>
            </div>
            ${iconAward(20)}
          </a>
          <a class="action-link" href="#/flashcards?mode=weak">
            <div>
              <div class="action-link-title">${escapeHtml(I18N.home.actionWeakTitle)}</div>
              <div class="action-link-meta">${escapeHtml(
                weakWords.length
                  ? formatText(I18N.home.actionWeakCount, { count: weakWords.length })
                  : I18N.home.actionWeakEmpty
              )}</div>
            </div>
            ${iconBook(20)}
          </a>
        </div>
      </section>

      <section aria-labelledby="featured-units-heading">
        <div class="panel-header">
          <h2 id="featured-units-heading" class="section-title">${escapeHtml(I18N.home.featuredUnitsTitle)}</h2>
          <a class="btn btn-ghost" href="#/library">
            <span>${escapeHtml(I18N.home.seeAllUnits)}</span>
            ${iconArrowRight(16)}
          </a>
        </div>
        <div class="unit-grid">
          ${featuredUnits
            .map((u) => {
              const uStats = getUnitStats(u.words);
              const sourceLabel =
                u.source === "book" ? I18N.library.sourceBook : I18N.library.sourceWordlist;
              return `
              <a class="unit-item" href="#/library/${u.level}/${u.unit}?source=${u.source}">
                <div class="unit-item-top">
                  <span class="badge badge-level">${escapeHtml(formatUnitLabel(u.level, u.unit))}</span>
                  <span class="badge badge-pos">${escapeHtml(sourceLabel)}</span>
                </div>
                <div class="unit-item-title">${escapeHtml(u.topic || u.title)}</div>
                <div class="unit-item-meta tabular-nums">${escapeHtml(
                  formatText(I18N.library.unitWordCount, { count: u.words.length })
                )} · ${escapeHtml(
                  formatText(I18N.library.unitLearnedCount, {
                    learned: uStats.learned,
                    total: uStats.total,
                  })
                )}</div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: ${uStats.percent}%"></div>
                </div>
              </a>`;
            })
            .join("")}
        </div>
      </section>
    </div>
  `;
}
