// ============================================================================
// games.js — All mini-games share a simple frame:
//   header (pause, progress dots, replay audio)
//   body  (rendered by each game)
//   overlay (feedback: correct / almost / round summary)
//
// A round typically has 4 puzzles. After a round, stars are tallied and
// awarded, and a celebratory summary is shown.
// ============================================================================

import { t, speakTime, timeLabel } from "./i18n.js";
import { getState, setState, recordResult, addTrophy } from "./state.js";
import { createClock, renderStaticClock } from "./clock.js";
import { mountTikko } from "./tikko.js";
import {
  sfxPop, sfxChime, sfxSoftMiss, sfxSparkle, sfxUnlock, speak, speakTheTime
} from "./audio.js";

const app = () => document.getElementById("app");

function clone(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true);
}
function applyI18n(root, lang) {
  root.querySelectorAll("[data-i18n]").forEach(el => {
    const v = t(el.getAttribute("data-i18n"), lang);
    if (v) el.textContent = v;
  });
}

// ---------------------------------------------------------------------------
// Confetti
// ---------------------------------------------------------------------------
function confetti(container, n = 40) {
  const c = document.createElement("div"); c.className = "confetti";
  const colors = ["#FFD86B","#FF9CAA","#8CE0C4","#A8D0FF","#FFB86B","#D9C6FF"];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.style.left = Math.random() * 100 + "%";
    s.style.background = colors[i % colors.length];
    s.style.animationDuration = (1.4 + Math.random() * 1.2) + "s";
    s.style.animationDelay = Math.random() * 0.3 + "s";
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    c.appendChild(s);
  }
  container.appendChild(c);
  setTimeout(() => c.remove(), 3500);
}

// ---------------------------------------------------------------------------
// Game framing helpers
// ---------------------------------------------------------------------------
function makeGameShell(onQuit) {
  const node = clone("tpl-game");
  const lang = getState().language || "en";
  applyI18n(node, lang);
  app().innerHTML = "";
  app().appendChild(node);
  node.querySelector("#pause-btn").addEventListener("click", () => {
    if (confirm(lang === "no" ? "Avslutte?" : "Leave game?")) onQuit();
  });
  return node;
}

function setProgressDots(node, total, doneCount, currentIdx) {
  const el = node.querySelector("#progress-dots");
  el.innerHTML = "";
  for (let i = 0; i < total; i++) {
    const d = document.createElement("div");
    d.className = "dot";
    if (i < doneCount) d.classList.add("done");
    if (i === currentIdx) d.classList.add("current");
    el.appendChild(d);
  }
}

// Generic success/fail overlay
function feedback(node, kind, opts = {}) {
  const overlay = node.querySelector("#overlay");
  overlay.classList.remove("hidden");
  overlay.innerHTML = "";
  const card = document.createElement("div");
  card.className = "overlay-card";
  const lang = getState().language || "en";
  if (kind === "correct") {
    card.innerHTML = `
      <div class="emoji">${opts.emoji || "🎉"}</div>
      <h2>${t("correct", lang)}</h2>
      <div class="msg">${opts.msg || ""}</div>`;
    confetti(node);
    sfxChime();
  } else {
    card.innerHTML = `
      <div class="emoji">${opts.emoji || "🦉"}</div>
      <h2>${t("almost", lang)}</h2>
      <div class="msg">${opts.msg || t("try_again", lang)}</div>`;
    sfxSoftMiss();
  }
  overlay.appendChild(card);
  setTimeout(() => { overlay.classList.add("hidden"); overlay.innerHTML = ""; }, opts.delay || 1400);
}

function roundSummary(node, starsEarned, game, onDone) {
  const overlay = node.querySelector("#overlay");
  overlay.classList.remove("hidden");
  overlay.innerHTML = "";
  const card = document.createElement("div");
  card.className = "overlay-card";
  const lang = getState().language || "en";
  const stars = "⭐".repeat(starsEarned) + "☆".repeat(3 - starsEarned);
  card.innerHTML = `
    <div class="emoji">🏆</div>
    <h2>${t("correct", lang)}</h2>
    <div class="stars">${stars}</div>
    <div class="msg">+${starsEarned} ⭐</div>
    <div class="row">
      <button class="primary-btn" id="again">${t("play_again", lang)}</button>
      <button class="link-btn" id="back">${t("back_to_town", lang)}</button>
    </div>`;
  overlay.appendChild(card);
  confetti(node, 80);
  sfxUnlock();
  overlay.querySelector("#again").addEventListener("click", () => { sfxPop(); onDone("again"); });
  overlay.querySelector("#back").addEventListener("click",  () => { sfxPop(); onDone("back"); });
  recordResult(game, starsEarned);
  // add a trophy item
  const itemMap = { bakery: "🥐", garden: "🌻", station: "🎫", lighthouse: "💡", market: "🏅", routine: "⭐" };
  addTrophy(game, { icon: itemMap[game] || "🏅" });
}

