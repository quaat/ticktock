// ============================================================================
// screens.js — premium non-game screens and parent-facing controls
// ============================================================================

import { AGE_BANDS, GAME_META, OUTFITS, getMood, getRecommendedGame, getStageByStars } from "./content.js";
import { createReplayHandler, describeReplayButton, speak, speakTheTime, startMusic, unlockAudio, sfxChime, sfxPop, sfxUnlock } from "./audio.js";
import { createClock } from "./clock.js";
import { HINT_LINES, PRAISE_LINES, pickLine, t, timeLabel } from "./i18n.js";
import {
  createProfileRecord,
  ensureDailyMission,
  getActiveProfile,
  getLanguage,
  getProgressSummary,
  getReplayLanguage,
  getState,
  resetAll,
  setActiveProfile,
  setState,
  shiftRewardQueue,
  updateActiveProfile,
} from "./state.js";
import { mountTikko } from "./tikko.js";

const app = () => document.getElementById("app");

function clone(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

function mount(node) {
  const root = app();
  root.innerHTML = "";
  root.appendChild(node);
}

function applyI18n(root, lang) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key, lang);
  });
}

function makeChip({ label, active = false, action, danger = false }) {
  const btn = document.createElement("button");
  btn.className = "chip";
  if (active) btn.classList.add("active");
  if (danger) btn.classList.add("danger-chip");
  btn.textContent = label;
  btn.addEventListener("click", action);
  return btn;
}

function renderChoiceRow(container, items) {
  container.innerHTML = "";
  items.forEach((item) => container.appendChild(makeChip(item)));
}

function copyText(text, lang) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert(t("summary_copied", lang));
    }).catch(() => {
      alert(text);
    });
  } else {
    alert(text);
  }
}

export function showSplash(onDone) {
  const lang = getLanguage();
  const node = clone("tpl-splash");
  applyI18n(node, lang);
  mount(node);
  mountTikko(node.querySelector("#splash-tikko"), { cheer: true });
  node.addEventListener("pointerdown", () => {
    unlockAudio();
    sfxPop();
    startMusic("town");
    onDone();
  }, { once: true });
}

export function showLanguagePicker(onPicked) {
  const node = clone("tpl-language");
  const lang = getLanguage();
  applyI18n(node, lang);
  mount(node);
  mountTikko(node.querySelector("#lang-tikko"));
  node.querySelectorAll(".lang-btn").forEach((btn) => {
    const nextLang = btn.dataset.lang;
    const preview = nextLang === "no" ? "Hei! Jeg heter Tikko!" : "Hello! I'm Tikko!";
    btn.addEventListener("pointerenter", () => speak(preview, nextLang), { once: true });
    btn.addEventListener("click", () => {
      sfxPop();
      updateActiveProfile({ primaryLanguage: nextLang });
      speak(preview, nextLang);
      setTimeout(onPicked, 700);
    });
  });
}

