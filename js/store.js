/**
 * Quản lý tải dữ liệu JSON (có cache bộ nhớ) và trạng thái học tập trong localStorage.
 * Tất cả key localStorage đều dùng tiền tố "vocab:".
 */

import { addDaysIso, isDueOnOrBefore, normalizeSrsState, reviewCard } from "./srs.js";

export const STORAGE_KEYS = {
  SRS: "vocab:srs",
  STREAK: "vocab:streak",
  SETTINGS: "vocab:settings",
  TESTS: "vocab:tests",
  SYNC: "vocab:sync",
};

const DEFAULT_SETTINGS = {
  theme: "light",
  speechRate: 1.0,
  cardDirection: "en-vi",
};

const DEFAULT_STREAK = {
  count: 0,
  lastDate: null,
  history: {},
};

const DEFAULT_SYNC_CONFIG = {
  token: "",
  gistId: "",
  autoSync: true,
  lastSyncAt: null,
  lastStatus: "idle",
  lastError: "",
};

const progressListeners = new Set();

export function onProgressChange(listener) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

function notifyProgressChange(reason = "mutate") {
  for (const listener of progressListeners) {
    try {
      listener(reason);
    } catch {
      // ignore subscriber errors
    }
  }
}

const WORDLIST_TOPICS = {
  1: "Quốc gia & tính cách",
  2: "Nghề nghiệp & học tập",
  3: "Tần suất & công nghệ",
  4: "Thực phẩm & nấu ăn",
  5: "Nhà cửa & địa điểm",
  6: "Gia đình & quá khứ",
  7: "Phương tiện di chuyển",
};

let cacheData = null;
let loadPromise = null;

function readStorage(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return structuredClone(fallback);
    return { ...structuredClone(fallback), ...JSON.parse(raw) };
  } catch {
    return structuredClone(fallback);
  }
}

