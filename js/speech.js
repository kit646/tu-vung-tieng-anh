/**
 * Phát âm tiếng Anh bằng Web Speech API (ưu tiên giọng en-GB, hỗ trợ 0.8x / 1.0x).
 * Trả về isSpeechSupported() = false nếu trình duyệt không hỗ trợ để UI tự ẩn nút.
 */

import { getSettings } from "./store.js";

let cachedVoice = null;
let voicesInitialized = false;

export function isSpeechSupported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

function pickPreferredVoice() {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const exactGb = voices.find((v) => v.lang.toLowerCase() === "en-gb");
  if (exactGb) return exactGb;

  const startsGb = voices.find((v) => v.lang.toLowerCase().startsWith("en-gb"));
  if (startsGb) return startsGb;

  const anyEn = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  return anyEn || null;
}

export function initSpeech() {
  if (!isSpeechSupported() || voicesInitialized) return;
  voicesInitialized = true;
  cachedVoice = pickPreferredVoice();

  if (typeof window.speechSynthesis.addEventListener === "function") {
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      cachedVoice = pickPreferredVoice();
    });
  }
}

export function speakText(text, rateOverride = null) {
  if (!isSpeechSupported() || !text) return false;
  if (!cachedVoice) {
    cachedVoice = pickPreferredVoice();
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = rateOverride ?? getSettings().speechRate ?? 1.0;
  if (cachedVoice) {
    utterance.voice = cachedVoice;
  }

  synth.speak(utterance);
  return true;
}
