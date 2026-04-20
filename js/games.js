// ============================================================================
// games.js — premium mini-games, daily mission, and round feedback
// ============================================================================

import { createReplayHandler, speak, speakTheTime, startMusic, stopMusic, sfxChime, sfxHint, sfxPop, sfxSoftMiss, sfxSparkle, sfxUnlock } from "./audio.js";
import { GAME_META, getRecommendedGame, getStageByStars, nextGameAfter } from "./content.js";
import { createClock } from "./clock.js";
import { HINT_LINES, PRAISE_LINES, pickLine, speakTime, t, timeLabel, timePrompt } from "./i18n.js";
import { ensureDailyMission, getActiveProfile, getLanguage, getReplayLanguage, getState, recordRound } from "./state.js";

const app = () => document.getElementById("app");

function clone(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

function confetti(container, count = 40) {
  const c = document.createElement("div");
  c.className = "confetti";
  const colors = ["#FFD86B", "#FF9CAA", "#8CE0C4", "#A8D0FF", "#FFB86B", "#D9C6FF"];
  for (let i = 0; i < count; i += 1) {
    const span = document.createElement("span");
    span.style.left = `${Math.random() * 100}%`;
    span.style.background = colors[i % colors.length];
    span.style.animationDuration = `${1.5 + Math.random() * 1.2}s`;
    span.style.animationDelay = `${Math.random() * 0.3}s`;
    span.style.transform = `rotate(${Math.random() * 360}deg)`;
    c.appendChild(span);
  }
  container.appendChild(c);
  setTimeout(() => c.remove(), 3500);
}

function makeGameShell(onQuit, theme = "town") {
  const node = clone("tpl-game");
  app().innerHTML = "";
  app().appendChild(node);
  startMusic(theme);
  node.querySelector("#pause-btn").addEventListener("click", () => {
    const lang = getLanguage();
    if (confirm(lang === "no" ? "Avslutte denne runden?" : "Leave this round?")) {
      stopMusic();
      onQuit();
    }
  });
  return node;
}

function setProgressDots(node, total, complete, current) {
  const root = node.querySelector("#progress-dots");
  root.innerHTML = "";
  for (let i = 0; i < total; i += 1) {
    const dot = document.createElement("div");
    dot.className = "dot";
    if (i < complete) dot.classList.add("done");
    if (i === current) dot.classList.add("current");
    root.appendChild(dot);
  }
}

function showOverlay(node, html, { confettiCount = 0, delay = 1200, sound = "chime" } = {}) {
  const overlay = node.querySelector("#overlay");
  overlay.classList.remove("hidden");
  overlay.innerHTML = `<div class="overlay-card">${html}</div>`;
  if (confettiCount) confetti(node, confettiCount);
  if (sound === "chime") sfxChime();
  if (sound === "miss") sfxSoftMiss();
  setTimeout(() => {
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
  }, delay);
}

function calcStars(count, misses, hintsUsed) {
  if (misses === 0 && hintsUsed === 0) return 3;
  if (misses <= 2 && hintsUsed <= 1) return 2;
  return 1;
}

function rewardSummary(node, game, roundStats, onQuit) {
  const lang = getLanguage();
  recordRound(game, roundStats);
  const profile = getActiveProfile();
  const nextKey = nextGameAfter(game, profile);
  const stars = "⭐".repeat(roundStats.starsEarned) + "☆".repeat(3 - roundStats.starsEarned);
  const label = game === "daily"
    ? t("mission_complete", lang)
    : `${t("next_stop", lang)}: ${t(GAME_META[nextKey].titleKey, lang)}`;

  const overlay = node.querySelector("#overlay");
  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <div class="overlay-card reward-card">
      <div class="emoji">${GAME_META[game]?.icon || "🏆"}</div>
      <h2>${roundStats.mastered ? t("mastery_badge", lang) : t("correct", lang)}</h2>
      <div class="stars">${stars}</div>
      <div class="msg">+${roundStats.starsEarned} ⭐</div>
      <p>${label}</p>
      <div class="row">
        <button class="primary-btn" id="summary-next">${t("play_next", lang)}</button>
        <button class="ghost-btn" id="summary-town">${t("back_to_town", lang)}</button>
      </div>
    </div>`;
  confetti(node, 70);
  sfxUnlock();
  overlay.querySelector("#summary-next").addEventListener("click", () => {
    sfxPop();
    stopMusic();
    startGameByKey(nextKey, onQuit);
  });
  overlay.querySelector("#summary-town").addEventListener("click", () => {
    sfxPop();
    stopMusic();
    onQuit();
  });
}

function buildPromptCard({ icon, title, caption }) {
  const card = document.createElement("div");
  card.className = "customer-card";
  card.innerHTML = `
    <div class="customer-avatar">${icon}</div>
    <div class="customer-text">
      <div>${title}</div>
      <div class="caption-line">${caption}</div>
    </div>`;
  return card;
}

function stageFromProfile() {
  return getStageByStars(getActiveProfile().stars);
}

function pushHint(clock, readout, puzzle) {
  clock.setTime(puzzle.h, puzzle.m);
  readout.textContent = timeLabel(puzzle.h, puzzle.m);
}

function buildReplay(primaryText, puzzle) {
  const lang = getLanguage();
  const replayLanguage = getReplayLanguage();
  return createReplayHandler(
    { text: primaryText, lang },
    replayLanguage ? { text: speakTime(puzzle.h, puzzle.m, replayLanguage), lang: replayLanguage } : null,
  );
}

function setClockRound({ game, count, theme, puzzles, onQuit }) {
  const node = makeGameShell(onQuit, theme || game);
  const body = node.querySelector("#game-body");
  const lang = getLanguage();
  const settings = getState().settings;
  let index = 0;
  let solved = 0;
  let misses = 0;
  let hintsUsed = 0;
  let firstTryWins = 0;

  function renderPuzzle() {
    const puzzle = puzzles[index];
    body.innerHTML = "";
    setProgressDots(node, count, solved, index);

    const prompt = puzzle.prompt || timePrompt(game, puzzle.h, puzzle.m, lang);
    body.appendChild(buildPromptCard({
      icon: puzzle.icon || GAME_META[game]?.icon || "🦉",
      title: prompt,
      caption: settings.captions ? timeLabel(puzzle.h, puzzle.m) : t("tap_to_start", lang),
    }));

    if (puzzle.scene) body.appendChild(puzzle.scene);

    const clockWrap = document.createElement("div");
    clockWrap.className = "game-clock";
    body.appendChild(clockWrap);

    const clock = createClock(clockWrap, {
      hour: puzzle.startH ?? 12,
      minute: puzzle.startM ?? 0,
      snap: puzzle.snap,
      showNumbers: true,
      showQuarterOverlay: puzzle.snap === "quarter" || puzzle.showQuarterOverlay,
      showHalfOverlay: puzzle.snap === "half" || puzzle.showHalfOverlay,
      highlightHour: puzzle.highlightHour || null,
      onChange: (h, m) => {
        readout.textContent = timeLabel(h, m);
      },
    });

    const readout = document.createElement("div");
    readout.className = "digital-readout game-digital";
    readout.textContent = timeLabel(clock.getTime()[0], clock.getTime()[1]);
    body.appendChild(readout);

    const controls = document.createElement("div");
    controls.className = "game-controls";
    controls.innerHTML = `<button class="primary-btn">${lang === "no" ? "Sjekk" : "Check"}</button>`;
    body.appendChild(controls);

    const replay = buildReplay(prompt, puzzle);
    setTimeout(() => replay(), 350);
    node.querySelector("#replay-audio").onclick = replay;

    controls.querySelector("button").addEventListener("click", () => {
      const [h, m] = clock.getTime();
      if ((h % 12) === (puzzle.h % 12) && m === puzzle.m) {
        const wasFirstTry = (puzzle._tries || 0) === 0;
        if (wasFirstTry) firstTryWins += 1;
        solved += 1;
        clock.flashCorrect();
        showOverlay(node, `
          <div class="emoji">${puzzle.icon || "🎉"}</div>
          <h2>${pickLine(PRAISE_LINES, lang, solved)}</h2>
          <div class="msg">${speakTime(puzzle.h, puzzle.m, lang)}</div>
        `, { confettiCount: 36, delay: 950, sound: "chime" });
        speak(pickLine(PRAISE_LINES, lang, solved), lang);
        setTimeout(() => {
          index += 1;
          if (index >= count) {
            const starsEarned = calcStars(count, misses, hintsUsed);
            rewardSummary(node, game, {
              starsEarned,
              misses,
              hintsUsed,
              firstTryWins,
              mastered: hintsUsed === 0 && misses === 0,
              level: stageFromProfile().index,
            }, onQuit);
          } else {
            renderPuzzle();
          }
        }, 980);
      } else {
        puzzle._tries = (puzzle._tries || 0) + 1;
        misses += 1;
        clock.flashWrong();
        const specificHint = t(puzzle.hintKey || "hint_hour", lang);
        const message = puzzle._tries >= 2
          ? `${pickLine(HINT_LINES, lang, misses)} ${specificHint}`
          : t("try_again", lang);
        showOverlay(node, `
          <div class="emoji">🦉</div>
          <h2>${t("almost", lang)}</h2>
          <div class="msg">${message}</div>
        `, { delay: 1100, sound: "miss" });
        speak(message, lang);
        if (puzzle._tries >= 2) {
          hintsUsed += 1;
          sfxHint();
          setTimeout(() => pushHint(clock, readout, puzzle), 650);
        }
      }
    });
  }

  renderPuzzle();
}

function randomHour() {
  return 1 + Math.floor(Math.random() * 11);
}

function playBakery(onQuit) {
  const stage = stageFromProfile();
  const minutes = stage.index >= 2 ? [0, 30] : [0];
  const puzzles = Array.from({ length: 4 }, (_, i) => ({
    h: randomHour(),
    m: minutes[Math.floor(Math.random() * minutes.length)],
    snap: stage.index >= 2 ? "half" : "hour",
    icon: ["👧", "🧒", "👨‍🍳", "👵"][i % 4],
    hintKey: stage.index >= 2 ? "hint_half" : "hint_hour",
  }));
  setClockRound({ game: "bakery", count: puzzles.length, theme: "bakery", puzzles, onQuit });
}

function playGarden(onQuit) {
  const stage = stageFromProfile();
  const minutes = stage.index >= 3 ? [0, 15, 30, 45] : [0, 30];
  const puzzles = Array.from({ length: 4 }, () => {
    const m = minutes[Math.floor(Math.random() * minutes.length)];
    return {
      h: randomHour(),
      m,
      snap: m % 30 === 0 ? "half" : "quarter",
      showHalfOverlay: true,
      showQuarterOverlay: stage.index >= 3,
      icon: "🌻",
      hintKey: m % 30 === 0 ? "hint_half" : "hint_quarter",
      highlightHour: m === 30 ? 6 : null,
    };
  });
  setClockRound({ game: "garden", count: puzzles.length, theme: "garden", puzzles, onQuit });
}

function playStation(onQuit) {
  const puzzles = Array.from({ length: 4 }, () => ({
    h: randomHour(),
    m: [0, 15, 30, 45][Math.floor(Math.random() * 4)],
    snap: "quarter",
    showQuarterOverlay: true,
    showHalfOverlay: true,
    icon: "🚂",
    hintKey: "hint_quarter",
  }));
  setClockRound({ game: "station", count: puzzles.length, theme: "station", puzzles, onQuit });
}

function playLighthouse(onQuit) {
  const puzzles = Array.from({ length: 4 }, () => ({
    h: randomHour(),
    m: Math.floor(Math.random() * 12) * 5,
    snap: "5min",
    icon: "🗼",
    hintKey: "hint_five",
  }));
  setClockRound({ game: "lighthouse", count: puzzles.length, theme: "lighthouse", puzzles, onQuit });
}

function playRoutine(onQuit) {
  const lang = getLanguage();
  const stage = stageFromProfile();
  const scenes = [
    { key: "r_wakeup", icon: "🛏️", h: 7, m: 0, snap: "hour" },
    { key: "r_breakfast", icon: "🥣", h: 7, m: 30, snap: "half" },
    { key: "r_school", icon: "🎒", h: 8, m: 15, snap: "quarter" },
    { key: "r_lunch", icon: "🍱", h: 12, m: 0, snap: "hour" },
    { key: "r_play", icon: "⚽", h: 3, m: 30, snap: "half" },
    { key: "r_dinner", icon: "🍝", h: 6, m: 0, snap: "hour" },
    { key: "r_bath", icon: "🛁", h: 7, m: 30, snap: "half" },
    { key: "r_bed", icon: "🌙", h: 8, m: 0, snap: "hour" },
  ];
  const allowed = scenes.filter((scene) => {
    if (stage.index === 1) return scene.m === 0;
    if (stage.index === 2) return scene.m === 0 || scene.m === 30;
    return true;
  }).sort(() => Math.random() - 0.5).slice(0, 4);

  const puzzles = allowed.map((scene) => {
    const page = document.createElement("div");
    page.className = "routine-page";
    page.innerHTML = `
      <div class="routine-scene">${scene.icon}</div>
      <div class="routine-caption">${t(scene.key, lang)}</div>`;
    return {
      h: scene.h,
      m: scene.m,
      snap: scene.snap,
      icon: scene.icon,
      hintKey: scene.m === 0 ? "hint_hour" : (scene.m === 30 ? "hint_half" : "hint_quarter"),
      prompt: `${t("your_day", lang)} ${t(scene.key, lang)}`,
      scene: page,
    };
  });
  setClockRound({ game: "routine", count: puzzles.length, theme: "routine", puzzles, onQuit });
}

function playMarket(onQuit) {
  const node = makeGameShell(onQuit, "market");
  const body = node.querySelector("#game-body");
  const lang = getLanguage();
  const replayLang = getReplayLanguage();
  const stage = stageFromProfile();
  const times = [];
  while (times.length < 4) {
    const candidate = {
      h: randomHour(),
      m: [0, 15, 30, 45][Math.floor(Math.random() * 4)],
    };
    if (!times.some((item) => item.h === candidate.h && item.m === candidate.m)) times.push(candidate);
  }

  const cards = [];
  times.forEach((item, index) => {
    cards.push({ id: index, kind: "A", ...item });
    cards.push({
      id: index,
      kind: stage.index >= 4 && index % 2 === 0 ? "S" : "D",
      ...item,
    });
  });
  cards.sort(() => Math.random() - 0.5);

  body.appendChild(buildPromptCard({
    icon: "🛒",
    title: t("match_pairs", lang),
    caption: stage.index >= 4 ? t("replay_primary", lang) : t("daily_ready", lang),
  }));

  const grid = document.createElement("div");
  grid.className = "market-grid";
  body.appendChild(grid);

  let selected = null;
  let matches = 0;
  let misses = 0;
  let hintsUsed = 0;
  let firstTryWins = 0;

  function renderCard(card) {
    const btn = document.createElement("button");
    btn.className = "market-card";
    if (card.kind === "A") {
      btn.classList.add("mini-clock");
      const wrap = document.createElement("div");
      wrap.style.width = "100%";
      wrap.style.height = "100%";
      createClock(wrap, { hour: card.h, minute: card.m, draggable: false, showNumbers: false });
      btn.appendChild(wrap);
    } else if (card.kind === "S") {
      btn.innerHTML = `<span class="speaker-card">🔊</span><small>${t("say_time", lang)}</small>`;
    } else {
      btn.innerHTML = `<span>${timeLabel(card.h, card.m)}</span>`;
    }
    return btn;
  }

  cards.forEach((card) => {
    const btn = renderCard(card);
    btn.addEventListener("click", () => {
      if (btn.classList.contains("matched") || btn === selected?.el) return;
      sfxPop();
      if (card.kind === "S") {
        speak(speakTime(card.h, card.m, lang), lang);
        if (replayLang) node.querySelector("#replay-audio").onclick = createReplayHandler(
          { text: speakTime(card.h, card.m, lang), lang },
          { text: speakTime(card.h, card.m, replayLang), lang: replayLang }
        );
      } else {
        speakTheTime(card.h, card.m);
      }
      if (!selected) {
        btn.classList.add("selected");
        selected = { el: btn, card, firstTry: true };
        return;
      }
      if (selected.card.id === card.id && selected.card.kind !== card.kind) {
        selected.el.classList.remove("selected");
        selected.el.classList.add("matched");
        btn.classList.add("matched");
        matches += 1;
        if (selected.firstTry) firstTryWins += 1;
        selected = null;
        sfxChime();
        if (matches === times.length) {
          const starsEarned = calcStars(times.length, misses, hintsUsed);
          setTimeout(() => rewardSummary(node, "market", {
            starsEarned,
            misses,
            hintsUsed,
            firstTryWins,
            mastered: misses === 0 && hintsUsed === 0,
            level: stage.index,
          }, onQuit), 450);
        }
      } else {
        misses += 1;
        if (selected) selected.firstTry = false;
        btn.classList.add("wrong");
        selected.el.classList.add("wrong");
        sfxSoftMiss();
        if (misses >= 2) {
          hintsUsed += 1;
          sfxHint();
        }
        const old = selected;
        setTimeout(() => {
          old.el.classList.remove("selected", "wrong");
          btn.classList.remove("wrong");
          selected = null;
        }, 650);
      }
    });
    grid.appendChild(btn);
  });

  node.querySelector("#progress-dots").innerHTML = "🛒";
  node.querySelector("#replay-audio").onclick = () => speak(stage.index >= 4
    ? (lang === "no" ? "Match klokker og lyder." : "Match the clocks and sounds.")
    : t("match_pairs", lang), lang);
}

function playFreeplay(onQuit) {
  const node = makeGameShell(onQuit, "freeplay");
  const body = node.querySelector("#game-body");
  const lang = getLanguage();
  const themes = [
    { key: "weather_day", className: "theme-day" },
    { key: "weather_evening", className: "theme-evening" },
    { key: "weather_night", className: "theme-night" },
  ];

  body.appendChild(buildPromptCard({
    icon: "🕰️",
    title: t("free_play_title", lang),
    caption: t("say_time", lang),
  }));

  const scene = document.createElement("div");
  scene.className = "freeplay-scene theme-day";
  body.appendChild(scene);

  const themeRow = document.createElement("div");
  themeRow.className = "theme-row";
  themes.forEach((theme) => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = t(theme.key, lang);
    btn.addEventListener("click", () => {
      scene.className = `freeplay-scene ${theme.className}`;
      sfxPop();
    });
    themeRow.appendChild(btn);
  });
  body.appendChild(themeRow);

  const clockWrap = document.createElement("div");
  clockWrap.className = "game-clock";
  body.appendChild(clockWrap);
  const readout = document.createElement("div");
  readout.className = "digital-readout game-digital";
  body.appendChild(readout);

  const clock = createClock(clockWrap, {
    hour: new Date().getHours(),
    minute: Math.round(new Date().getMinutes() / 5) * 5,
    snap: "5min",
    showNumbers: true,
    onChange: (h, m) => { readout.textContent = timeLabel(h, m); },
  });
  readout.textContent = timeLabel(clock.getTime()[0], clock.getTime()[1]);

  const sayBtn = document.createElement("button");
  sayBtn.className = "primary-btn";
  sayBtn.textContent = t("say_time", lang);
  sayBtn.addEventListener("click", () => {
    const [h, m] = clock.getTime();
    speakTheTime(h, m, { echoSecondary: false });
    sfxSparkle();
  });

  const controls = document.createElement("div");
  controls.className = "game-controls";
  controls.appendChild(sayBtn);

  const backBtn = document.createElement("button");
  backBtn.className = "ghost-btn";
  backBtn.textContent = t("back_to_town", lang);
  backBtn.addEventListener("click", () => {
    sfxPop();
    stopMusic();
    onQuit();
  });
  controls.appendChild(backBtn);

  body.appendChild(controls);

  node.querySelector("#progress-dots").innerHTML = "";
  node.querySelector("#replay-audio").onclick = () => {
    const [h, m] = clock.getTime();
    speakTheTime(h, m, { echoSecondary: false });
  };
}

function playDailyMission(onQuit) {
  const mission = ensureDailyMission();
  const stage = stageFromProfile();
  const game = mission.game;
  if (stage.index <= 2) return playBakery(onQuit);
  if (game === "garden") return playGarden(onQuit);
  if (game === "station") return playStation(onQuit);
  if (game === "lighthouse") return playLighthouse(onQuit);
  if (game === "market") return playMarket(onQuit);
  return playRoutine(onQuit);
}

const GAMES = {
  bakery: playBakery,
  garden: playGarden,
  station: playStation,
  lighthouse: playLighthouse,
  market: playMarket,
  routine: playRoutine,
  freeplay: playFreeplay,
  daily: playDailyMission,
};

export function startGameByKey(key, onQuit) {
  const fn = GAMES[key] || GAMES[getRecommendedGame(getActiveProfile())] || playFreeplay;
  fn(onQuit);
}