export function showOnboarding(onDone) {
  const lang = getLanguage();
  const node = clone("tpl-onboarding");
  applyI18n(node, lang);
  mount(node);
  mountTikko(node.querySelector("#ob-tikko"));

  const copyEl = node.querySelector("#ob-copy");
  const continueBtn = node.querySelector("#ob-continue");
  const sayBtn = node.querySelector("#ob-say");
  const readout = node.querySelector("#ob-readout");
  const replayBtn = node.querySelector("#ob-replay");
  const pill1 = node.querySelector("#step-1-pill");
  const pill2 = node.querySelector("#step-2-pill");
  const pill3 = node.querySelector("#step-3-pill");

  let step = 1;
  let minuteMoves = 0;
  let hourMoves = 0;
  let lastH = 9;
  let lastM = 0;

  const prompts = {
    1: t("ob_drag", lang),
    2: t("ob_small", lang),
    3: t("ob_listen", lang),
  };

  const clock = createClock(node.querySelector("#ob-clock"), {
    hour: 9,
    minute: 0,
    snap: "5min",
    showNumbers: true,
    onChange: (h, m) => {
      readout.textContent = timeLabel(h, m);
      if (step === 1 && m !== lastM) {
        minuteMoves += 1;
        if (minuteMoves >= 2) {
          step = 2;
          copyEl.textContent = prompts[2];
          pill1.classList.add("done");
          pill2.classList.add("active");
          clock.setTime(3, 0);
          lastH = 3;
          lastM = 0;
          readout.textContent = timeLabel(3, 0);
          speak(prompts[2], lang);
          return;
        }
      }
      if (step === 2 && h !== lastH) {
        hourMoves += 1;
        if (hourMoves >= 1) {
          step = 3;
          copyEl.textContent = prompts[3];
          pill2.classList.add("done");
          pill3.classList.add("active");
          sfxChime();
          speak(prompts[3], lang);
        }
      }
      lastH = h;
      lastM = m;
    },
  });

  readout.textContent = timeLabel(9, 0);
  const replay = createReplayHandler({ text: prompts[step], lang });
  setTimeout(() => replay(), 350);
  replayBtn.addEventListener("click", () => replay());
  sayBtn.addEventListener("click", () => {
    const [h, m] = clock.getTime();
    speakTheTime(h, m);
    if (step === 3) {
      pill3.classList.add("done");
      continueBtn.classList.remove("hidden");
      sfxUnlock();
      speak(pickLine(PRAISE_LINES, lang, 2), lang);
    }
  });

  continueBtn.addEventListener("click", () => {
    sfxPop();
    updateActiveProfile({ onboarded: true });
    onDone();
  });
}

export function showQuickSetup(onDone) {
  const lang = getLanguage();
  const profile = getActiveProfile();
  const node = clone("tpl-quicksetup");
  applyI18n(node, lang);
  mount(node);
  mountTikko(node.querySelector("#setup-tikko"), { cheer: true });

  const otherLang = lang === "no" ? "en" : "no";
  renderChoiceRow(node.querySelector("#setup-age-band"), AGE_BANDS.map((band) => ({
    label: t(`age_${band.id.replace("-", "_")}`, lang),
    active: profile.ageBand === band.id,
    action: () => {
      updateActiveProfile({ ageBand: band.id });
      showQuickSetup(onDone);
    },
  })));

  renderChoiceRow(node.querySelector("#setup-replay-mode"), [
    {
      label: t("primary_only", lang),
      active: !profile.secondaryReplayLanguage,
      action: () => {
        updateActiveProfile({ secondaryReplayLanguage: null });
        showQuickSetup(onDone);
      },
    },
    {
      label: t("replay_other", lang),
      active: profile.secondaryReplayLanguage === otherLang,
      action: () => {
        updateActiveProfile({ secondaryReplayLanguage: otherLang });
        showQuickSetup(onDone);
      },
    },
  ]);

  const sessionRoot = node.querySelector("#setup-session");
  [5, 10, 15, 20].forEach((minutes) => {
    sessionRoot.appendChild(makeChip({
      label: `${minutes} min`,
      active: getState().settings.sessionMinutes === minutes,
      action: () => {
        setState({ settings: { sessionMinutes: minutes } });
        showQuickSetup(onDone);
      },
    }));
  });

  node.querySelector("#setup-captions").checked = !!getState().settings.captions;
  node.querySelector("#setup-motion").checked = !!getState().settings.reducedMotion;
  node.querySelector("#setup-contrast").checked = !!getState().settings.highContrast;

  node.querySelector("#setup-save").addEventListener("click", () => {
    setState({
      settings: {
        captions: node.querySelector("#setup-captions").checked,
        reducedMotion: node.querySelector("#setup-motion").checked,
        highContrast: node.querySelector("#setup-contrast").checked,
      },
    });
    updateActiveProfile({ setupComplete: true });
    applyBodyClasses();
    sfxUnlock();
    speak(lang === "no" ? "Flott! Byen er klar." : "Wonderful! The town is ready.", lang);
    setTimeout(onDone, 450);
  });
}

