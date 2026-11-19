/**
 * Thuật toán lặp lại ngắt quãng (SM-2 rút gọn kết hợp 5 hộp Leitner).
 * Mỗi từ lưu { box, ease, interval, due, lapses } với 3 mức đánh giá:
 * "again" (Quên), "hard" (Khó), "good" (Nhớ).
 */

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const MAX_BOX = 5;

export function createInitialSrsState() {
  return {
    box: 0,
    ease: DEFAULT_EASE,
    interval: 0,
    due: null,
    lapses: 0,
  };
}

export function normalizeSrsState(state) {
  const base = createInitialSrsState();
  if (!state || typeof state !== "object") return base;
  const rawBox = Number(state.box);
  const rawEase = Number(state.ease);
  const rawInterval = Number(state.interval);
  const rawLapses = Number(state.lapses);

  return {
    box: Number.isFinite(rawBox) ? Math.min(MAX_BOX, Math.max(0, Math.round(rawBox))) : 0,
    ease: Number.isFinite(rawEase)
      ? Math.min(MAX_EASE, Math.max(MIN_EASE, Number(rawEase.toFixed(2))))
      : DEFAULT_EASE,
    interval: Number.isFinite(rawInterval) ? Math.max(0, Math.round(rawInterval)) : 0,
    due: typeof state.due === "string" && state.due ? state.due : null,
    lapses: Number.isFinite(rawLapses) ? Math.max(0, Math.round(rawLapses)) : 0,
  };
}

export function addDaysIso(isoDate, days) {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + Number(days || 0));
  const dt = new Date(utc);
  const yr = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dy = String(dt.getUTCDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
}

export function isDueOnOrBefore(state, todayIso) {
  return Boolean(state && state.box > 0 && state.due && state.due <= todayIso);
}

/**
 * Cập nhật trạng thái SRS cho 1 thẻ dựa trên mức đánh giá ("again" | "hard" | "good").
 */
export function reviewCard(prevState, grade, todayIso) {
  const prev = normalizeSrsState(prevState);

  if (grade === "again") {
    const ease = Math.max(MIN_EASE, Number((prev.ease - 0.2).toFixed(2)));
    return {
      box: 1,
      ease,
      interval: 0,
      due: todayIso,
      lapses: prev.lapses + 1,
    };
  }

  if (grade === "hard") {
    const ease = Math.max(MIN_EASE, Number((prev.ease - 0.15).toFixed(2)));
    const box = prev.box === 0 ? 1 : Math.min(MAX_BOX, Math.max(1, prev.box));
    const interval = prev.interval <= 0 ? 1 : Math.max(1, Math.round(prev.interval * 1.2));
    return {
      box,
      ease,
      interval,
      due: addDaysIso(todayIso, interval),
      lapses: prev.lapses,
    };
  }

  if (grade === "good") {
    const ease = Math.min(MAX_EASE, Number((prev.ease + 0.05).toFixed(2)));
    const box = Math.min(MAX_BOX, prev.box + 1);
    let interval;
    if (prev.box === 0 || prev.interval <= 0) {
      interval = 1;
    } else if (prev.interval === 1) {
      interval = 3;
    } else {
      interval = Math.max(prev.interval + 1, Math.round(prev.interval * ease));
    }

    return {
      box,
      ease,
      interval,
      due: addDaysIso(todayIso, interval),
      lapses: prev.lapses,
    };
  }

  throw new Error(`Unsupported SRS grade: ${grade}`);
}

export function previewIntervals(prevState, todayIso) {
  return {
    again: 0,
    hard: reviewCard(prevState, "hard", todayIso).interval,
    good: reviewCard(prevState, "good", todayIso).interval,
  };
}
