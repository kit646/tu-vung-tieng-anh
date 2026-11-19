/**
 * Bộ chuyển đổi bài tập gốc từ sách (data/exercises.json) và bộ sinh bài tập / đề kiểm tra
 * cho các unit Wordlist từ data/vocab.json.
 */

import { isSpeechSupported } from "./speech.js";
import { getCachedData, getUnitDirectory } from "./store.js";

function shuffleArray(items, rng = Math.random) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeAnswerText(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeLetters(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

/**
 * Thay từ/cụm từ trong câu ví dụ bằng "____" (không phân biệt hoa thường, xử lý cụm từ).
 */
export function blankOutWord(sentence, word) {
  const text = String(sentence || "").trim();
  const rawWord = String(word || "").trim();
  if (!text || !rawWord) return `${text} ____`.trim();

  // 1. Thử khớp chính xác từ/cụm từ (kể cả thêm s/es)
  const directRe = new RegExp(`(^|[^a-zA-ZÀ-ỹ])(${escapeRegExp(rawWord)}(?:s|es)?)([^a-zA-ZÀ-ỹ]|$)`, "i");
  if (directRe.test(text)) {
    return text.replace(directRe, "$1____$3");
  }

  // 2. Xử lý các từ có ngoặc hoặc dấu "/" như "(a) quarter to/past", "get a good/bad mark"
  const stripped = rawWord
    .replace(/\([^)]*\)/g, " ")
    .replace(/([a-zA-Z]+)\/([a-zA-Z]+)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped && stripped.toLowerCase() !== rawWord.toLowerCase()) {
    const strippedRe = new RegExp(
      `(^|[^a-zA-ZÀ-ỹ])(${escapeRegExp(stripped)}(?:s|es)?)([^a-zA-ZÀ-ỹ]|$)`,
      "i"
    );
    if (strippedRe.test(text)) {
      return text.replace(strippedRe, "$1____$3");
    }
  }

  // 3. Thử khớp từ gốc dài nhất trong cụm từ (bỏ mạo từ)
  const tokens = stripped
    .split(/\s+/)
    .filter((t) => t.length > 2 && !["the", "and", "for"].includes(t.toLowerCase()));
  tokens.sort((a, b) => b.length - a.length);
  for (const tok of tokens) {
    const tokRe = new RegExp(`(^|[^a-zA-ZÀ-ỹ])(${escapeRegExp(tok)}(?:s|es|ed|ing)?)([^a-zA-ZÀ-ỹ]|$)`, "i");
    if (tokRe.test(text)) {
      return text.replace(tokRe, "$1____$3");
    }
  }

  return `${text} (____)`;
}

/**
 * Xáo trộn các chữ cái của từ (bảo đảm khác thứ tự gốc nếu có >= 2 chữ cái khác nhau).
 */
export function scrambleWordLetters(word, rng = Math.random) {
  const letters = Array.from(String(word || "").replace(/[^a-zA-ZÀ-ỹ]/g, "").toUpperCase());
  if (letters.length <= 1) return letters;

  const unique = new Set(letters);
  if (unique.size <= 1) return letters;

  let scrambled = shuffleArray(letters, rng);
  let attempts = 0;
  while (scrambled.join("") === letters.join("") && attempts < 10) {
    scrambled = shuffleArray(letters, rng);
    attempts += 1;
  }
  return scrambled;
}

function pickDistractors(targetWord, unitWords, allVocab, count = 3, rng = Math.random) {
  const targetNorm = targetWord.word.toLowerCase();
  const targetPos = targetWord.pos.toLowerCase();
  const chosen = [];
  const usedWords = new Set([targetNorm]);

  const addFromPool = (pool) => {
    for (const candidate of shuffleArray(pool, rng)) {
      if (chosen.length >= count) break;
      const wNorm = candidate.word.toLowerCase();
      if (!usedWords.has(wNorm)) {
        usedWords.add(wNorm);
        chosen.push(candidate);
      }
    }
  };

  // Ưu tiên 1: cùng từ loại VÀ cùng unit
  addFromPool(
    unitWords.filter(
      (w) => w.pos.toLowerCase() === targetPos && w.word.toLowerCase() !== targetNorm
    )
  );
  // Ưu tiên 2: cùng unit (nếu unit ít từ cùng loại)
  if (chosen.length < count) {
    addFromPool(unitWords.filter((w) => w.word.toLowerCase() !== targetNorm));
  }
  // Ưu tiên 3: cùng từ loại trong toàn bộ kho từ
  if (chosen.length < count) {
    addFromPool(
      allVocab.filter(
        (w) => w.pos.toLowerCase() === targetPos && w.word.toLowerCase() !== targetNorm
      )
    );
  }
  // Ưu tiên 4: bất kỳ từ nào còn lại
  if (chosen.length < count) {
    addFromPool(allVocab);
  }

  return chosen.slice(0, count);
}

/**
 * Sinh đầy đủ 5 dạng bài tập từ mảng từ vựng (dùng cho các unit Wordlist hoặc tập từ tùy chỉnh).
 */
export function generatePracticeFromWords(unitWords, allVocab, rng = Math.random) {
  const sampleWords = shuffleArray(unitWords, rng).slice(0, Math.min(10, unitWords.length));
  const letters = "abcdefghij";

  // Dạng A: Nối từ - định nghĩa
  const matchDefs = shuffleArray(
    sampleWords.map((w) => w.definition_en),
    rng
  );
  const matchingItems = sampleWords.map((w, idx) => {
    const defIdx = matchDefs.indexOf(w.definition_en);
    const letter = letters[defIdx] || String(defIdx + 1);
    const rightDef = `${letters[idx]}. ${matchDefs[idx]}`;
    const correctDef = `${letter}. ${w.definition_en}`;
    return {
      id: `gen-a-${w.id}`,
      word_id: w.id,
      num: idx + 1,
      word: w.word,
      definition: rightDef,
      answer: correctDef,
      answer_letter: letter,
    };
  });

  // Dạng B: Điền từ vào chỗ trống (có word bank tối thiểu 4 từ)
  const fillBankSet = new Map(sampleWords.map((w) => [w.word.toLowerCase(), w.word]));
  if (fillBankSet.size < 4) {
    for (const extra of pickDistractors(sampleWords[0], unitWords, allVocab, 4 - fillBankSet.size, rng)) {
      fillBankSet.set(extra.word.toLowerCase(), extra.word);
    }
  }
  const fillWordBank = Array.from(fillBankSet.values()).sort((a, b) => a.localeCompare(b));
  const fillItems = sampleWords.map((w, idx) => ({
    id: `gen-b-${w.id}`,
    word_id: w.id,
    num: idx + 1,
    sentence: blankOutWord(w.example, w.word),
    answer: w.word,
  }));

  // Dạng C: Trắc nghiệm 4 lựa chọn (3 đáp án nhiễu ưu tiên cùng POS & cùng Unit)
  const mcqLetters = ["a", "b", "c", "d"];
  const mcqItems = sampleWords.map((w, idx) => {
    const distractors = pickDistractors(w, unitWords, allVocab, 3, rng).map((d) => d.word);
    const rawOpts = shuffleArray([w.word, ...distractors], rng);
    const options = rawOpts.map((opt, oIdx) => `${mcqLetters[oIdx]}) ${opt}`);
    const correctIdx = rawOpts.indexOf(w.word);
    return {
      id: `gen-c-${w.id}`,
      word_id: w.id,
      num: idx + 1,
      question: w.definition_en,
      options,
      answer: options[correctIdx],
      answer_word: w.word,
    };
  });

  // Dạng D: Xếp chữ
  const unscramblePool = sampleWords.filter((w) => normalizeLetters(w.word).length >= 2);
  const unscrambleItems = (unscramblePool.length ? unscramblePool : sampleWords).map((w, idx) => {
    const scrambledChars = scrambleWordLetters(w.word, rng);
    return {
      id: `gen-d-${w.id}`,
      word_id: w.id,
      num: idx + 1,
      scrambled: scrambledChars.join(" "),
      hint: `(${w.pos}) ${w.definition_en}`,
      answer: w.word,
    };
  });

  // Dạng E (Mở rộng): Nghe - viết
  const listenItems = buildListenItems(sampleWords);

  return {
    isGenerated: true,
    totalInUnit: unitWords.length,
    A: { items: matchingItems },
    B: { word_bank: fillWordBank, items: fillItems },
    C: { items: mcqItems },
    D: { items: unscrambleItems },
    listen: { items: listenItems },
  };
}

function buildListenItems(words) {
  return words.map((w, idx) => ({
    id: `listen-${w.id}`,
    word_id: w.id,
    num: idx + 1,
    word: w.word,
    pos: w.pos,
    ipa: w.ipa,
    hintSentence: blankOutWord(w.example, w.word),
    definition_en: w.definition_en,
    answer: w.word,
  }));
}

export function getPracticeSetForUnit(unitKey) {
  const data = getCachedData();
  const directory = getUnitDirectory();
  const unitEntry = directory.find((u) => u.key === unitKey) || directory[0];
  if (!data || !unitEntry) return null;

  if (unitEntry.source === "book") {
    const bookUnitEx = (data.exercises?.units || []).find(
      (u) => u.level === unitEntry.level && Number(u.unit) === Number(unitEntry.unit)
    );
    if (bookUnitEx) {
      return {
        unitEntry,
        isGenerated: false,
        studyTip: bookUnitEx.unit_meta?.study_tip || "",
        A: bookUnitEx.A,
        B: bookUnitEx.B,
        C: bookUnitEx.C,
        D: bookUnitEx.D,
        listen: { items: buildListenItems(unitEntry.words) },
      };
    }
  }

  const generated = generatePracticeFromWords(unitEntry.words, data.vocab);
  return {
    unitEntry,
    isGenerated: true,
    studyTip: "",
    ...generated,
  };
}

/**
 * Sinh đề kiểm tra 20 câu trộn các dạng (Trắc nghiệm, Điền từ, Xếp chữ, Nghe-viết/Định nghĩa).
 */
export function generateMixedTestFromWords(
  poolWords,
  allVocab,
  { title = "", targetKey = "", count = 20, includeListen = true, rng = Math.random } = {}
) {
  const sourcePool = poolWords.length ? poolWords : allVocab;
  const chosen = [];
  while (chosen.length < count) {
    const batch = shuffleArray(sourcePool, rng);
    for (const w of batch) {
      if (chosen.length >= count) break;
      chosen.push(w);
    }
  }

  const types = includeListen ? ["mcq", "fill", "unscramble", "listen"] : ["mcq", "fill", "unscramble"];
  const mcqLetters = ["a", "b", "c", "d"];

  const questions = chosen.map((w, idx) => {
    let qType = types[idx % types.length];
    if (qType === "unscramble" && normalizeLetters(w.word).length < 2) {
      qType = "mcq";
    }

    if (qType === "mcq") {
      const distractors = pickDistractors(w, sourcePool, allVocab, 3, rng).map((d) => d.word);
      const rawOpts = shuffleArray([w.word, ...distractors], rng);
      const options = rawOpts.map((opt, oIdx) => `${mcqLetters[oIdx]}) ${opt}`);
      return {
        id: `test-q-${idx + 1}`,
        num: idx + 1,
        type: "mcq",
        word_id: w.id,
        prompt: w.definition_en,
        options,
        answer: w.word,
      };
    }

    if (qType === "fill") {
      const distractors = pickDistractors(w, sourcePool, allVocab, 5, rng).map((d) => d.word);
      const wordBank = shuffleArray([w.word, ...distractors], rng);
      return {
        id: `test-q-${idx + 1}`,
        num: idx + 1,
        type: "fill",
        word_id: w.id,
        sentence: blankOutWord(w.example, w.word),
        word_bank: wordBank,
        answer: w.word,
      };
    }

    if (qType === "unscramble") {
      return {
        id: `test-q-${idx + 1}`,
        num: idx + 1,
        type: "unscramble",
        word_id: w.id,
        scrambled: scrambleWordLetters(w.word, rng).join(" "),
        hint: `(${w.pos}) ${w.definition_en}`,
        answer: w.word,
      };
    }

    return {
      id: `test-q-${idx + 1}`,
      num: idx + 1,
      type: "listen",
      word_id: w.id,
      word: w.word,
      pos: w.pos,
      hintSentence: blankOutWord(w.example, w.word),
      definition_en: w.definition_en,
      answer: w.word,
    };
  });

  return {
    title,
    targetKey,
    questions,
  };
}

export function generateMixedTest({ scopeType = "unit", unitKey = "", level = "A1", count = 20 } = {}) {
  const data = getCachedData();
  const directory = getUnitDirectory();
  if (!data) return { title: "", targetKey: "", questions: [] };

  let poolWords = [];
  let title = "";
  let targetKey = "";

  if (scopeType === "level") {
    const lvl = String(level).toUpperCase();
    poolWords = data.vocab.filter((w) => w.level === lvl || w.book_level === lvl);
    title = `Kiểm tra Level ${lvl} (${count} câu trộn)`;
    targetKey = `level-${lvl}`;
  } else {
    const unitEntry = directory.find((u) => u.key === unitKey) || directory[0];
    poolWords = unitEntry ? unitEntry.words : data.vocab;
    title = unitEntry
      ? `${unitEntry.level} · Unit ${unitEntry.unit}: ${unitEntry.topic || unitEntry.title}`
      : `Kiểm tra Unit`;
    targetKey = unitEntry ? unitEntry.key : "unit";
  }

  return generateMixedTestFromWords(poolWords, data.vocab, {
    title,
    targetKey,
    count,
    includeListen: isSpeechSupported(),
  });
}

export function getBookReviews() {
  const data = getCachedData();
  return data?.exercises?.reviews || [];
}