export function showHub(onBuildingTap, onTrophy, onSettings) {
  const lang = getLanguage();
  const profile = getActiveProfile();
  const mission = ensureDailyMission();
  const summary = getProgressSummary();
  const stage = getStageByStars(profile.stars);
  const node = clone("tpl-hub");
  applyI18n(node, lang);
  mount(node);
  mountTikko(node.querySelector("#hub-tikko"), { outfit: profile.outfit });
  startMusic("town");

  node.querySelector("#hub-stage-title").textContent = t(stage.titleKey, lang);
  node.querySelector("#hub-stage-subtitle").textContent = t(stage.subtitleKey, lang);
  node.querySelector("#star-n").textContent = profile.stars;
  node.querySelector("#streak-n").textContent = profile.streak;
  node.querySelector("#reward-state").textContent = profile.rewardQueue.length ? `${profile.rewardQueue.length}` : "0";
  node.querySelector("#reward-btn").title = profile.rewardQueue.length ? t("reward_ready", lang) : t("chest_empty", lang);
  node.querySelector("#mood-label").textContent = t(`mood_${summary.mood}`, lang);
  node.querySelector("#mission-label").textContent = t(GAME_META[mission.game]?.titleKey || "daily_mission", lang);
  node.querySelector("#mission-status").textContent = mission.complete
    ? t("mission_complete", lang)
    : t("daily_ready", lang);
  if (profile.rewardQueue.length) node.querySelector("#reward-btn").classList.add("pulse");

  node.querySelector("#play-next-btn").textContent = `${t("play_next", lang)}: ${t(GAME_META[summary.recommendedGame].titleKey, lang)}`;
  node.querySelector("#play-next-btn").addEventListener("click", () => {
    sfxPop();
    onBuildingTap(summary.recommendedGame);
  });

  node.querySelector("#mission-play").addEventListener("click", () => {
    sfxPop();
    onBuildingTap("daily");
  });

  node.querySelector("#reward-btn").addEventListener("click", () => {
    sfxPop();
    onTrophy();
  });
  node.querySelector("#settings-btn").addEventListener("click", () => {
    sfxPop();
    onSettings();
  });
  node.querySelector("#star-count").addEventListener("click", () => onTrophy());
  node.querySelector("#mood-chip").addEventListener("click", () => {
    speak(pickLine(HINT_LINES, lang, profile.stars), lang);
  });

  node.querySelectorAll(".building").forEach((btn) => {
    const game = btn.dataset.game;
    const progress = profile.progress[game];
    const unlocked = GAME_META[game].unlockStage <= stage.index;
    const starsEl = btn.querySelector(".b-stars");
    starsEl.textContent = "⭐".repeat(progress?.stars || 0);
    if (!unlocked) btn.classList.add("locked");
    if (profile.decorations.includes(game)) btn.classList.add("decorated");
    btn.addEventListener("click", () => {
      if (!unlocked) {
        sfxPop();
        speak(lang === "no" ? "Denne åpner snart!" : "This one opens soon!", lang);
        return;
      }
      sfxPop();
      onBuildingTap(game);
    });
  });
}

