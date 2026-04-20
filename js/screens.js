// ============================================================================
// screens.js — render functions for non-game screens.
// ============================================================================

import { t, speakTime } from "./i18n.js";
import { getState, setState, resetAll, OUTFITS, onChange } from "./state.js";
import { mountTikko } from "./tikko.js";
import { createClock } from "./clock.js";
import { sfxPop, sfxChime, sfxUnlock, speak, speakTheTime, startMusic, stopMusic, unlockAudio } from "./audio.js";

const app = () => document.getElementById("app");

function clone(id) {
  const tpl = document.getElementById(id);
  return tpl.content.firstElementChild.cloneNode(true);
}

function applyI18n(root, lang) {
  root.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const v = t(key, lang);
    if (v) el.textContent = v;
  });
}

function mount(node) {
  const a = app();
  a.innerHTML = "";
  a.appendChild(node);
}

// ----------------------------------------------------------------------------
// Splash
// ----------------------------------------------------------------------------
export function showSplash(onDone) {
  const s = getState();
  const lang = s.language || "en";
  const node = clone("tpl-splash");
  applyI18n(node, lang);
  mount(node);
  mountTikko(node.querySelector("#splash-tikko"));
  const proceed = () => {
    unlockAudio();
    sfxPop();
    startMusic();
    onDone();
  };
  node.addEventListener("pointerdown", proceed, { once: true });
}

// ----------------------------------------------------------------------------
// Language picker
// ----------------------------------------------------------------------------
export function showLanguagePicker(onPicked) {
  const node = clone("tpl-language");
  const s = getState();
  applyI18n(node, s.language || "en");
  mount(node);
  mountTikko(node.querySelector("#lang-tikko"));
  node.querySelectorAll(".lang-btn").forEach(btn => {
    const lang = btn.dataset.lang;
    // Preview voice on first render
    btn.addEventListener("pointerenter", () => {
      speak(lang === "no" ? "Hei! Jeg heter Tikko!" : "Hello! I'm Tikko!", lang);
    }, { once: true });
    btn.addEventListener("click", () => {
      sfxPop();
      setState({ language: lang });
      speak(lang === "no" ? "Hei! Jeg heter Tikko!" : "Hello! I'm Tikko!", lang);
      applyI18n(node, lang);
      setTimeout(onPicked, 900);
    });
  });
}

// ----------------------------------------------------------------------------
// Onboarding — "drag the big hand"
// ----------------------------------------------------------------------------
export function showOnboarding(onDone) {
  const node = clone("tpl-onboarding");
  const lang = getState().language || "en";
  applyI18n(node, lang);
  mount(node);
  mountTikko(node.querySelector("#ob-tikko"));

  // Speak the prompt
  const phrase = lang === "no"
    ? "Kan du flytte den store viseren? Prøv!"
    : "Can you move the big hand? Try it!";
  setTimeout(() => speak(phrase, lang), 400);

  node.querySelector(".replay-btn").addEventListener("click", () => speak(phrase, lang));

  const clockSlot = node.querySelector("#ob-clock");
  let moved = 0;
  const clock = createClock(clockSlot, {
    hour: 9, minute: 0,
    snap: "5min",
    showNumbers: true,
    onChange: () => {
      moved++;
      if (moved >= 3 && btn.classList.contains("hidden")) {
        btn.classList.remove("hidden");
        sfxChime();
        const praise = lang === "no" ? "Flott! Du er et naturtalent!" : "Great! You're a natural!";
        speak(praise, lang);
      }
    }
  });

  const btn = node.querySelector("#ob-continue");
  btn.addEventListener("click", () => {
    sfxPop();
    setState({ onboarded: true });
    onDone();
  });
}

// ----------------------------------------------------------------------------
// Hub
// ----------------------------------------------------------------------------
export function showHub(onBuildingTap, onTrophy, onSettings) {
  const node = clone("tpl-hub");
  const s = getState();
  const lang = s.language || "en";
  applyI18n(node, lang);
  mount(node);
  mountTikko(node.querySelector("#hub-tikko"));

  // star count
  node.querySelector("#star-n").textContent = s.stars;

  // stars per building
  node.querySelectorAll(".building").forEach(btn => {
    const key = btn.dataset.game;
    const p = s.progress[key];
    const unlocked = s.unlocked[key] !== false;
    if (!unlocked) btn.classList.add("locked");
    const starsEl = btn.querySelector(".b-stars");
    if (starsEl && p) starsEl.textContent = "⭐".repeat(p.stars || 0) || "";
    btn.addEventListener("click", () => {
      if (!unlocked) {
        sfxPop();
        speak(lang === "no" ? "Tjen flere stjerner for å åpne denne!" : "Earn more stars to open this!", lang);
        return;
      }
      sfxPop();
      onBuildingTap(key);
    });
  });

  node.querySelector("#trophy-btn").addEventListener("click", () => { sfxPop(); onTrophy(); });
  node.querySelector("#settings-btn").addEventListener("click", () => { sfxPop(); onSettings(); });
}