function readStorageRaw(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key) {
  try {
    globalThis.localStorage?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getSettings() {
  const saved = readStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  if (!saved.theme && globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    saved.theme = "dark";
  }
  return saved;
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  writeStorage(STORAGE_KEYS.SETTINGS, next);
  return next;
}

export function getStreak() {
  return readStorage(STORAGE_KEYS.STREAK, DEFAULT_STREAK);
}

export function getAllSrs() {
  return readStorageRaw(STORAGE_KEYS.SRS, {});
}

export function getWordSrs(wordId) {
  const all = getAllSrs();
  return normalizeSrsState(all[wordId]);
}

export function getWordStatus(srs) {
  if (!srs || srs.box === 0) return "new";
  if (srs.box >= 4 && srs.interval >= 7) return "mastered";
  return "learning";
}

export function markWordDueToday(wordId) {
  const all = getAllSrs();
  const today = getTodayIso();
  const current = getWordSrs(wordId);
  all[wordId] = {
    ...current,
    box: Math.max(1, current.box),
    due: today,
    updatedAt: Date.now(),
  };
  writeStorage(STORAGE_KEYS.SRS, all);
  notifyProgressChange("mutate");
  return all[wordId];
}

export async function loadAppData(forceRefresh = false) {
  if (cacheData && !forceRefresh) return cacheData;
  if (loadPromise && !forceRefresh) return loadPromise;

  loadPromise = (async () => {
    const [vocabRes, exercisesRes] = await Promise.all([
      fetch("./data/vocab.json"),
      fetch("./data/exercises.json"),
    ]);

    if (!vocabRes.ok || !exercisesRes.ok) {
      loadPromise = null;
      throw new Error(`HTTP ${vocabRes.status}/${exercisesRes.status}`);
    }

    const [vocab, exercises] = await Promise.all([vocabRes.json(), exercisesRes.json()]);
    const vocabById = new Map(vocab.map((item) => [item.id, item]));
    const bookMetaMap = new Map(
      (exercises.units || []).map((u) => [`${u.level}-${u.unit}`, u.unit_meta])
    );

    cacheData = {
      vocab,
      exercises,
      vocabById,
      bookMetaMap,
    };
    return cacheData;
  })();

  return loadPromise;
}

export function getCachedData() {
  return cacheData;
}

export function getWordById(id) {
  return cacheData?.vocabById.get(id) || null;
}

export function matchesUnit(word, level, unit, sourceFilter = "all") {
  const targetLevel = String(level).toUpperCase();
  const targetUnit = Number(unit);

  const inPrimary = word.level === targetLevel && word.unit === targetUnit;
  const inBook = word.book_level === targetLevel && word.book_unit === targetUnit;

  if (sourceFilter === "wordlist") {
    return word.source === "wordlist" && inPrimary;
  }
  if (sourceFilter === "book") {
    return inBook;
  }
  return inPrimary || inBook;
}

export function getWordsForUnit(level, unit, sourceFilter = "all") {
  if (!cacheData) return [];
  return cacheData.vocab.filter((word) => matchesUnit(word, level, unit, sourceFilter));
}

export function getUnitMeta(level, unit, sourceFilter = "all") {
  const targetLevel = String(level).toUpperCase();
  const targetUnit = Number(unit);
  const bookMeta = cacheData?.bookMetaMap.get(`${targetLevel}-${targetUnit}`);

  if (sourceFilter === "book" && bookMeta) {
    return {
      level: targetLevel,
      unit: targetUnit,
      source: "book",
      title: bookMeta.title,
      topic: bookMeta.topic,
      studyTip: bookMeta.study_tip,
    };
  }

  if (sourceFilter === "wordlist" || (!bookMeta && targetLevel === "A2")) {
    return {
      level: targetLevel,
      unit: targetUnit,
      source: "wordlist",
      title: `Unit ${targetUnit}`,
      topic: WORDLIST_TOPICS[targetUnit] || "",
      studyTip: "",
    };
  }

  if (bookMeta) {
    return {
      level: targetLevel,
      unit: targetUnit,
      source: sourceFilter,
      title: bookMeta.title,
      topic:
        targetLevel === "A2" && targetUnit === 7 && sourceFilter === "all"
          ? `${bookMeta.topic} & ${WORDLIST_TOPICS[7]}`
          : bookMeta.topic,
      studyTip: bookMeta.study_tip,
    };
  }

  return {
    level: targetLevel,
    unit: targetUnit,
    source: sourceFilter,
    title: `Unit ${targetUnit}`,
    topic: "",
    studyTip: "",
  };
}

export function getUnitDirectory() {
  if (!cacheData) return [];
  const entries = [];

  for (let u = 1; u <= 6; u += 1) {
    const meta = getUnitMeta("A1", u, "book");
    entries.push({
      key: `book-A1-${u}`,
      sourceGroup: "book-a1",
      source: "book",
      level: "A1",
      unit: u,
      topic: meta.topic,
      title: meta.title,
      words: getWordsForUnit("A1", u, "book"),
    });
  }

  for (let u = 1; u <= 7; u += 1) {
    const meta = getUnitMeta("A2", u, "wordlist");
    entries.push({
      key: `wordlist-A2-${u}`,
      sourceGroup: "wordlist-a2",
      source: "wordlist",
      level: "A2",
      unit: u,
      topic: meta.topic,
      title: meta.title,
      words: getWordsForUnit("A2", u, "wordlist"),
    });
  }

  for (let u = 7; u <= 12; u += 1) {
    const meta = getUnitMeta("A2", u, "book");
    entries.push({
      key: `book-A2-${u}`,
      sourceGroup: "book-a2",
      source: "book",
      level: "A2",
      unit: u,
      topic: meta.topic,
      title: meta.title,
      words: getWordsForUnit("A2", u, "book"),
    });
  }

  return entries;
}

export function searchAndFilterWords({ query = "", sourceGroup = "all", pos = "all" } = {}) {
  if (!cacheData) return [];
  const q = query.trim().toLowerCase();

  return cacheData.vocab.filter((word) => {
    if (sourceGroup === "book-a1" && word.book_level !== "A1") return false;
    if (sourceGroup === "wordlist-a2" && word.source !== "wordlist") return false;
    if (sourceGroup === "book-a2" && word.book_level !== "A2") return false;

    if (pos !== "all") {
      const normalizedPos = word.pos.toLowerCase();
      if (pos === "noun") {
        if (normalizedPos !== "noun" && normalizedPos !== "plural noun") return false;
      } else if (pos === "prep") {
        if (normalizedPos !== "prep" && normalizedPos !== "preposition") return false;
      } else if (normalizedPos !== pos) {
        return false;
      }
    }

    if (q) {
      const inWord = word.word.toLowerCase().includes(q);
      const inVi = word.meaning_vi.toLowerCase().includes(q);
      const inEn = word.definition_en.toLowerCase().includes(q);
      if (!inWord && !inVi && !inEn) return false;
    }

    return true;
  });
}

export function getDueWords(todayIso = getTodayIso()) {
  if (!cacheData) return [];
  const allSrs = getAllSrs();
  return cacheData.vocab.filter((w) => isDueOnOrBefore(allSrs[w.id], todayIso));
}

export function getNewWords() {
  if (!cacheData) return [];
  const allSrs = getAllSrs();
  return cacheData.vocab.filter((w) => !allSrs[w.id] || allSrs[w.id].box === 0);
}

function bumpStreak(todayIso) {
  const streak = getStreak();
  const history = { ...(streak.history || {}) };
  history[todayIso] = (history[todayIso] || 0) + 1;

  let nextCount = streak.count || 0;
  if (streak.lastDate === todayIso) {
    nextCount = Math.max(1, nextCount);
  } else if (streak.lastDate === addDaysIso(todayIso, -1)) {
    nextCount += 1;
  } else {
    nextCount = 1;
  }

  const nextStreak = {
    count: nextCount,
    lastDate: todayIso,
    history,
  };
  writeStorage(STORAGE_KEYS.STREAK, nextStreak);
  return nextStreak;
}

export function recordCardReview(wordId, grade, todayIso = getTodayIso()) {
  const allSrs = getAllSrs();
  const nextSrs = {
    ...reviewCard(normalizeSrsState(allSrs[wordId]), grade, todayIso),
    updatedAt: Date.now(),
  };
  allSrs[wordId] = nextSrs;
  writeStorage(STORAGE_KEYS.SRS, allSrs);

  const nextStreak = bumpStreak(todayIso);
  notifyProgressChange("mutate");
  return { srs: nextSrs, streak: nextStreak };
}

export function recordExerciseAnswer(wordId, isCorrect, todayIso = getTodayIso()) {
  if (!wordId) return null;
  if (!isCorrect) {
    return recordCardReview(wordId, "again", todayIso);
  }

  const nextStreak = bumpStreak(todayIso);
  notifyProgressChange("mutate");
  return { srs: getWordSrs(wordId), streak: nextStreak };
}

export function getTestHistory() {
  const items = readStorageRaw(STORAGE_KEYS.TESTS, []);
  return Array.isArray(items) ? items : [];
}

export function saveTestResult(entry) {
  const list = getTestHistory();
  const next = [entry, ...list].slice(0, 50);
  writeStorage(STORAGE_KEYS.TESTS, next);
  notifyProgressChange("mutate");
  return next;
}

export function getFlashcardDeck({ mode = "due", unitKey = "", limit = 20 } = {}) {
  if (!cacheData) return [];
  const allSrs = getAllSrs();
  const todayIso = getTodayIso();

  if (mode === "due") {
    return getDueWords(todayIso)
      .sort((a, b) => {
        const sa = normalizeSrsState(allSrs[a.id]);
        const sb = normalizeSrsState(allSrs[b.id]);
        if (sa.due !== sb.due) return String(sa.due).localeCompare(String(sb.due));
        return sb.lapses - sa.lapses;
      })
      .slice(0, limit);
  }

  if (mode === "weak") {
    return getWeakWords().slice(0, limit);
  }

  if (mode === "new") {
    return getNewWords().slice(0, limit);
  }

  if (mode === "unit") {
    const directory = getUnitDirectory();
    const targetUnit = directory.find((u) => u.key === unitKey) || directory[0];
    if (!targetUnit) return [];
    const rank = (word) => {
      const s = normalizeSrsState(allSrs[word.id]);
      if (isDueOnOrBefore(s, todayIso)) return 0;
      if (s.lapses > 0) return 1;
      if (s.box === 0) return 2;
      return 3;
    };
    return [...targetUnit.words]
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, limit);
  }

  return [];
}

export function getWeakWords() {
  if (!cacheData) return [];
  const allSrs = getAllSrs();
  return cacheData.vocab
    .filter((w) => (allSrs[w.id]?.lapses || 0) > 0)
    .sort((a, b) => (allSrs[b.id]?.lapses || 0) - (allSrs[a.id]?.lapses || 0));
}

export function getOverallStats() {
  const total = cacheData?.vocab.length || 0;
  const allSrs = getAllSrs();
  let mastered = 0;
  let learning = 0;

  if (cacheData) {
    for (const w of cacheData.vocab) {
      const status = getWordStatus(allSrs[w.id]);
      if (status === "mastered") mastered += 1;
      else if (status === "learning") learning += 1;
    }
  }

  return {
    total,
    mastered,
    learning,
    newCount: Math.max(0, total - mastered - learning),
  };
}

export function getUnitStats(words) {
  const allSrs = getAllSrs();
  let learned = 0;
  let mastered = 0;

  for (const w of words) {
    const status = getWordStatus(allSrs[w.id]);
    if (status === "mastered") {
      mastered += 1;
      learned += 1;
    } else if (status === "learning") {
      learned += 1;
    }
  }

  return {
    total: words.length,
    learned,
    mastered,
    percent: words.length ? Math.round((learned / words.length) * 100) : 0,
  };
}

export function getLast14DaysActivity(todayIso = getTodayIso()) {
  const streak = getStreak();
  const history = streak.history || {};
  const days = [];
  for (let offset = -13; offset <= 0; offset += 1) {
    const dateIso = addDaysIso(todayIso, offset);
    days.push({
      dateIso,
      shortLabel: `${dateIso.slice(8, 10)}/${dateIso.slice(5, 7)}`,
      count: Math.max(0, Number(history[dateIso] || 0)),
      isToday: dateIso === todayIso,
    });
  }
  return days;
}

export function exportProgressPayload(todayIso = getTodayIso()) {
  return {
    app: "vocab-app",
    version: 1,
    exportedAt: todayIso,
    data: {
      [STORAGE_KEYS.SRS]: getAllSrs(),
      [STORAGE_KEYS.STREAK]: getStreak(),
      [STORAGE_KEYS.TESTS]: getTestHistory(),
      [STORAGE_KEYS.SETTINGS]: getSettings(),
    },
  };
}

export function importProgressPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid backup object");
  }
  const source = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const rawSrs = source[STORAGE_KEYS.SRS];
  if (!rawSrs || typeof rawSrs !== "object" || Array.isArray(rawSrs)) {
    throw new Error("Missing vocab:srs object");
  }

  const cleanedSrs = {};
  for (const [wordId, entry] of Object.entries(rawSrs)) {
    if (entry && typeof entry === "object") {
      cleanedSrs[wordId] = normalizeSrsState(entry);
    }
  }
  writeStorage(STORAGE_KEYS.SRS, cleanedSrs);

  const rawStreak = source[STORAGE_KEYS.STREAK];
  if (rawStreak && typeof rawStreak === "object" && !Array.isArray(rawStreak)) {
    const cleanedStreak = {
      count: Math.max(0, Number(rawStreak.count || 0)),
      lastDate: typeof rawStreak.lastDate === "string" ? rawStreak.lastDate : null,
      history:
        rawStreak.history && typeof rawStreak.history === "object" && !Array.isArray(rawStreak.history)
          ? rawStreak.history
          : {},
    };
    writeStorage(STORAGE_KEYS.STREAK, cleanedStreak);
  }

  const rawTests = source[STORAGE_KEYS.TESTS];
  const cleanedTests = Array.isArray(rawTests) ? rawTests.slice(0, 50) : [];
  if (rawTests !== undefined) {
    writeStorage(STORAGE_KEYS.TESTS, cleanedTests);
  }

  const rawSettings = source[STORAGE_KEYS.SETTINGS];
  if (rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)) {
    updateSettings(rawSettings);
  }

  notifyProgressChange("mutate");
  return {
    wordCount: Object.keys(cleanedSrs).length,
    testCount: cleanedTests.length,
  };
}

