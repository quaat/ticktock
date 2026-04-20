// ============================================================================
// main.js — entry, router, session timer
// ============================================================================

import { getState, setState } from "./state.js";
import {
  showSplash, showLanguagePicker, showOnboarding, showHub,
  showTrophyRoom, showSettings, showParentGate, applyBodyClasses,
} from "./screens.js";
import { startGameByKey } from "./games.js";
import { startMusic, stopMusic, speak } from "./audio.js";

function init() {
  applyBodyClasses();
  route("boot");
}

function route(where) {
  const s = getState();
  switch (where) {
    case "boot":
      showSplash(() => {
        if (!s.language) route("language");
        else if (!s.onboarded) route("onboarding");
        else route("hub");
      });
      break;
    case "language":
      showLanguagePicker(() => route("onboarding"));
      break;
    case "onboarding":
      showOnboarding(() => route("hub"));
      break;
    case "hub":
      startMusic();
      setState({ sessionStart: Date.now() });
      checkSessionTimer();
      showHub(
        (game) => route({ type: "game", game }),
        () => route("trophy"),
        () => route("gate"),
      );
      break;
    case "trophy":
      showTrophyRoom(() => route("hub"));
      break;
    case "gate":
      showParentGate(
        () => route("settings"),
        () => route("hub"),
      );
      break;
    case "settings":
      showSettings(() => route("hub"));
      break;
    default:
      if (where && where.type === "game") {
        stopMusicSoftly();
        startGameByKey(where.game, () => route("hub"));
      }
  }
}

function stopMusicSoftly() { stopMusic(); }

// Session length timer: gentle Tikko goodbye
let sessionCheckTimer = null;
function checkSessionTimer() {
  clearTimeout(sessionCheckTimer);
  const s = getState();
  const mins = s.settings.sessionMinutes || 0;
  if (!mins) return;
  const elapsed = (Date.now() - (s.sessionStart || Date.now())) / 60000;
  const remaining = mins - elapsed;
  if (remaining <= 0) {
    const lang = s.language || "en";
    speak(lang === "no"
      ? "Det var alt for nå! Vi sees snart!"
      : "That's all for now! See you soon!", lang);
    return;
  }
  sessionCheckTimer = setTimeout(checkSessionTimer, Math.min(remaining, 1) * 60000);
}

// Pause music when the tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopMusic();
});

// iOS: any first touch unlocks audio — handled in audio.unlockAudio

window.addEventListener("DOMContentLoaded", init);