// ---------------------------------------------------------------------------
// Generic "set-the-clock" game factory
// Used by Bakery, Garden, Station, Lighthouse, Routine (with tweaks)
// ---------------------------------------------------------------------------
function setClockGame({ game, snap, count, generatePuzzle, promptKey, avatarForIndex, sceneForIndex, speechBuilder, onQuit }) {
  const node = makeGameShell(onQuit);
  const body = node.querySelector("#game-body");
  const lang = getState().language || "en";
  const puzzles = [];
  for (let i = 0; i < count; i++) puzzles.push(generatePuzzle(i));
  let idx = 0, correctCount = 0;

  function renderPuzzle() {
    const p = puzzles[idx];
    setProgressDots(node, count, correctCount, idx);
    body.innerHTML = "";

    // Header card
    const card = document.createElement("div");
    card.className = "customer-card";
    const avatar = avatarForIndex ? avatarForIndex(idx, p) : "🧑";
    const prompt = t(promptKey, lang);
    card.innerHTML = `
      <div class="customer-avatar">${avatar}</div>
      <div class="customer-text">
        <div>${prompt}</div>
        <div class="time-highlight">${timeLabel(p.h, p.m, lang)}</div>
      </div>`;
    body.appendChild(card);

    // Scene (optional, for routine)
    if (sceneForIndex) {
      const scene = sceneForIndex(idx, p, lang);
      if (scene) body.appendChild(scene);
    }

    // Clock
    const clockWrap = document.createElement("div");
    clockWrap.className = "game-clock";
    body.appendChild(clockWrap);
    const clock = createClock(clockWrap, {
      hour: 12, minute: 0,
      snap,
      showNumbers: true,
      showHalfOverlay: game === "garden",
      showQuarterOverlay: game === "station",
      highlightHour: game === "garden" && p.m === 30 ? 6 : null,
      onChange: (h, m) => {
        readout.textContent = timeLabel(h, m, lang);
      }
    });
    // digital readout
    const readout = document.createElement("div");
    readout.className = "digital-readout game-digital";
    readout.textContent = timeLabel(12, 0, lang);
    body.appendChild(readout);

    // "Check" button
    const check = document.createElement("button");
    check.className = "primary-btn";
    check.textContent = lang === "no" ? "Sjekk" : "Check";
    body.appendChild(check);

    // Speak the target time
    const phrase = speechBuilder
      ? speechBuilder(idx, p, lang)
      : `${t(promptKey, lang)} ${speakTime(p.h, p.m, lang)}`;
    setTimeout(() => speak(phrase, lang), 400);
    node.querySelector("#replay-audio").onclick = () => speak(phrase, lang);

    check.addEventListener("click", () => {
      const [h, m] = clock.getTime();
      const ok = h === (p.h % 12) && m === p.m;
      if (ok) {
        clock.flashCorrect();
        correctCount++;
        feedback(node, "correct", { emoji: avatar });
        setTimeout(() => {
          idx++;
          if (idx >= count) {
            const stars = correctCount === count ? 3 : (correctCount >= count - 1 ? 2 : 1);
            roundSummary(node, stars, game, (action) => {
              if (action === "again") startGameByKey(game, onQuit);
              else onQuit();
            });
          } else {
            renderPuzzle();
          }
        }, 1500);
      } else {
        clock.flashWrong();
        // Gentle coaching: after 2 misses, show target
        const miss = (p._misses || 0) + 1;
        p._misses = miss;
        feedback(node, "miss", {
          emoji: "🦉",
          msg: miss >= 2
            ? (lang === "no" ? "Se her — prøv denne tiden" : "Here — try this one")
            : t("try_again", lang)
        });
        if (miss >= 2) {
          setTimeout(() => {
            clock.setTime(p.h, p.m);
            readout.textContent = timeLabel(p.h, p.m, lang);
          }, 900);
        }
      }
    });
  }

  renderPuzzle();
}

