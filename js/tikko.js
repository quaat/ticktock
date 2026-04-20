// ============================================================================
// tikko.js — Tikko the owl mascot (SVG)
// ============================================================================

import { getState } from "./state.js";

const OUTFIT_ACCESSORY = {
  default:   "",
  baker:     `<g transform="translate(100,26)"><ellipse cx="0" cy="0" rx="38" ry="12" fill="#fff" stroke="#E4D4A8" stroke-width="2"/><path d="M-34,-2 Q-34,-34 0,-34 Q34,-34 34,-2 Z" fill="#fff" stroke="#E4D4A8" stroke-width="2"/></g>`,
  gardener:  `<g transform="translate(100,22)"><path d="M-60,0 Q0,-50 60,0 Q0,8 -60,0 Z" fill="#F2D46A" stroke="#C9A72F" stroke-width="2"/><circle cx="0" cy="-16" r="6" fill="#F2D46A" stroke="#C9A72F" stroke-width="2"/></g>`,
  conductor: `<g transform="translate(100,30)"><rect x="-34" y="-6" width="68" height="12" fill="#284070" stroke="#1a2a48" stroke-width="2" rx="4"/><path d="M-34,-6 Q0,-34 34,-6 Z" fill="#3B5893" stroke="#1a2a48" stroke-width="2"/><circle cx="0" cy="-18" r="4" fill="#E4B33B" /></g>`,
  captain:   `<g transform="translate(100,28)"><rect x="-36" y="-4" width="72" height="12" fill="#fff" stroke="#2a3a55" stroke-width="2" rx="3"/><path d="M-36,-4 Q0,-30 36,-4 Z" fill="#2a3a55"/><path d="M-6,-14 L0,-22 L6,-14 Z" fill="#E4B33B"/></g>`,
  wizard:    `<g transform="translate(100,18)"><path d="M-28,4 L0,-54 L28,4 Z" fill="#5B3B8A" stroke="#3A2058" stroke-width="2"/><circle cx="-10" cy="-18" r="2" fill="#FFF4B5"/><circle cx="8" cy="-30" r="2" fill="#FFF4B5"/><circle cx="0" cy="-10" r="2" fill="#FFF4B5"/><ellipse cx="0" cy="4" rx="30" ry="6" fill="#5B3B8A" stroke="#3A2058" stroke-width="2"/></g>`,
};

export function tikkoSVG({ outfit = "default", cheer = false, sad = false } = {}) {
  return `
  <svg class="tikko-svg" viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <radialGradient id="bellyGrad" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#FFF8E7"/>
        <stop offset="100%" stop-color="#F5E5BD"/>
      </radialGradient>
      <radialGradient id="bodyGrad" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stop-color="#D1A476"/>
        <stop offset="100%" stop-color="#A27645"/>
      </radialGradient>
    </defs>
    <g class="tikko-body">
      <!-- feet -->
      <ellipse cx="78" cy="180" rx="10" ry="4" fill="#E2A451"/>
      <ellipse cx="122" cy="180" rx="10" ry="4" fill="#E2A451"/>
      <!-- body -->
      <ellipse cx="100" cy="120" rx="62" ry="68" fill="url(#bodyGrad)" stroke="#6B4B3A" stroke-width="3"/>
      <!-- belly -->
      <ellipse cx="100" cy="128" rx="42" ry="48" fill="url(#bellyGrad)"/>
      <!-- wings -->
      <ellipse class="tikko-wing" cx="46" cy="118" rx="20" ry="34" fill="#8E5F38" stroke="#6B4B3A" stroke-width="3"/>
      <ellipse class="tikko-wing" cx="154" cy="118" rx="20" ry="34" fill="#8E5F38" stroke="#6B4B3A" stroke-width="3"/>
      <!-- pocket watch held in wing -->
      <g transform="translate(154,140)">
        <circle r="10" fill="#FFD86B" stroke="#6B4B3A" stroke-width="2"/>
        <line x1="0" y1="0" x2="0" y2="-6" stroke="#3A2A22" stroke-width="2" stroke-linecap="round"/>
        <line x1="0" y1="0" x2="4" y2="0" stroke="#3A2A22" stroke-width="2" stroke-linecap="round"/>
      </g>
      <!-- head -->
      <g>
        <!-- ear tufts -->
        <path d="M62,60 L54,38 L74,54 Z" fill="#8E5F38" stroke="#6B4B3A" stroke-width="2"/>
        <path d="M138,60 L146,38 L126,54 Z" fill="#8E5F38" stroke="#6B4B3A" stroke-width="2"/>
        <!-- face base -->
        <circle cx="100" cy="78" r="54" fill="url(#bodyGrad)" stroke="#6B4B3A" stroke-width="3"/>
        <!-- face disc -->
        <ellipse cx="100" cy="84" rx="42" ry="38" fill="#F5E5BD"/>
        <!-- eyes -->
        <g>
          <circle cx="82" cy="78" r="16" fill="#fff" stroke="#3A2A22" stroke-width="3"/>
          <circle cx="118" cy="78" r="16" fill="#fff" stroke="#3A2A22" stroke-width="3"/>
          <circle cx="82" cy="80" r="9" fill="#3A2A22"/>
          <circle cx="118" cy="80" r="9" fill="#3A2A22"/>
          <circle cx="86" cy="76" r="3" fill="#fff"/>
          <circle cx="122" cy="76" r="3" fill="#fff"/>
          <!-- blinking lids -->
          <ellipse class="tikko-eye-lid" cx="82" cy="78" rx="16" ry="16" fill="#D1A476"/>
          <ellipse class="tikko-eye-lid" cx="118" cy="78" rx="16" ry="16" fill="#D1A476"/>
        </g>
        <!-- beak -->
        <path d="M92,96 L108,96 L100,108 Z" fill="#F2A23B" stroke="#B97825" stroke-width="2" stroke-linejoin="round"/>
        <!-- cheek blush -->
        <ellipse cx="72" cy="98" rx="6" ry="3" fill="#FFB8A8" opacity="0.7"/>
        <ellipse cx="128" cy="98" rx="6" ry="3" fill="#FFB8A8" opacity="0.7"/>
      </g>
      ${OUTFIT_ACCESSORY[outfit] || ""}
    </g>
  </svg>`;
}

export function mountTikko(el, { outfit, cheer = false, sad = false } = {}) {
  const o = outfit || getState().outfit || "default";
  el.innerHTML = tikkoSVG({ outfit: o });
  el.classList.remove("cheer", "sad");
  if (cheer) { el.classList.add("cheer"); setTimeout(() => el.classList.remove("cheer"), 700); }
  if (sad)   { el.classList.add("sad");   setTimeout(() => el.classList.remove("sad"), 700); }
}