// ----------------------------------------------------------------------------
// Trophy Room
// ----------------------------------------------------------------------------
export function showTrophyRoom(onBack) {
  const node = clone("tpl-trophy");
  const s = getState();
  applyI18n(node, s.language || "en");
  mount(node);
  const shelves = node.querySelector("#shelves");
  const items = s.trophies.slice(-24).reverse();
  const itemIcons = {
    bakery: "🥐", garden: "🌻", station: "🎫", lighthouse: "🗼",
    market: "🏅", routine: "⭐", freeplay: "🌟",
  };
  if (!items.length) {
    for (let i = 0; i < 8; i++) {
      const div = document.createElement("div");
      div.className = "trophy-item empty";
      div.textContent = "?";
      shelves.appendChild(div);
    }
  } else {
    for (const it of items) {
      const div = document.createElement("div");
      div.className = "trophy-item";
      div.textContent = it.icon || itemIcons[it.game] || "🏅";
      shelves.appendChild(div);
    }
  }
  const outfitsEl = node.querySelector("#outfits");
  for (const o of OUTFITS) {
    const btn = document.createElement("button");
    btn.className = "outfit";
    const owned = s.unlockedOutfits.includes(o.id);
    if (!owned) btn.classList.add("locked");
    if (s.outfit === o.id) btn.classList.add("active");
    btn.textContent = owned ? o.icon : "🔒";
    btn.title = o.label + (owned ? "" : ` (${o.stars}⭐)`);
    btn.addEventListener("click", () => {
      if (!owned) { sfxPop(); return; }
      setState({ outfit: o.id });
      sfxPop();
      showTrophyRoom(onBack);
    });
    outfitsEl.appendChild(btn);
  }
  node.querySelector("#back-btn").addEventListener("click", onBack);
}

// ----------------------------------------------------------------------------
// Settings (behind parent gate)
// ----------------------------------------------------------------------------
export function showSettings(onBack) {
  const node = clone("tpl-settings");
  const s = getState();
  const lang = s.language || "en";
  applyI18n(node, lang);
  mount(node);

  // Language chips
  node.querySelectorAll("[data-set-lang]").forEach(btn => {
    const v = btn.dataset.setLang;
    const active = (v === "both" && s.bothLangs) ||
                   (v !== "both" && s.language === v && !s.bothLangs);
    if (active) btn.classList.add("active");
    btn.addEventListener("click", () => {
      sfxPop();
      if (v === "both") setState({ bothLangs: true });
      else setState({ language: v, bothLangs: false });
      showSettings(onBack);
    });
  });

  // Volumes
  const volMusic = node.querySelector("#vol-music");
  const volSfx   = node.querySelector("#vol-sfx");
  const volVoice = node.querySelector("#vol-voice");
  volMusic.value = s.settings.music;
  volSfx.value   = s.settings.sfx;
  volVoice.value = s.settings.voice;
  volMusic.addEventListener("input", () => { setState({ settings: { music: +volMusic.value } }); startMusic(); });
  volSfx.addEventListener("input",   () => setState({ settings: { sfx: +volSfx.value } }));
  volVoice.addEventListener("input", () => setState({ settings: { voice: +volVoice.value } }));

  // Accessibility
  const motion = node.querySelector("#opt-motion");
  const dys    = node.querySelector("#opt-dyslexia");
  const contr  = node.querySelector("#opt-contrast");
  motion.checked = s.settings.reducedMotion;
  dys.checked    = s.settings.dyslexiaFont;
  contr.checked  = s.settings.highContrast;
  motion.addEventListener("change", () => { setState({ settings: { reducedMotion: motion.checked } }); applyBodyClasses(); });
  dys.addEventListener("change",    () => { setState({ settings: { dyslexiaFont: dys.checked } }); applyBodyClasses(); });
  contr.addEventListener("change",  () => { setState({ settings: { highContrast: contr.checked } }); applyBodyClasses(); });

  // Session length chips
  node.querySelectorAll("[data-session]").forEach(btn => {
    const v = +btn.dataset.session;
    if (s.settings.sessionMinutes === v) btn.classList.add("active");
    btn.addEventListener("click", () => {
      sfxPop();
      setState({ settings: { sessionMinutes: v } });
      showSettings(onBack);
    });
  });

  node.querySelector("#reset-progress").addEventListener("click", () => {
    if (confirm(lang === "no" ? "Nullstille all fremgang?" : "Reset all progress?")) {
      resetAll();
      location.reload();
    }
  });

  node.querySelector("#back-btn").addEventListener("click", onBack);
}

export function applyBodyClasses() {
  const s = getState();
  document.body.classList.toggle("opt-motion",   !!s.settings.reducedMotion);
  document.body.classList.toggle("opt-dyslexia", !!s.settings.dyslexiaFont);
  document.body.classList.toggle("opt-contrast", !!s.settings.highContrast);
}

// ----------------------------------------------------------------------------
// Parent Gate — drag three sliders to match targets
// ----------------------------------------------------------------------------
export function showParentGate(onPass, onCancel) {
  const node = clone("tpl-parent-gate");
  const lang = getState().language || "en";
  applyI18n(node, lang);
  mount(node);

  const slotsEl = node.querySelector("#gate-slots");
  const values = [0, 0, 0];
  const targets = [];
  for (let i = 0; i < 3; i++) {
    const target = 20 + Math.floor(Math.random() * 60);
    targets.push(target);
    const slot = document.createElement("div");
    slot.className = "gate-slot";
    slot.innerHTML = `
      <div class="gate-label">
        <span>Slider ${i + 1}</span>
        <span>Target: <span class="target">${target}</span></span>
      </div>
      <input type="range" min="0" max="100" value="0" />`;
    const input = slot.querySelector("input");
    input.addEventListener("input", () => { values[i] = +input.value; });
    slotsEl.appendChild(slot);
  }

  node.querySelector("#gate-submit").addEventListener("click", () => {
    if (values.every((v, i) => Math.abs(v - targets[i]) <= 2)) {
      sfxChime();
      onPass();
    } else {
      sfxPop();
      alert(lang === "no" ? "Prøv igjen" : "Try again");
    }
  });
  node.querySelector("#gate-cancel").addEventListener("click", onCancel);
}
