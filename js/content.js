// ============================================================================
// content.js — game content map, stage progression, and local mission helpers
// ============================================================================

export const AGE_BANDS = [
  { id: "4-5", label: "4–5", stage: 1, starsPerRound: 1.1 },
  { id: "6-7", label: "6–7", stage: 2, starsPerRound: 1.2 },
  { id: "8-9", label: "8–9", stage: 3, starsPerRound: 1.3 },
];

export const STAGES = [
  {
    index: 1,
    id: "time-friends",
    titleKey: "stage_1_title",
    subtitleKey: "stage_1_subtitle",
    minStars: 0,
    missionGames: ["bakery", "routine"],
    practiceGames: ["bakery", "routine", "freeplay"],
    skills: ["hour"],
  },
  {
    index: 2,
    id: "halfway-helpers",
    titleKey: "stage_2_title",
    subtitleKey: "stage_2_subtitle",
    minStars: 4,
    missionGames: ["garden", "bakery", "routine"],
    practiceGames: ["garden", "bakery", "routine", "freeplay"],
    skills: ["hour", "half"],
  },
  {
    index: 3,
    id: "quarter-quest",
    titleKey: "stage_3_title",
    subtitleKey: "stage_3_subtitle",
    minStars: 9,
    missionGames: ["station", "garden", "market"],
    practiceGames: ["station", "garden", "market", "routine", "freeplay"],
    skills: ["hour", "half", "quarter"],
  },
  {
    index: 4,
    id: "clock-explorer",
    titleKey: "stage_4_title",
    subtitleKey: "stage_4_subtitle",
    minStars: 15,
    missionGames: ["lighthouse", "market", "station"],
    practiceGames: ["lighthouse", "market", "station", "garden", "freeplay"],
    skills: ["hour", "half", "quarter", "5min"],
  },
  {
    index: 5,
    id: "time-master-mix",
    titleKey: "stage_5_title",
    subtitleKey: "stage_5_subtitle",
    minStars: 24,
    missionGames: ["daily", "lighthouse", "market"],
    practiceGames: ["daily", "lighthouse", "market", "routine", "freeplay"],
    skills: ["hour", "half", "quarter", "5min", "mix"],
  },
];

export const GAME_ORDER = [
  "bakery",
  "garden",
  "station",
  "lighthouse",
  "market",
  "routine",
  "freeplay",
];

export const GAME_META = {
  bakery: {
    key: "bakery",
    titleKey: "b_bakery",
    icon: "🥐",
    unlockStage: 1,
    sticker: "🥐",
    trophy: "🥐",
    medalKey: "medal_bakery",
  },
  garden: {
    key: "garden",
    titleKey: "b_garden",
    icon: "🌻",
    unlockStage: 2,
    sticker: "🌻",
    trophy: "🌷",
    medalKey: "medal_garden",
  },
  station: {
    key: "station",
    titleKey: "b_station",
    icon: "🚂",
    unlockStage: 3,
    sticker: "🎫",
    trophy: "🚂",
    medalKey: "medal_station",
  },
  lighthouse: {
    key: "lighthouse",
    titleKey: "b_lighthouse",
    icon: "🗼",
    unlockStage: 4,
    sticker: "💡",
    trophy: "💡",
    medalKey: "medal_lighthouse",
  },
  market: {
    key: "market",
    titleKey: "b_market",
    icon: "🛒",
    unlockStage: 3,
    sticker: "🏷️",
    trophy: "🏅",
    medalKey: "medal_market",
  },
  routine: {
    key: "routine",
    titleKey: "b_routine",
    icon: "📖",
    unlockStage: 1,
    sticker: "🌙",
    trophy: "⭐",
    medalKey: "medal_routine",
  },
  freeplay: {
    key: "freeplay",
    titleKey: "b_tower",
    icon: "🕰️",
    unlockStage: 1,
    sticker: "🌤️",
    trophy: "🌟",
    medalKey: "medal_freeplay",
  },
  daily: {
    key: "daily",
    titleKey: "daily_mission",
    icon: "🎯",
    unlockStage: 1,
    sticker: "🎯",
    trophy: "🎯",
    medalKey: "medal_daily",
  },
};

