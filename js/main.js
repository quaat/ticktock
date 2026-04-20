// ============================================================================
// main.js — app router and session flow
// ============================================================================

import { speak, stopMusic } from "./audio.js";
import { startGameByKey } from "./games.js";
import {
  applyBodyClasses,
  showHub,
  showLanguagePicker,
  showOnboarding,
  showQuickSetup,
  showSettings,
  showSplash,
  showTrophyRoom,
} from "./screens.js";
import { getActiveProfile, getLanguage, getState, setState } from "./state.js";

function init() {
  applyBodyClasses();
  route("boot");
}

function route(where) {
  const profile = getActiveProfile();
  const lang = getLanguage();
  if (typeof where === "string") setState({ currentRoute: where });

  switch (where) {
    case "boot":
      showSplash(() => {
        if (!profile.primaryLanguage) route("language");
        else if (!profile.onboarded) route("onboarding");
        else if (!profile.setupComplete) route("quicksetup");
        else route("hub");
      });
      break;
    case "language":
      showLanguagePicker(() => route("onboarding"));
      break;
    case "onboarding":
      showOnboarding(() => route("quicksetup"));
      break;
    case "quicksetup":
      showQuickSetup(() => route("hub"));
      break;
    case "hub":
      setState({ sessionStart: Date.now() });
      checkSessionTimer();
      showHub(
        (game) => route({ type: "game", game }),
        () => route("trophy"),
        () => route("settings"),
      );
      break;
    case "trophy":
      showTrophyRoom(() => route("hub"));
      break;
    case "settings":
      showSettings(() => route("hub"));
      break;
    default:
      if (where?.type === "game") {
        startGameByKey(where.game, () => route("hub"));
      } else {
        route("hub");
      }
  }
}

let sessionTimer = null;
function checkSessionTimer() {
  clearTimeout(sessionTimer);
  const mins = getState().settings.sessionMinutes || 0;
  if (!mins) return;
  const elapsed = (Date.now() - (getState().sessionStart || Date.now())) / 60000;
  const remaining = mins - elapsed;
  if (remaining <= 0) {
    speak(
      getLanguage() === "no"
        ? "Det var alt for nå. Vi sees snart!"
        : "That is all for now. See you soon!",
      getLanguage(),
    );
    stopMusic();
    return;
  }
  sessionTimer = setTimeout(checkSessionTimer, Math.min(remaining, 1) * 60000);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopMusic();
});

window.addEventListener("DOMContentLoaded", init);
