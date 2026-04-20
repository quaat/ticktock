// ============================================================================
// state.js — persisted app state + simple event bus
// ============================================================================

const KEY = "ticktock-town-v1";

const DEFAULT_STATE = {
  language: null,            // 'en' | 'no' | null (not chosen yet)
  bothLangs: false,          // bonus: repeat in other language
  onboarded: false,
  stars: 0,
  outfit: "default",
  unlockedOutfits: ["default"],
  trophies: [],              // array of {game, item, date}
  progress: {                // per-game: { stars, best, level }
    bakery:    { stars: 0, level: 1 },
    garden:    { stars: 0, level: 1 },
    station:   { stars: 0, level: 1 },
    lighthouse:{ stars: 0, level: 1 },
    market:    { stars: 0, level: 1 },
    routine:   { stars: 0, level: 1 },
    freeplay:  { stars: 0, level: 1 },
  },
  unlocked: {                // which buildings are open
    bakery: true,
    garden: false,
    station: false,
    lighthouse: false,
    market: false,
    routine: false,
    freeplay: true,
  },
  settings: {
    music: 50,
    sfx: 80,
    voice: 100,
    reducedMotion: false,
    dyslexiaFont: false,
    highContrast: false,
    sessionMinutes: 0,  // 0 = unlimited
  },
  sessionStart: null,
};

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const saved = JSON.parse(raw);
    return deepMerge(structuredClone(DEFAULT_STATE), saved);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function deepMerge(base, override) {
  for (const k of Object.keys(override)) {
    if (override[k] && typeof override[k] === "object" && !Array.isArray(override[k])) {
      base[k] = deepMerge(base[k] || {}, override[k]);
    } else {
      base[k] = override[k];
    }
  }
  return base;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function getState() { return state; }

export function setState(partial) {
  state = deepMerge(state, partial);
  persist();
  for (const fn of listeners) fn(state);
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addStars(n) {
  state.stars = Math.max(0, state.stars + n);
  persist();
  for (const fn of listeners) fn(state);
}

export function recordResult(game, starsEarned) {
  const g = state.progress[game] || (state.progress[game] = { stars: 0, level: 1 });
  g.stars = Math.max(g.stars, starsEarned);
  addStars(starsEarned);
  // unlock next building based on total stars
  const unlockOrder = ["bakery","garden","station","lighthouse","market","routine"];
  const thresholds =  [0,        3,       6,       10,           14,      18];
  for (let i = 0; i < unlockOrder.length; i++) {
    if (state.stars >= thresholds[i]) state.unlocked[unlockOrder[i]] = true;
  }
  // outfit unlocks
  const outfitThresholds = [
    { stars: 5,  id: "baker",   icon: "👨‍🍳" },
    { stars: 10, id: "gardener",icon: "🌻" },
    { stars: 15, id: "conductor",icon: "🧢" },
    { stars: 20, id: "captain", icon: "⚓" },
    { stars: 30, id: "wizard",  icon: "🎩" },
  ];
  for (const o of outfitThresholds) {
    if (state.stars >= o.stars && !state.unlockedOutfits.includes(o.id)) {
      state.unlockedOutfits.push(o.id);
    }
  }
  persist();
  for (const fn of listeners) fn(state);
}

export function addTrophy(game, item) {
  state.trophies.push({ game, item, date: Date.now() });
  persist();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = structuredClone(DEFAULT_STATE);
  for (const fn of listeners) fn(state);
}

export const OUTFITS = [
  { id: "default",   label: "Tikko",     icon: "🦉", stars: 0 },
  { id: "baker",     label: "Baker",     icon: "👨‍🍳", stars: 5 },
  { id: "gardener",  label: "Gardener",  icon: "🌻",   stars: 10 },
  { id: "conductor", label: "Conductor", icon: "🧢",   stars: 15 },
  { id: "captain",   label: "Captain",   icon: "⚓",   stars: 20 },
  { id: "wizard",    label: "Wizard",    icon: "🎩",   stars: 30 },
];
