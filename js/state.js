// ============================================================================
// state.js — persisted app state, active child profile helpers, telemetry
// ============================================================================

import {
  OUTFITS,
  buildDailyMission,
  createEmptyProgress,
  getMood,
  getRecommendedGame,
  getSessionSummary,
  getStageByStars,
  getTodayKey,
  nextGameAfter,
} from "./content.js";

const KEY = "ticktock-town-v2";
const LEGACY_KEYS = ["ticktock-town-v1"];

function createProfile(id, name = "Sunny") {
  return {
    id,
    name,
    ageBand: "6-7",
    primaryLanguage: null,
    secondaryReplayLanguage: null,
    setupComplete: false,
    onboarded: false,
    stars: 0,
    streak: 0,
    lastPlayedDay: null,
    outfit: "default",
    unlockedOutfits: ["default"],
    trophies: [],
    stickers: [{ id: "welcome-sun", icon: "🌞", label: "Welcome Sun" }],
    medals: [],
    decorations: [],
    progress: createEmptyProgress(),
    telemetry: {
      roundsPlayed: 0,
      firstTryWins: 0,
      hintsUsed: 0,
      preferredReplayLanguage: "none",
      byGame: {},
    },
    dailyMission: {
      dateKey: "",
      game: "bakery",
      complete: false,
      starsEarned: 0,
      labelKey: "b_bakery",
    },
    rewardQueue: [
      {
        type: "sticker",
        icon: "🌞",
        label: "Starter Sticker",
        description: "Welcome to TickTock Town!",
      },
    ],
  };
}

const DEFAULT_STATE = {
  activeProfileId: "p1",
  profiles: {
    p1: createProfile("p1", "Sunny"),
  },
  settings: {
    music: 55,
    sfx: 82,
    voice: 100,
    reducedMotion: false,
    dyslexiaFont: false,
    highContrast: false,
    captions: true,
    sessionMinutes: 10,
  },
  sessionStart: null,
  currentRoute: "boot",
};

let state = load();
const listeners = new Set();

function load() {
  const raw = readCurrent() || readLegacy();
  const merged = deepMerge(structuredClone(DEFAULT_STATE), raw || {});
  const normalized = normalizeState(merged);
  persist(normalized);
  return normalized;
}

function readCurrent() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readLegacy() {
  for (const legacyKey of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(legacyKey);
      if (!raw) continue;
      return migrateLegacy(JSON.parse(raw));
    } catch {
      // ignore broken legacy saves
    }
  }
  return null;
}

function migrateLegacy(legacy) {
  const profile = createProfile("p1", "Sunny");
  profile.primaryLanguage = legacy.language || null;
  profile.secondaryReplayLanguage = legacy.bothLangs
    ? (legacy.language === "no" ? "en" : "no")
    : null;
  profile.setupComplete = !!legacy.language;
  profile.onboarded = !!legacy.onboarded;
  profile.stars = legacy.stars || 0;
  profile.outfit = legacy.outfit || "default";
  profile.unlockedOutfits = legacy.unlockedOutfits || ["default"];
  profile.trophies = legacy.trophies || [];
  profile.progress = deepMerge(createEmptyProgress(), legacy.progress || {});
  return {
    activeProfileId: "p1",
    profiles: { p1: profile },
    settings: deepMerge(structuredClone(DEFAULT_STATE.settings), legacy.settings || {}),
    sessionStart: null,
    currentRoute: "boot",
  };
}

function normalizeState(raw) {
  const next = deepMerge(structuredClone(DEFAULT_STATE), raw || {});
  if (!next.profiles || !Object.keys(next.profiles).length) {
    next.profiles = { p1: createProfile("p1", "Sunny") };
    next.activeProfileId = "p1";
  }
  if (!next.profiles[next.activeProfileId]) {
    next.activeProfileId = Object.keys(next.profiles)[0];
  }
  for (const [id, profile] of Object.entries(next.profiles)) {
    next.profiles[id] = normalizeProfile(id, profile);
  }
  return next;
}

function normalizeProfile(id, profile) {
  const base = deepMerge(createProfile(id, profile?.name || "Sunny"), profile || {});
  base.id = id;
  base.progress = deepMerge(createEmptyProgress(), profile?.progress || {});
  base.primaryLanguage = profile?.primaryLanguage || null;
  base.secondaryReplayLanguage = profile?.secondaryReplayLanguage || null;
  if (base.primaryLanguage && base.secondaryReplayLanguage === base.primaryLanguage) {
    base.secondaryReplayLanguage = null;
  }
  if (base.stars >= 0) {
    for (const outfit of OUTFITS) {
      if (base.stars >= outfit.stars && !base.unlockedOutfits.includes(outfit.id)) {
        base.unlockedOutfits.push(outfit.id);
      }
    }
  }
  const mission = base.dailyMission || {};
  const dateKey = getTodayKey();
  if (!mission.dateKey || mission.dateKey !== dateKey) {
    base.dailyMission = buildDailyMission(base, dateKey);
  }
  if (!Array.isArray(base.rewardQueue)) base.rewardQueue = [];
  if (!Array.isArray(base.stickers) || !base.stickers.length) {
    base.stickers = [{ id: "welcome-sun", icon: "🌞", label: "Welcome Sun" }];
  }
  return base;
}