// ---------------------------------------------------------------------------
// Bakery (o'clock) — level 1
// ---------------------------------------------------------------------------
function playBakery(onQuit) {
  const customers = ["👧","🧒","👦","🧔","👵","👴","🧑‍🎤","🧑‍🎨"];
  setClockGame({
    game: "bakery",
    snap: "hour",
    count: 4,
    promptKey: "customer_wants",
    avatarForIndex: i => customers[i % customers.length],
    generatePuzzle: () => ({ h: 1 + Math.floor(Math.random() * 11), m: 0 }),
    onQuit,
  });
}

// ---------------------------------------------------------------------------
// Garden (half past) — level 2
// ---------------------------------------------------------------------------
function playGarden(onQuit) {
  const flowers = ["🌻","🌷","🌹","🌺","🌼","💐"];
  setClockGame({
    game: "garden",
    snap: "half",
    count: 4,
    promptKey: "water_at",
    avatarForIndex: i => flowers[i % flowers.length],
    generatePuzzle: () => {
      const m = Math.random() < 0.5 ? 0 : 30;
      return { h: 1 + Math.floor(Math.random() * 11), m };
    },
    onQuit,
  });
}

// ---------------------------------------------------------------------------
// Station (quarter past/to) — level 3
// ---------------------------------------------------------------------------
function playStation(onQuit) {
  setClockGame({
    game: "station",
    snap: "quarter",
    count: 4,
    promptKey: "train_at",
    avatarForIndex: () => "🚂",
    generatePuzzle: () => {
      const mins = [0, 15, 30, 45];
      return { h: 1 + Math.floor(Math.random() * 11), m: mins[Math.floor(Math.random() * 4)] };
    },
    onQuit,
  });
}

// ---------------------------------------------------------------------------
// Lighthouse (5-min intervals) — level 4
// ---------------------------------------------------------------------------
function playLighthouse(onQuit) {
  setClockGame({
    game: "lighthouse",
    snap: "5min",
    count: 4,
    promptKey: "beacon_at",
    avatarForIndex: () => "🗼",
    generatePuzzle: () => ({
      h: 1 + Math.floor(Math.random() * 11),
      m: Math.floor(Math.random() * 12) * 5,
    }),
    onQuit,
  });
}

// ---------------------------------------------------------------------------
// Routine (story mode) — real-life context
// ---------------------------------------------------------------------------
function playRoutine(onQuit) {
  const scenes = [
    { key: "r_wakeup",    emoji: "🛏️", h: 7,  m: 0  },
    { key: "r_breakfast", emoji: "🥣", h: 7,  m: 30 },
    { key: "r_school",    emoji: "🎒", h: 8,  m: 15 },
    { key: "r_lunch",     emoji: "🍱", h: 12, m: 0  },
    { key: "r_play",      emoji: "⚽", h: 3,  m: 30 },
    { key: "r_dinner",    emoji: "🍝", h: 6,  m: 0  },
    { key: "r_bath",      emoji: "🛁", h: 7,  m: 30 },
    { key: "r_bed",       emoji: "🌙", h: 8,  m: 0  },
  ];
  // pick 4 at random
  const picks = scenes.sort(() => Math.random() - 0.5).slice(0, 4);
  setClockGame({
    game: "routine",
    snap: "half",
    count: 4,
    promptKey: "your_day",
    avatarForIndex: (i) => picks[i].emoji,
    generatePuzzle: (i) => ({ h: picks[i].h, m: picks[i].m }),
    sceneForIndex: (i, p, lang) => {
      const pg = document.createElement("div");
      pg.className = "routine-page";
      pg.innerHTML = `
        <div class="routine-scene">${picks[i].emoji}</div>
        <div class="routine-caption">${t(picks[i].key, lang)}</div>`;
      return pg;
    },
    speechBuilder: (i, p, lang) => {
      const time = speakTime(p.h, p.m, lang);
      // Avoid doubled "klokka" in Norwegian (speakTime prefixes it on whole hours)
      const connector = lang === "no" ? (time.startsWith("klokka") ? "" : "klokka ") : "at ";
      return `${t(picks[i].key, lang)} ${connector}${time}`;
    },
    onQuit,
  });
}