export const OUTFITS = [
  { id: "default", label: "Tikko", icon: "🦉", stars: 0 },
  { id: "baker", label: "Baker", icon: "👨‍🍳", stars: 5 },
  { id: "gardener", label: "Gardener", icon: "🌻", stars: 10 },
  { id: "conductor", label: "Conductor", icon: "🧢", stars: 16 },
  { id: "captain", label: "Captain", icon: "⚓", stars: 24 },
  { id: "wizard", label: "Wizard", icon: "🎩", stars: 34 },
];

export function createEmptyProgress() {
  return {
    bakery: makeGameProgress(),
    garden: makeGameProgress(),
    station: makeGameProgress(),
    lighthouse: makeGameProgress(),
    market: makeGameProgress(),
    routine: makeGameProgress(),
    freeplay: makeGameProgress(),
    daily: makeGameProgress(),
  };
}

export function makeGameProgress() {
  return {
    stars: 0,
    level: 1,
    roundsPlayed: 0,
    completed: 0,
    mastered: false,
    hintsUsed: 0,
    firstTryWins: 0,
    misses: 0,
    stickers: [],
    decorations: 0,
  };
}

export function getAgeBand(ageBandId) {
  return AGE_BANDS.find((band) => band.id === ageBandId) || AGE_BANDS[1];
}

export function getStageByStars(stars = 0) {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (stars >= stage.minStars) current = stage;
  }
  return current;
}

export function getStageByIndex(index = 1) {
  return STAGES.find((stage) => stage.index === index) || STAGES[0];
}

export function getUnlockedGames(stageIndex = 1) {
  return Object.values(GAME_META)
    .filter((game) => game.key !== "daily")
    .filter((game) => game.unlockStage <= stageIndex)
    .map((game) => game.key);
}

export function getRecommendedGame(profile) {
  const stage = getStageByStars(profile.stars);
  const unlocked = new Set(getUnlockedGames(stage.index));
  const ordered = stage.practiceGames.filter((key) => unlocked.has(key));
  ordered.push(...GAME_ORDER.filter((key) => unlocked.has(key) && !ordered.includes(key)));
  let best = ordered[0] || "bakery";
  let bestScore = Number.POSITIVE_INFINITY;
  for (const key of ordered) {
    const progress = profile.progress[key];
    const score = (progress.completed * 4) + (progress.mastered ? 5 : 0) + progress.level;
    if (score < bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best;
}

export function nextGameAfter(game, profile) {
  const recommended = getRecommendedGame(profile);
  if (recommended !== game) return recommended;
  const unlocked = getUnlockedGames(getStageByStars(profile.stars).index);
  const currentIndex = unlocked.indexOf(game);
  return unlocked[(currentIndex + 1 + unlocked.length) % unlocked.length] || "bakery";
}

export function getTodayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function seededPick(seed, list) {
  if (!list.length) return null;
  let acc = 0;
  for (const ch of seed) acc = (acc * 31 + ch.charCodeAt(0)) % 2147483647;
  return list[acc % list.length];
}

export function buildDailyMission(profile, dateKey = getTodayKey()) {
  const stage = getStageByStars(profile.stars);
  const game = seededPick(`${profile.id}:${dateKey}:${stage.id}`, stage.missionGames) || "bakery";
  return {
    dateKey,
    game,
    complete: false,
    starsEarned: 0,
    labelKey: GAME_META[game]?.titleKey || "b_bakery",
  };
}

export function getMood(profile) {
  const telemetry = profile.telemetry || {};
  const hints = telemetry.hintsUsed || 0;
  const wins = telemetry.firstTryWins || 0;
  if (wins >= hints + 8) return "spark";
  if (hints > wins + 4) return "coach";
  return "cheer";
}

export function getSessionSummary(profile) {
  const telemetry = profile.telemetry || {};
  return {
    roundsPlayed: telemetry.roundsPlayed || 0,
    firstTryWins: telemetry.firstTryWins || 0,
    hintsUsed: telemetry.hintsUsed || 0,
    preferredReplayLanguage: telemetry.preferredReplayLanguage || "none",
  };
}