export function showTrophyRoom(onBack) {
  const lang = getLanguage();
  const profile = getActiveProfile();
  const node = clone("tpl-trophy");
  applyI18n(node, lang);
  mount(node);

  const stickers = node.querySelector("#stickers");
  profile.stickers.slice(0, 24).forEach((sticker) => {
    const item = document.createElement("div");
    item.className = "sticker-item";
    item.innerHTML = `<span>${sticker.icon}</span><small>${sticker.label}</small>`;
    stickers.appendChild(item);
  });

  const medals = node.querySelector("#medals");
  if (profile.medals.length) {
    profile.medals.forEach((medal) => {
      const item = document.createElement("div");
      item.className = "trophy-item";
      item.innerHTML = `${medal.icon}<small>${t(GAME_META[medal.game]?.medalKey || "mastery_badge", lang)}</small>`;
      medals.appendChild(item);
    });
  } else {
    const empty = document.createElement("div");
    empty.className = "trophy-item empty";
    empty.textContent = "🏅";
    medals.appendChild(empty);
  }

  const shelves = node.querySelector("#shelves");
  profile.trophies.slice(0, 12).forEach((item) => {
    const div = document.createElement("div");
    div.className = "trophy-item";
    div.textContent = item.icon;
    shelves.appendChild(div);
  });

  const outfitsEl = node.querySelector("#outfits");
  OUTFITS.forEach((outfit) => {
    const btn = document.createElement("button");
    btn.className = "outfit";
    const owned = profile.unlockedOutfits.includes(outfit.id);
    if (!owned) btn.classList.add("locked");
    if (profile.outfit === outfit.id) btn.classList.add("active");
    btn.innerHTML = `<span>${owned ? outfit.icon : "🔒"}</span><small>${outfit.label}</small>`;
    btn.addEventListener("click", () => {
      if (!owned) {
        sfxPop();
        return;
      }
      updateActiveProfile({ outfit: outfit.id });
      sfxPop();
      showTrophyRoom(onBack);
    });
    outfitsEl.appendChild(btn);
  });

  const reward = shiftRewardQueue();
  if (reward) {
    const banner = document.createElement("div");
    banner.className = "reward-banner panel";
    banner.innerHTML = `<div class="reward-icon">${reward.icon}</div><div><strong>${t("new_item", lang)}: ${reward.label}</strong><p>${reward.description}</p></div>`;
    node.insertBefore(banner, node.querySelector(".reward-panel"));
    sfxUnlock();
  }

  node.querySelector("#back-btn").addEventListener("click", onBack);
}