export function resetAllProgress() {
  removeStorage(STORAGE_KEYS.SRS);
  removeStorage(STORAGE_KEYS.STREAK);
  removeStorage(STORAGE_KEYS.TESTS);
  notifyProgressChange("reset");
}

export function getSyncConfig() {
  return readStorage(STORAGE_KEYS.SYNC, DEFAULT_SYNC_CONFIG);
}

export function updateSyncConfig(patch) {
  const next = { ...getSyncConfig(), ...patch };
  writeStorage(STORAGE_KEYS.SYNC, next);
  return next;
}

export function clearSyncConfig() {
  removeStorage(STORAGE_KEYS.SYNC);
}

/**
 * Ghi dữ liệu đã gộp (từ đồng bộ/mã chuyển) mà không kích hoạt lại auto-sync để tránh vòng lặp.
 */
export function applyMergedData(mergedData) {
  if (!mergedData || typeof mergedData !== "object") return;
  if (mergedData[STORAGE_KEYS.SRS] && typeof mergedData[STORAGE_KEYS.SRS] === "object") {
    writeStorage(STORAGE_KEYS.SRS, mergedData[STORAGE_KEYS.SRS]);
  }
  if (mergedData[STORAGE_KEYS.STREAK] && typeof mergedData[STORAGE_KEYS.STREAK] === "object") {
    writeStorage(STORAGE_KEYS.STREAK, mergedData[STORAGE_KEYS.STREAK]);
  }
  if (Array.isArray(mergedData[STORAGE_KEYS.TESTS])) {
    writeStorage(STORAGE_KEYS.TESTS, mergedData[STORAGE_KEYS.TESTS]);
  }
}
