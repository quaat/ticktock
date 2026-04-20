// ============================================================================
// audio.js — synthesized music/SFX plus bilingual speech replay helpers
// ============================================================================

import { speakTime, t } from "./i18n.js";
import { getLanguage, getReplayLanguage, getState, recordReplayLanguage } from "./state.js";

let ctx = null;
let musicTimer = null;
let voices = [];

const MUSIC_PATTERNS = {
  town: [0, 2, 4, 2, 5, 4, 2, 0],
  bakery: [0, 4, 5, 4, 2, 0, 2, 4],
  garden: [2, 4, 7, 4, 2, 4, 9, 7],
  station: [0, 5, 7, 5, 4, 2, 4, 7],
  lighthouse: [0, 7, 5, 7, 9, 7, 5, 2],
  market: [0, 2, 7, 5, 2, 4, 7, 9],
  routine: [0, 4, 2, 5, 4, 2, 0, 2],
  freeplay: [0, 2, 4, 7, 9, 7, 4, 2],
};

const PENTA = [
  523.25, 587.33, 659.25, 783.99, 880.0,
  1046.5, 1174.7, 1318.5, 1568.0, 1760.0,
];

function audio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlockAudio() {
  const c = audio();
  if (!c) return;
  const buffer = c.createBuffer(1, 1, 22050);
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.connect(c.destination);
  source.start(0);
}

function sfxVol() {
  return (getState().settings.sfx ?? 80) / 100;
}

function voiceVol() {
  return (getState().settings.voice ?? 100) / 100;
}

function tone({ freq = 440, dur = 0.15, type = "sine", attack = 0.005, release = 0.08, gain = 0.3, slideTo = null }) {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo != null) osc.frequency.linearRampToValueAtTime(slideTo, now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(gain * sfxVol(), now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + dur + release + 0.05);
}

export function sfxTick(index = 0) {
  tone({ freq: PENTA[Math.abs(index) % PENTA.length], dur: 0.08, type: "triangle", gain: 0.15, release: 0.04 });
}

export function sfxPop() {
  tone({ freq: 720, slideTo: 320, dur: 0.08, type: "sine", gain: 0.2 });
}

export function sfxChime() {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    setTimeout(() => tone({ freq, dur: 0.2, type: "sine", gain: 0.22 }), index * 85);
  });
}

export function sfxSoftMiss() {
  tone({ freq: 240, dur: 0.14, type: "triangle", gain: 0.16, release: 0.08 });
}

export function sfxSparkle() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      tone({
        freq: 1600 + (Math.random() * 1200),
        dur: 0.06,
        type: "sine",
        gain: 0.1,
        release: 0.05,
      });
    }, i * 45);
  }
}

export function sfxHint() {
  [784, 988, 1174].forEach((freq, index) => {
    setTimeout(() => tone({ freq, dur: 0.12, type: "triangle", gain: 0.12 }), index * 70);
  });
}

export function sfxUnlock() {
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, index) => {
    setTimeout(() => tone({ freq, dur: 0.18, type: "triangle", gain: 0.21 }), index * 80);
  });
}

export function startMusic(theme = "town") {
  stopMusic();
  const vol = ((getState().settings.music ?? 55) / 100) * 0.1;
  if (vol <= 0) return;
  const pattern = MUSIC_PATTERNS[theme] || MUSIC_PATTERNS.town;
  let i = 0;
  musicTimer = setInterval(() => {
    const c = audio();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(PENTA[pattern[i % pattern.length] % PENTA.length], now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.5);
    i += 1;
  }, 520);
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  voices = window.speechSynthesis.getVoices();
}

if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice(lang) {
  if (!voices.length) loadVoices();
  const prefix = lang === "no" ? "nb" : "en";
  const matches = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(prefix));
  if (matches.length) {
    return matches.find((voice) => /nora|stine|kari|samantha|karen|moira|ava|serena/i.test(voice.name)) || matches[0];
  }
  if (lang === "no") {
    return voices.find((voice) => /no|nb|nn/i.test(voice.lang)) || null;
  }
  return voices.find((voice) => /^en/i.test(voice.lang)) || null;
}

export function speak(text, lang = getLanguage()) {
  if (!("speechSynthesis" in window)) return;
  if (voiceVol() <= 0 || !text) return;
  try { window.speechSynthesis.cancel(); } catch {}
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.lang = lang === "no" ? "nb-NO" : "en-US";
  utterance.rate = 0.92;
  utterance.pitch = 1.1;
  utterance.volume = voiceVol();
  window.speechSynthesis.speak(utterance);
}

export function speakSequence(items = []) {
  if (!items.length) return;
  const [first, ...rest] = items;
  speak(first.text, first.lang);
  rest.reduce((delay, item) => {
    setTimeout(() => speak(item.text, item.lang), delay);
    return delay + (item.delay || 1300);
  }, first.delay || 1300);
}

export function createReplayHandler(primary, secondary = null) {
  let count = 0;
  return () => {
    count += 1;
    const useSecondary = secondary && count % 2 === 0;
    const payload = useSecondary ? secondary : primary;
    if (!payload) return;
    speak(payload.text, payload.lang);
    if (useSecondary) recordReplayLanguage(payload.lang);
  };
}

export function speakTheTime(h, m, opts = {}) {
  const primaryLang = opts.lang || getLanguage();
  const secondaryLang = opts.secondaryLang ?? getReplayLanguage();
  const primary = { text: speakTime(h, m, primaryLang), lang: primaryLang };
  speak(primary.text, primary.lang);
  if (opts.echoSecondary && secondaryLang) {
    setTimeout(() => {
      speak(speakTime(h, m, secondaryLang), secondaryLang);
      recordReplayLanguage(secondaryLang);
    }, opts.delay || 1400);
  }
}

export function describeReplayButton() {
  return getReplayLanguage()
    ? `${t("replay_primary", getLanguage())} / ${t("replay_secondary", getLanguage())}`
    : t("replay_primary", getLanguage());
}
