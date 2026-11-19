/**
 * Điểm vào chính của ứng dụng: khởi tạo theme, điều hướng, speech và render các màn hình.
 */
import { I18N } from "./i18n.js";
import {
  iconAward,
  iconBarChart,
  iconBook,
  iconCards,
  iconCheckSquare,
  iconHome,
  iconMoon,
  iconSun,
  iconSync,
} from "./icons.js";
import { navigateTo, startRouter } from "./router.js";
import { initSpeech, isSpeechSupported } from "./speech.js";
import { getSettings, getSyncConfig, loadAppData, updateSettings } from "./store.js";
import { initAutoSync, onSyncStatusChange, syncWithGist } from "./sync.js";
import { escapeHtml } from "./utils.js";
import { renderFlashcardsView } from "./views/flashcards.js";
import { renderHomeView } from "./views/home.js";
import { renderLibraryView } from "./views/library.js";
import { renderPracticeView } from "./views/practice.js";
import { renderProgressView } from "./views/progress.js";
import { renderTestView } from "./views/test.js";
import { renderWordDetailView } from "./views/word.js";

const DESKTOP_NAV_ITEMS = [
  { key: "home", href: "#/home", label: () => I18N.nav.home },
  { key: "library", href: "#/library", label: () => I18N.nav.library },
  { key: "flashcards", href: "#/flashcards", label: () => I18N.nav.flashcards },
  { key: "practice", href: "#/practice", label: () => I18N.nav.practice },
  { key: "test", href: "#/test", label: () => I18N.nav.test },
  { key: "progress", href: "#/progress", label: () => I18N.nav.progress },
];

const MOBILE_TABS = [
  { key: "home", href: "#/home", label: () => I18N.nav.home, icon: () => iconHome(20) },
  { key: "library", href: "#/library", label: () => I18N.nav.library, icon: () => iconBook(20) },
  {
    key: "flashcards",
    href: "#/flashcards",
    label: () => I18N.nav.flashcardsShort,
    icon: () => iconCards(20),
  },
  {
    key: "practice",
    href: "#/practice",
    label: () => I18N.nav.practiceShort,
    icon: () => iconCheckSquare(20),
  },
  {
    key: "progress",
    href: "#/progress",
    label: () => I18N.nav.progress,
    icon: () => iconBarChart(20),
  },
];

let currentRoute = null;
let currentCleanup = null;

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
}

function renderShell(activeNavKey) {
  const headerEl = document.getElementById("app-header");
  const mobileNavEl = document.getElementById("mobile-nav");
  const settings = getSettings();
  const isDark = settings.theme === "dark";
  const rate = settings.speechRate === 0.8 ? 0.8 : 1.0;

  const speedButtonHtml = isSpeechSupported()
    ? `<button type="button" id="toggle-speed-btn" class="btn-icon btn-speed" aria-label="${escapeHtml(
        rate === 0.8 ? I18N.controls.speedSlow : I18N.controls.speedNormal
      )}">${rate.toFixed(1)}x</button>`
    : "";

  const syncCfg = getSyncConfig();
  const isSyncing = syncCfg.lastStatus === "syncing";
  const syncButtonHtml = syncCfg.token
    ? `<button type="button" id="header-sync-btn" class="btn-icon ${
        isSyncing ? "is-syncing" : ""
      }" aria-label="${escapeHtml(I18N.sync.headerSyncLabel)}" title="${escapeHtml(
        I18N.sync.headerSyncLabel
      )}">${iconSync(18)}</button>`
    : "";

  headerEl.innerHTML = `
    <div class="header-inner">
      <a class="brand-link" href="#/home">
        <span class="brand-mark" aria-hidden="true">${iconAward(18)}</span>
        <span>${escapeHtml(I18N.appName)}</span>
      </a>
      <nav class="desktop-nav" aria-label="${escapeHtml(I18N.nav.mainNavLabel)}">
        ${DESKTOP_NAV_ITEMS.map(
          (item) =>
            `<a class="nav-link" href="${item.href}" ${
              item.key === activeNavKey ? 'aria-current="page"' : ""
            }>${escapeHtml(item.label())}</a>`
        ).join("")}
      </nav>
      <div class="header-controls">
        ${syncButtonHtml}
        ${speedButtonHtml}
        <button
          type="button"
          id="toggle-theme-btn"
          class="btn-icon"
          aria-label="${escapeHtml(isDark ? I18N.controls.themeLight : I18N.controls.themeDark)}"
        >
          ${isDark ? iconSun(18) : iconMoon(18)}
        </button>
      </div>
    </div>
  `;

  mobileNavEl.setAttribute("aria-label", I18N.nav.mobileNavLabel);
  mobileNavEl.innerHTML = MOBILE_TABS.map(
    (tab) =>
      `<a class="mobile-tab" href="${tab.href}" ${
        tab.key === activeNavKey ? 'aria-current="page"' : ""
      }>${tab.icon()}<span>${escapeHtml(tab.label())}</span></a>`
  ).join("");

  headerEl.querySelector("#toggle-theme-btn")?.addEventListener("click", () => {
    const nextTheme = getSettings().theme === "dark" ? "light" : "dark";
    updateSettings({ theme: nextTheme });
    applyTheme(nextTheme);
    renderShell(currentRoute?.navKey || "home");
  });

  headerEl.querySelector("#toggle-speed-btn")?.addEventListener("click", () => {
    const nextRate = getSettings().speechRate === 0.8 ? 1.0 : 0.8;
    updateSettings({ speechRate: nextRate });
    renderShell(currentRoute?.navKey || "home");
  });

  headerEl.querySelector("#header-sync-btn")?.addEventListener("click", () => {
    syncWithGist();
  });
}

