import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysIso,
  createInitialSrsState,
  isDueOnOrBefore,
  previewIntervals,
  reviewCard,
} from "../js/srs.js";
import {
  exportProgressPayload,
  getAllSrs,
  getLast14DaysActivity,
  getStreak,
  importProgressPayload,
  recordCardReview,
  resetAllProgress,
  saveTestResult,
} from "../js/store.js";

test("Lần đầu học (first review): trạng thái ban đầu và 3 mức đánh giá", () => {
  const init = createInitialSrsState();
  assert.deepEqual(init, {
    box: 0,
    ease: 2.5,
    interval: 0,
    due: null,
    lapses: 0,
  });

  const goodRes = reviewCard(init, "good", "2026-11-19");
  assert.deepEqual(goodRes, {
    box: 1,
    ease: 2.55,
    interval: 1,
    due: "2026-11-20",
    lapses: 0,
  });

  const hardRes = reviewCard(init, "hard", "2026-11-19");
  assert.deepEqual(hardRes, {
    box: 1,
    ease: 2.35,
    interval: 1,
    due: "2026-11-20",
    lapses: 0,
  });

  const againRes = reviewCard(init, "again", "2026-11-19");
  assert.deepEqual(againRes, {
    box: 1,
    ease: 2.3,
    interval: 0,
    due: "2026-11-19",
    lapses: 1,
  });
});

test("Nhớ liên tiếp (consecutive good): tăng hộp tới tối đa 5 và tăng dần interval", () => {
  let state = createInitialSrsState();
  let today = "2026-11-01";
  const boxes = [];
  const intervals = [];

  for (let i = 0; i < 6; i += 1) {
    state = reviewCard(state, "good", today);
    boxes.push(state.box);
    intervals.push(state.interval);
    today = state.due;
  }

  assert.deepEqual(boxes, [1, 2, 3, 4, 5, 5]);
  assert.equal(state.lapses, 0);
  for (let i = 1; i < intervals.length; i += 1) {
    assert.ok(intervals[i] > intervals[i - 1], `interval[${i}] phải lớn hơn interval[${i - 1}]`);
  }
});

test("Quên rồi học lại (lapse then relearn): đặt lại hộp 1, tăng lapses và giảm ease không dưới 1.3", () => {
  const mastered = {
    box: 4,
    ease: 2.7,
    interval: 22,
    due: "2026-11-19",
    lapses: 0,
  };

  const forgotten = reviewCard(mastered, "again", "2026-11-19");
  assert.equal(forgotten.box, 1);
  assert.equal(forgotten.interval, 0);
  assert.equal(forgotten.due, "2026-11-19");
  assert.equal(forgotten.lapses, 1);
  assert.equal(forgotten.ease, 2.5);

  // Học lại sau khi quên
  const step1 = reviewCard(forgotten, "good", "2026-11-19");
  assert.equal(step1.box, 2);
  assert.equal(step1.interval, 1);
  assert.equal(step1.due, "2026-11-20");
  assert.equal(step1.lapses, 1);

  const step2 = reviewCard(step1, "good", "2026-11-20");
  assert.equal(step2.box, 3);
  assert.equal(step2.interval, 3);
  assert.equal(step2.due, "2026-11-23");

  // Kiểm tra sàn ease >= 1.3 khi quên liên tiếp
  let low = { box: 2, ease: 1.4, interval: 3, due: "2026-11-19", lapses: 2 };
  low = reviewCard(low, "again", "2026-11-19");
  low = reviewCard(low, "again", "2026-11-19");
  assert.equal(low.ease, 1.3);
});

test("Đổi ngày (date rollover & due checks): kiểm tra đến hạn và qua tháng/năm", () => {
  const state = {
    box: 2,
    ease: 2.6,
    interval: 3,
    due: "2026-11-22",
    lapses: 0,
  };

  assert.equal(isDueOnOrBefore(state, "2026-11-19"), false);
  assert.equal(isDueOnOrBefore(state, "2026-11-21"), false);
  assert.equal(isDueOnOrBefore(state, "2026-11-22"), true);
  assert.equal(isDueOnOrBefore(state, "2026-11-25"), true);

  assert.equal(addDaysIso("2026-12-30", 3), "2027-01-02");
  const preview = previewIntervals(state, "2026-11-22");
  assert.equal(preview.again, 0);
  assert.equal(preview.hard, 4);
  assert.equal(preview.good, 8);
});

test("Progress helpers: 14-day activity, JSON export/import round-trip, and reset", () => {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };

  recordCardReview("a2-u1-brazil", "good", "2026-11-18");
  recordCardReview("a2-u1-brazil", "again", "2026-11-19");
  saveTestResult({
    id: "t-1",
    title: "Unit 1",
    score: 18,
    total: 20,
    percent: 90,
    durationSec: 120,
    dateIso: "2026-11-19",
  });

  const days14 = getLast14DaysActivity("2026-11-19");
  assert.equal(days14.length, 14);
  assert.equal(days14[12].dateIso, "2026-11-18");
  assert.equal(days14[12].count, 1);
  assert.equal(days14[13].dateIso, "2026-11-19");
  assert.equal(days14[13].count, 1);
  assert.equal(days14[13].isToday, true);

  const exported = exportProgressPayload("2026-11-19");
  assert.equal(exported.app, "vocab-app");
  assert.equal(exported.data["vocab:srs"]["a2-u1-brazil"].lapses, 1);
  assert.equal(exported.data["vocab:streak"].count, 2);

  resetAllProgress();
  assert.deepEqual(getAllSrs(), {});
  assert.equal(getStreak().count, 0);

  const importedSummary = importProgressPayload(exported);
  assert.equal(importedSummary.wordCount, 1);
  assert.equal(importedSummary.testCount, 1);
  assert.equal(getAllSrs()["a2-u1-brazil"].lapses, 1);
  assert.equal(getStreak().count, 2);
});