// ---------------------------------------------------------------------------
// Market — memory/matching of analog and digital clocks
// ---------------------------------------------------------------------------
function playMarket(onQuit) {
  const node = makeGameShell(onQuit);
  const body = node.querySelector("#game-body");
  const lang = getState().language || "en";

  const pairs = 4;
  const times = [];
  while (times.length < pairs) {
    const h = 1 + Math.floor(Math.random() * 11);
    const m = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
    if (!times.some(t => t.h === h && t.m === m)) times.push({ h, m });
  }
  // cards: each time appears twice — once analog (A), once digital (D)
  const cards = [];
  times.forEach((tm, i) => {
    cards.push({ id: i, kind: "A", h: tm.h, m: tm.m });
    cards.push({ id: i, kind: "D", h: tm.h, m: tm.m });
  });
  cards.sort(() => Math.random() - 0.5);

  const header = document.createElement("div");
  header.className = "customer-card";
  header.innerHTML = `<div class="customer-avatar">🛒</div>
    <div class="customer-text"><div>${t("match_pairs", lang)}</div></div>`;
  body.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "market-grid";
  body.appendChild(grid);

  let selected = null;
  let matches = 0;
  let misses = 0;

  cards.forEach((c, i) => {
    const div = document.createElement("button");
    div.className = "market-card";
    if (c.kind === "A") {
      div.classList.add("mini-clock");
      const miniWrap = document.createElement("div");
      miniWrap.style.width = "100%"; miniWrap.style.height = "100%";
      createClock(miniWrap, { hour: c.h, minute: c.m, draggable: false, showNumbers: false });
      div.appendChild(miniWrap);
    } else {
      div.textContent = timeLabel(c.h, c.m, lang);
    }
    div.dataset.index = i;
    div.addEventListener("click", () => {
      if (div.classList.contains("matched") || div === selected) return;
      sfxPop();
      if (!selected) {
        div.classList.add("selected");
        selected = { el: div, card: c };
        speakTheTime(c.h, c.m);
      } else {
        if (selected.card.id === c.id && selected.card.kind !== c.kind) {
          selected.el.classList.remove("selected");
          selected.el.classList.add("matched");
          div.classList.add("matched");
          selected = null;
          matches++;
          sfxChime();
          speakTheTime(c.h, c.m);
          if (matches === pairs) {
            setTimeout(() => {
              const stars = misses === 0 ? 3 : misses <= 2 ? 2 : 1;
              roundSummary(node, stars, "market", (action) => {
                if (action === "again") playMarket(onQuit); else onQuit();
              });
            }, 700);
          }
        } else {
          // miss
          selected.el.classList.add("wrong");
          div.classList.add("wrong");
          misses++;
          sfxSoftMiss();
          const prevEl = selected.el, newEl = div;
          setTimeout(() => {
            prevEl.classList.remove("selected", "wrong");
            newEl.classList.remove("wrong");
            selected = null;
          }, 600);
        }
      }
    });
    grid.appendChild(div);
  });
}

// ---------------------------------------------------------------------------
// Free-play sandbox (Clock Tower)
// ---------------------------------------------------------------------------
function playFreeplay(onQuit) {
  const node = makeGameShell(onQuit);
  const body = node.querySelector("#game-body");
  const lang = getState().language || "en";
  node.querySelector("#progress-dots").innerHTML = "";

  const intro = document.createElement("div");
  intro.className = "customer-card";
  intro.innerHTML = `<div class="customer-avatar">🕰️</div>
    <div class="customer-text">${lang === "no" ? "Lek og lytt" : "Play and listen"}</div>`;
  body.appendChild(intro);

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
    onChange: (h, m) => {
      readout.textContent = timeLabel(h, m, lang);
    },
  });
  const [h0, m0] = clock.getTime();
  readout.textContent = timeLabel(h0, m0, lang);

  const speakBtn = document.createElement("button");
  speakBtn.className = "primary-btn";
  speakBtn.textContent = lang === "no" ? "Si tiden" : "Say the time";
  speakBtn.addEventListener("click", () => {
    const [h, m] = clock.getTime();
    speakTheTime(h, m);
    sfxSparkle();
  });
  body.appendChild(speakBtn);

  node.querySelector("#replay-audio").onclick = () => {
    const [h, m] = clock.getTime();
    speakTheTime(h, m);
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
const GAMES = {
  bakery:     playBakery,
  garden:     playGarden,
  station:    playStation,
  lighthouse: playLighthouse,
  market:     playMarket,
  routine:    playRoutine,
  freeplay:   playFreeplay,
};

export function startGameByKey(key, onQuit) {
  const fn = GAMES[key] || playFreeplay;
  fn(onQuit);
}