function renderLoading(mainEl) {
  mainEl.innerHTML = `
    <div class="panel" aria-busy="true">
      <p class="page-subtitle" style="margin-bottom: var(--space-4)">${escapeHtml(I18N.loading)}</p>
      <div class="skeleton-line" style="width: 60%"></div>
      <div class="skeleton-line" style="width: 90%"></div>
      <div class="skeleton-line" style="width: 75%"></div>
    </div>
  `;
}

function renderError(mainEl, onRetry) {
  mainEl.innerHTML = `
    <div class="panel state-box" role="alert">
      <h1 class="page-title">${escapeHtml(I18N.loadErrorTitle)}</h1>
      <p>${escapeHtml(I18N.loadErrorDesc)}</p>
      <button type="button" id="retry-load-btn" class="btn btn-primary">${escapeHtml(
        I18N.retry
      )}</button>
    </div>
  `;
  mainEl.querySelector("#retry-load-btn")?.addEventListener("click", onRetry);
}

function renderRoute(route) {
  if (typeof currentCleanup === "function") {
    currentCleanup();
    currentCleanup = null;
  }
  currentRoute = route;
  renderShell(route.navKey);
  const mainEl = document.getElementById("app-main");

  switch (route.name) {
    case "home":
      currentCleanup = renderHomeView(mainEl, route) || null;
      break;
    case "library":
    case "library-unit":
      currentCleanup = renderLibraryView(mainEl, route) || null;
      break;
    case "word-detail":
      currentCleanup = renderWordDetailView(mainEl, route) || null;
      break;
    case "flashcards":
      currentCleanup = renderFlashcardsView(mainEl, route) || null;
      break;
    case "practice":
      currentCleanup = renderPracticeView(mainEl, route) || null;
      break;
    case "test":
      currentCleanup = renderTestView(mainEl, route) || null;
      break;
    case "progress":
      currentCleanup = renderProgressView(mainEl, route) || null;
      break;
    default:
      renderHomeView(mainEl, route);
      break;
  }
}

function setupGlobalShortcuts() {
  document.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isTyping = tag === "input" || tag === "textarea" || tag === "select";

    if (event.key === "Escape") {
      if (currentRoute?.name === "word-detail") {
        const backHref =
          document.getElementById("word-back-link")?.getAttribute("href") || "#/library";
        navigateTo(backHref);
      } else if (currentRoute?.name === "library-unit") {
        navigateTo("#/library");
      }
      return;
    }

    if (isTyping) return;

    if (event.key === "/") {
      const searchEl = document.getElementById("library-search-input");
      if (searchEl) {
        event.preventDefault();
        searchEl.focus();
      }
      return;
    }

    if ((event.key === "r" || event.key === "R") && currentRoute?.name === "word-detail") {
      const speakBtn = document.querySelector('[data-speak-word="1.0"]');
      if (speakBtn) {
        event.preventDefault();
        speakBtn.click();
      }
    }
  });
}

async function boot() {
  document.title = I18N.appTitle;
  applyTheme(getSettings().theme);
  initSpeech();
  setupGlobalShortcuts();

  const mainEl = document.getElementById("app-main");
  renderShell("home");
  renderLoading(mainEl);

  const initData = async () => {
    try {
      await loadAppData();
      onSyncStatusChange((statusObj) => {
        if (currentRoute) {
          renderShell(currentRoute.navKey);
          if (statusObj.dataChanged && currentRoute.name !== "progress") {
            renderRoute(currentRoute);
          }
        }
      });
      startRouter(renderRoute);
      initAutoSync();
    } catch {
      renderError(mainEl, () => {
        renderLoading(mainEl);
        initData();
      });
    }
  };

  await initData();
}

boot();
