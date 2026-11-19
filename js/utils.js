/**
 * Tiện ích HTML an toàn và hiển thị badge/trạng thái dùng chung.
 */
import { I18N, formatText } from "./i18n.js";
import { getWordSrs, getWordStatus } from "./store.js";

const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

export function renderSrsBadge(wordId) {
  const srs = getWordSrs(wordId);
  const status = getWordStatus(srs);
  if (status === "mastered") {
    return `<span class="badge badge-srs-mastered">${escapeHtml(I18N.srs.mastered)}</span>`;
  }
  if (status === "learning") {
    return `<span class="badge badge-srs-learning">${escapeHtml(I18N.srs.learning)}</span>`;
  }
  return `<span class="badge badge-srs-new">${escapeHtml(I18N.srs.new)}</span>`;
}

export function renderSourceBadges(word) {
  const badges = [];
  if (word.sources.length > 1) {
    badges.push(`<span class="badge badge-source">${escapeHtml(I18N.library.mergedBadge)}</span>`);
  } else if (word.source === "book") {
    badges.push(`<span class="badge badge-source">${escapeHtml(I18N.library.sourceBook)}</span>`);
  } else {
    badges.push(`<span class="badge badge-source">${escapeHtml(I18N.library.sourceWordlist)}</span>`);
  }
  return badges.join("");
}

export function formatUnitLabel(level, unit) {
  return formatText(I18N.library.unitTitleFormat, { level, unit });
}
