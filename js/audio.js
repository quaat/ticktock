// ============================================================================
// audio.js — synthesized SFX (Web Audio) + speech (SpeechSynthesis)
//
// NOTE: A production build would use pre-recorded audio by native voice actors
// (the design spec warns against TTS for mispronunciations of e.g. "halv tre").
// For this prototype we use SpeechSynthesis with the best available Norwegian
// voice, falling back to text on devices without one.
// ============================================================================

import { getState } from "./state.js";
import { speakTime } from "./i18n.js";

let ctx = null;
function audio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { ctx = null; }
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Call once on first user gesture to unlock audio on iOS
export function unlockAudio() {
  const c = audio(); if (!c) return;
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource(); s.buffer = b;
  s.connect(c.destination); s.start(0);
}

function sfxVol() { return (getState().settings.sfx ?? 80) / 100; }
function voiceVol() { return (getState().settings.voice ?? 100) / 100; }

// -----------------------------------------------------------------------------
// Tone helpers
// -----------------------------------------------------------------------------
function tone({ freq = 440, dur = 0.15, type = "sine", attack = 0.005, release = 0.08, gain = 0.3, slideTo = null }) {
  const c = audio(); if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo != null) osc.frequency.linearRampToValueAtTime(slideTo, now + dur);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain * sfxVol(), now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + dur + release + 0.05);
}

// Pentatonic notes for hand-drag (C major pentatonic: C D E G A)
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0, 2349.3];

export function sfxTick(index = 0) {
  tone({ freq: PENTA[((index % 12) + 12) % 12], dur: 0.1, type: "triangle", gain: 0.18, release: 0.05 });
}

export function sfxPop() {
  tone({ freq: 700, slideTo: 300, dur: 0.08, type: "sine", gain: 0.22 });
}

export function sfxChime() {
  // rising 3-note arpeggio C-E-G
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => setTimeout(() => tone({ freq: f, dur: 0.2, type: "sine", gain: 0.25 }), i * 90));
}

export function sfxSoftMiss() {
  tone({ freq: 220, dur: 0.14, type: "triangle", gain: 0.18, release: 0.1 });
}

export function sfxSparkle() {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => tone({
      freq: 1800 + Math.random() * 1200,
      dur: 0.08, type: "sine", gain: 0.1, release: 0.04
    }), i * 40);
  }
}

export function sfxUnlock() {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((f, i) => setTimeout(() => tone({ freq: f, dur: 0.18, type: "triangle", gain: 0.22 }), i * 80));
}

// -----------------------------------------------------------------------------
// Background music: a gentle marimba-like loop using pentatonic notes
// -----------------------------------------------------------------------------
let musicTimer = null;
export function startMusic() {
  stopMusic();
  const vol = (getState().settings.music ?? 50) / 100 * 0.12;
  if (vol <= 0) return;
  const pattern = [0, 2, 4, 2, 5, 4, 2, 0];
  let i = 0;
  const play = () => {
    const c = audio(); if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(PENTA[pattern[i % pattern.length]], now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g).connect(c.destination);
    osc.start(now); osc.stop(now + 0.5);
    i++;
  };
  musicTimer = setInterval(play, 520);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

// -----------------------------------------------------------------------------
// Speech (time phrases + general strings)
// -----------------------------------------------------------------------------
let voices = [];
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
  const candidates = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(prefix));
  if (candidates.length) {
    // prefer local, female-sounding, higher quality
    const prio = candidates.find(v => /female|child|kid|nora|nora|stine|kari|samantha|karen|moira/i.test(v.name));
    return prio || candidates[0];
  }
  // broader fallback for Norwegian
  if (lang === "no") {
    const no = voices.find(v => /no|nb|nn/i.test(v.lang));
    if (no) return no;
  }
  return null;
}

export function speak(text, lang = "en") {
  if (!("speechSynthesis" in window)) return;
  if (voiceVol() <= 0) return;
  try { window.speechSynthesis.cancel(); } catch {}
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.lang = lang === "no" ? "nb-NO" : "en-US";
  u.rate = 0.92;
  u.pitch = 1.15;
  u.volume = voiceVol();
  window.speechSynthesis.speak(u);
}

export function speakTheTime(h, m) {
  const s = getState();
  const lang = s.language || "en";
  const phrase = speakTime(h, m, lang);
  speak(phrase, lang);
  // "Both languages" bonus mode: repeat in the other language
  if (s.bothLangs) {
    const other = lang === "en" ? "no" : "en";
    setTimeout(() => speak(speakTime(h, m, other), other), 1400);
  }
}
