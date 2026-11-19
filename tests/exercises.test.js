import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  blankOutWord,
  generateMixedTestFromWords,
  generatePracticeFromWords,
  normalizeLetters,
  scrambleWordLetters,
} from "../js/exercises.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const vocab = JSON.parse(fs.readFileSync(path.join(dataDir, "vocab.json"), "utf8"));
const exercises = JSON.parse(fs.readFileSync(path.join(dataDir, "exercises.json"), "utf8"));

test("blankOutWord replaces target words and handles parenthetical patterns", () => {
  assert.equal(blankOutWord("I'm going to Brazil this summer.", "Brazil"), "I'm going to ____ this summer.");
  assert.ok(blankOutWord("We were in Australia in 2012.", "in (1962,etc)").includes("____"));
  assert.ok(blankOutWord("Meet me at a quarter to nine.", "(a) quarter to/past").includes("____"));
});

test("scrambleWordLetters produces an exact letter permutation different from original", () => {
  const letters = scrambleWordLetters("neighbour");
  assert.equal(letters.join("").toLowerCase().split("").sort().join(""), normalizeLetters("neighbour").split("").sort().join(""));
  assert.notEqual(letters.join(""), "NEIGHBOUR");
});

test("generatePracticeFromWords generates valid A, B, C (same-POS/unit distractors), D, and listen for wordlist Unit 1", () => {
  const unit1Words = vocab.filter((w) => w.source === "wordlist" && w.level === "A2" && w.unit === 1);
  const generated = generatePracticeFromWords(unit1Words, vocab);

  assert.equal(generated.A.items.length, 10);
  assert.equal(generated.B.items.length, 10);
  assert.equal(generated.C.items.length, 10);
  assert.equal(generated.D.items.length, 10);
  assert.equal(generated.listen.items.length, 10);

  for (const itemB of generated.B.items) {
    assert.ok(itemB.sentence.includes("____"), `Expected blank in ${itemB.sentence}`);
    assert.ok(generated.B.word_bank.includes(itemB.answer));
  }

  for (const itemC of generated.C.items) {
    assert.equal(itemC.options.length, 4);
    assert.ok(itemC.options.includes(itemC.answer));
    const targetWord = unit1Words.find((w) => w.id === itemC.word_id);
    // All 4 options in A2 U1 should come from A2 U1 and same POS where >=4 exist
    const samePosCountInUnit = unit1Words.filter((w) => w.pos === targetWord.pos).length;
    if (samePosCountInUnit >= 4) {
      for (const opt of itemC.options) {
        const clean = opt.replace(/^[a-d]\)\s*/, "");
        const optObj = unit1Words.find((w) => w.word === clean);
        assert.ok(optObj, `Distractor ${clean} should be in same unit`);
        assert.equal(optObj.pos, targetWord.pos);
      }
    }
  }

  for (const itemD of generated.D.items) {
    assert.equal(
      normalizeLetters(itemD.scrambled).split("").sort().join(""),
      normalizeLetters(itemD.answer).split("").sort().join("")
    );
  }
});

test("generateMixedTestFromWords generates 20 valid questions across types", () => {
  const a1Unit1 = vocab.filter((w) => w.book_level === "A1" && w.book_unit === 1);
  const testObj = generateMixedTestFromWords(a1Unit1, vocab, { count: 20, includeListen: true });

  assert.equal(testObj.questions.length, 20);
  const seenTypes = new Set(testObj.questions.map((q) => q.type));
  assert.ok(seenTypes.has("mcq"));
  assert.ok(seenTypes.has("fill"));
  assert.ok(seenTypes.has("unscramble"));
  assert.ok(seenTypes.has("listen"));
});

test("Book Level 1 & Level 2 Reviews exist with 12 questions each", () => {
  assert.equal(exercises.reviews.length, 2);
  assert.equal(exercises.reviews[0].level, "A1");
  assert.equal(exercises.reviews[0].items.length, 12);
  assert.equal(exercises.reviews[1].level, "A2");
  assert.equal(exercises.reviews[1].items.length, 12);
});