export function showSettings(onBack) {
  const lang = getLanguage();
  const state = getState();
  const profile = getActiveProfile();
  const summary = getProgressSummary();
  const node = clone("tpl-settings");
  applyI18n(node, lang);
  mount(node);

  const switcher = node.querySelector("#profile-switcher");
  Object.values(state.profiles).forEach((entry) => {
    switcher.appendChild(makeChip({
      label: entry.name,
      active: entry.id === state.activeProfileId,
      action: () => {
        setActiveProfile(entry.id);
        showSettings(onBack);
      },
    }));
  });
  node.querySelector("#add-profile-btn").addEventListener("click", () => {
    const name = prompt(lang === "no" ? "Navn på barn" : "Child name");
    if (!name) return;
    createProfileRecord({ name, ageBand: profile.ageBand, primaryLanguage: lang });
    showSettings(onBack);
  });

  renderChoiceRow(node.querySelector("#settings-age-band"), AGE_BANDS.map((band) => ({
    label: t(`age_${band.id.replace("-", "_")}`, lang),
    active: profile.ageBand === band.id,
    action: () => {
      updateActiveProfile({ ageBand: band.id });
      showSettings(onBack);
    },
  })));

  renderChoiceRow(node.querySelector("#settings-primary-language"), [
    {
      label: "🇬🇧 English",
      active: profile.primaryLanguage === "en",
      action: () => {
        updateActiveProfile({
          primaryLanguage: "en",
          secondaryReplayLanguage: profile.secondaryReplayLanguage === "en" ? null : profile.secondaryReplayLanguage,
        });
        showSettings(onBack);
      },
    },
    {
      label: "🇳🇴 Norsk",
      active: profile.primaryLanguage === "no",
      action: () => {
        updateActiveProfile({
          primaryLanguage: "no",
          secondaryReplayLanguage: profile.secondaryReplayLanguage === "no" ? null : profile.secondaryReplayLanguage,
        });
        showSettings(onBack);
      },
    },
  ]);

  renderChoiceRow(node.querySelector("#settings-secondary-language"), [
    {
      label: t("none", lang),
      active: !profile.secondaryReplayLanguage,
      action: () => {
        updateActiveProfile({ secondaryReplayLanguage: null });
        showSettings(onBack);
      },
    },
    {
      label: profile.primaryLanguage === "no" ? "🇬🇧 English" : "🇳🇴 Norsk",
      active: !!profile.secondaryReplayLanguage,
      action: () => {
        updateActiveProfile({ secondaryReplayLanguage: profile.primaryLanguage === "no" ? "en" : "no" });
        showSettings(onBack);
      },
    },
  ]);

  node.querySelector("#vol-music").value = state.settings.music;
  node.querySelector("#vol-sfx").value = state.settings.sfx;
  node.querySelector("#vol-voice").value = state.settings.voice;
  node.querySelector("#vol-music").addEventListener("input", (event) => setState({ settings: { music: +event.target.value } }));
  node.querySelector("#vol-sfx").addEventListener("input", (event) => setState({ settings: { sfx: +event.target.value } }));
  node.querySelector("#vol-voice").addEventListener("input", (event) => setState({ settings: { voice: +event.target.value } }));

  node.querySelector("#opt-captions").checked = !!state.settings.captions;
  node.querySelector("#opt-motion").checked = !!state.settings.reducedMotion;
  node.querySelector("#opt-dyslexia").checked = !!state.settings.dyslexiaFont;
  node.querySelector("#opt-contrast").checked = !!state.settings.highContrast;
  node.querySelector("#opt-captions").addEventListener("change", (event) => setState({ settings: { captions: event.target.checked } }));
  node.querySelector("#opt-motion").addEventListener("change", (event) => {
    setState({ settings: { reducedMotion: event.target.checked } });
    applyBodyClasses();
  });
  node.querySelector("#opt-dyslexia").addEventListener("change", (event) => {
    setState({ settings: { dyslexiaFont: event.target.checked } });
    applyBodyClasses();
  });
  node.querySelector("#opt-contrast").addEventListener("change", (event) => {
    setState({ settings: { highContrast: event.target.checked } });
    applyBodyClasses();
  });

  const sessionRoot = node.querySelector("#settings-session");
  [0, 5, 10, 15, 20].forEach((minutes) => {
    sessionRoot.appendChild(makeChip({
      label: minutes ? `${minutes} min` : t("unlimited", lang),
      active: state.settings.sessionMinutes === minutes,
      action: () => {
        setState({ settings: { sessionMinutes: minutes } });
        showSettings(onBack);
      },
    }));
  });

  node.querySelector("#summary-rounds").textContent = summary.telemetry.roundsPlayed;
  node.querySelector("#summary-first").textContent = summary.telemetry.firstTryWins;
  node.querySelector("#summary-hints").textContent = summary.telemetry.hintsUsed;

  node.querySelector("#copy-summary").addEventListener("click", () => {
    const text = [
      `${profile.name} — ${t(summary.stage.titleKey, lang)}`,
      `${t("rounds_played", lang)}: ${summary.telemetry.roundsPlayed}`,
      `${t("first_try_wins", lang)}: ${summary.telemetry.firstTryWins}`,
      `${t("hints_used", lang)}: ${summary.telemetry.hintsUsed}`,
      `${t("helper_mood", lang)}: ${t(`mood_${getMood(profile)}`, lang)}`,
      `Replay: ${describeReplayButton()}`,
    ].join("\n");
    copyText(text, lang);
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
  const settings = getState().settings;
  document.body.classList.toggle("opt-motion", !!settings.reducedMotion);
  document.body.classList.toggle("opt-dyslexia", !!settings.dyslexiaFont);
  document.body.classList.toggle("opt-contrast", !!settings.highContrast);
}