function deepMerge(base, override) {
  if (!override || typeof override !== "object") return base;
  for (const key of Object.keys(override)) {
    const value = override[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      base[key] = deepMerge(base[key] || {}, value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function persist(nextState = state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(nextState));
  } catch {
    // ignore persistence failures
  }
}

function notify() {
  persist();
  for (const fn of listeners) fn(state);
}

export function getState() {
  return state;
}

export function getActiveProfile(current = state) {
  return current.profiles[current.activeProfileId];
}

export function getLanguage(current = state) {
  return getActiveProfile(current).primaryLanguage || "en";
}

export function getReplayLanguage(current = state) {
  return getActiveProfile(current).secondaryReplayLanguage || null;
}

export function setState(partial) {
  state = normalizeState(deepMerge(state, partial));
  notify();
}

export function setActiveProfile(id) {
  if (!state.profiles[id]) return;
  state.activeProfileId = id;
  state = normalizeState(state);
  notify();
}

export function createProfileRecord({ name, ageBand, primaryLanguage }) {
  const id = `p${Date.now().toString(36)}`;
  const profile = createProfile(id, name || `Explorer ${Object.keys(state.profiles).length + 1}`);
  profile.ageBand = ageBand || "6-7";
  profile.primaryLanguage = primaryLanguage || getLanguage();
  state.profiles[id] = profile;
  state.activeProfileId = id;
  state = normalizeState(state);
  notify();
}

export function updateActiveProfile(patch) {
  const profile = getActiveProfile();
  state.profiles[state.activeProfileId] = normalizeProfile(
    state.activeProfileId,
    deepMerge(profile, patch || {})
  );
  state = normalizeState(state);
  notify();
}

export function updateProgress(game, patch) {
  const profile = getActiveProfile();
  profile.progress[game] = deepMerge(profile.progress[game] || {}, patch || {});
  state = normalizeState(state);
  notify();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function queueReward(reward) {
  const profile = getActiveProfile();
  profile.rewardQueue.unshift(reward);
  state = normalizeState(state);
  notify();
}

export function shiftRewardQueue() {
  const profile = getActiveProfile();
  const reward = profile.rewardQueue.shift() || null;
  state = normalizeState(state);
  notify();
  return reward;
}

export function ensureDailyMission() {
  const profile = getActiveProfile();
  const today = getTodayKey();
  if (!profile.dailyMission || profile.dailyMission.dateKey !== today) {
    profile.dailyMission = buildDailyMission(profile, today);
    state = normalizeState(state);
    notify();
  }
  return profile.dailyMission;
}

export function recordReplayLanguage(lang) {
  const profile = getActiveProfile();
  profile.telemetry.preferredReplayLanguage = lang || "none";
  state = normalizeState(state);
  notify();
}

export function addTelemetry(game, patch = {}) {
  const profile = getActiveProfile();
  const gameStats = profile.telemetry.byGame[game] || {
    roundsPlayed: 0,
    misses: 0,
    hintsUsed: 0,
    firstTryWins: 0,
  };
  profile.telemetry.byGame[game] = deepMerge(gameStats, patch);
  state = normalizeState(state);
  notify();
}

export function recordRound(game, summary) {
  const profile = getActiveProfile();
  const progress = profile.progress[game] || createEmptyProgress()[game];
  const starsEarned = Math.max(1, Math.min(3, summary.starsEarned || 1));
  const hintsUsed = summary.hintsUsed || 0;
  const firstTryWins = summary.firstTryWins || 0;
  const misses = summary.misses || 0;
  const mastered = !!summary.mastered;
  progress.stars = Math.max(progress.stars, starsEarned);
  progress.level = Math.max(progress.level || 1, (summary.level || 1));
  progress.roundsPlayed = (progress.roundsPlayed || 0) + 1;
  progress.completed = (progress.completed || 0) + 1;
  progress.hintsUsed = (progress.hintsUsed || 0) + hintsUsed;
  progress.firstTryWins = (progress.firstTryWins || 0) + firstTryWins;
  progress.misses = (progress.misses || 0) + misses;
  if (mastered) progress.mastered = true;
  progress.decorations = Math.max(progress.decorations || 0, progress.stars);
  profile.progress[game] = progress;

  profile.stars += starsEarned;
  profile.telemetry.roundsPlayed += 1;
  profile.telemetry.firstTryWins += firstTryWins;
  profile.telemetry.hintsUsed += hintsUsed;
  addByGameStat(profile.telemetry.byGame, game, {
    roundsPlayed: (profile.telemetry.byGame[game]?.roundsPlayed || 0) + 1,
    misses: (profile.telemetry.byGame[game]?.misses || 0) + misses,
    hintsUsed: (profile.telemetry.byGame[game]?.hintsUsed || 0) + hintsUsed,
    firstTryWins: (profile.telemetry.byGame[game]?.firstTryWins || 0) + firstTryWins,
  });

  applyStreak(profile);
  awardUnlocks(profile);
  awardRoundRewards(profile, game, starsEarned, mastered);
  maybeCompleteMission(profile, game, starsEarned);
  profile.dailyMission = buildOrKeepMission(profile);

  state = normalizeState(state);
  notify();
}

function addByGameStat(store, game, next) {
  store[game] = next;
}

function applyStreak(profile) {
  const today = getTodayKey();
  if (!profile.lastPlayedDay) {
    profile.streak = 1;
  } else if (profile.lastPlayedDay === today) {
    profile.streak = Math.max(profile.streak, 1);
  } else {
    const prev = new Date(profile.lastPlayedDay);
    const next = new Date(today);
    const delta = Math.round((next - prev) / 86400000);
    profile.streak = delta === 1 ? profile.streak + 1 : 1;
  }
  profile.lastPlayedDay = today;
}

function awardUnlocks(profile) {
  for (const outfit of OUTFITS) {
    if (profile.stars >= outfit.stars && !profile.unlockedOutfits.includes(outfit.id)) {
      profile.unlockedOutfits.push(outfit.id);
      profile.rewardQueue.unshift({
        type: "outfit",
        icon: outfit.icon,
        label: outfit.label,
        description: "Tikko found a new outfit!",
      });
    }
  }
}

function awardRoundRewards(profile, game, starsEarned, mastered) {
  const stickerId = `${game}-${profile.progress[game].completed}`;
  const stickerExists = profile.stickers.some((sticker) => sticker.id === stickerId);
  if (!stickerExists) {
    const icon = {
      bakery: "🥐",
      garden: "🌷",
      station: "🎫",
      lighthouse: "💡",
      market: "🏷️",
      routine: "🌙",
      freeplay: "🌈",
      daily: "🎯",
    }[game] || "⭐";
    const sticker = { id: stickerId, icon, label: `${game} sticker` };
    profile.stickers.unshift(sticker);
    profile.rewardQueue.unshift({
      type: "sticker",
      icon: sticker.icon,
      label: sticker.label,
      description: "Sticker unlocked!",
    });
  }

  const trophyIcon = {
    bakery: "🥐",
    garden: "🌻",
    station: "🚂",
    lighthouse: "🗼",
    market: "🏅",
    routine: "📖",
    freeplay: "🌟",
    daily: "🎯",
  }[game] || "🏆";
  profile.trophies.unshift({ game, icon: trophyIcon, date: Date.now() });
  profile.trophies = profile.trophies.slice(0, 36);

  if (mastered) {
    const medalId = `${game}-mastery`;
    if (!profile.medals.some((medal) => medal.id === medalId)) {
      profile.medals.unshift({ id: medalId, icon: "🏅", game, label: "Mastery Medal" });
      profile.rewardQueue.unshift({
        type: "medal",
        icon: "🏅",
        label: "Mastery Medal",
        description: "No hints needed. Amazing work!",
      });
    }
  }

  if (starsEarned >= 3 && !profile.decorations.includes(game)) {
    profile.decorations.push(game);
  }
}

function maybeCompleteMission(profile, game, starsEarned) {
  const mission = profile.dailyMission || buildDailyMission(profile);
  if ((mission.game === game || game === "daily") && !mission.complete) {
    mission.complete = true;
    mission.starsEarned = starsEarned;
    profile.rewardQueue.unshift({
      type: "mission",
      icon: "🎯",
      label: "Daily Mission Complete",
      description: "Tikko saved a special badge for you!",
    });
  }
  profile.dailyMission = mission;
}

function buildOrKeepMission(profile) {
  const today = getTodayKey();
  if (!profile.dailyMission || profile.dailyMission.dateKey !== today) {
    return buildDailyMission(profile, today);
  }
  return profile.dailyMission;
}

export function getProgressSummary() {
  const profile = getActiveProfile();
  return {
    stage: getStageByStars(profile.stars),
    recommendedGame: getRecommendedGame(profile),
    nextGame: nextGameAfter(getRecommendedGame(profile), profile),
    mood: getMood(profile),
    telemetry: getSessionSummary(profile),
  };
}

export function resetAll() {
  for (const key of [KEY, ...LEGACY_KEYS]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  state = normalizeState(structuredClone(DEFAULT_STATE));
  notify();
}

export { OUTFITS };
