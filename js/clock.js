// ============================================================================
// clock.js — Analog clock component with draggable hands.
//
// Usage:
//   const clock = createClock(container, {
//     hour: 3, minute: 0,
//     draggable: true,
//     snap: "hour" | "half" | "quarter" | "5min" | "1min",
//     showQuarterOverlay: false,
//     showNumbers: true,
//     onChange: (h, m) => {},
//     onTick:   (i) => {},   // called when a hand crosses a snap boundary
//   });
//   clock.setTime(h, m);
//   clock.readout();            // returns [h, m]
//   clock.destroy();
// ============================================================================

import { sfxTick } from "./audio.js";

const SNAP_MINUTES = {
  hour: 60,
  half: 30,
  quarter: 15,
  "5min": 5,
  "1min": 1,
};

export function createClock(container, opts = {}) {
  const {
    hour = 12,
    minute = 0,
    draggable = true,
    snap = "5min",
    showQuarterOverlay = false,
    showHalfOverlay = false,
    showNumbers = true,
    onChange = () => {},
    onTick = () => {},
    highlightHour = null,  // e.g. 6 glows to guide for "half past"
  } = opts;

  // State:
  //  - idle: h is an integer 0..11, m is an integer 0..59
  //  - dragging "minute": m may be a float 0..60 (wraps advance h)
  //  - dragging "hour":   h may be a float 0..12 (m unchanged)
  // On pointerup the values are snapped to the game's grid.
  let h = ((hour % 12) + 12) % 12;
  let m = ((minute % 60) + 60) % 60;

  const snapMin = SNAP_MINUTES[snap] || 5;

  const root = document.createElement("div");
  root.className = "clock";
  const size = 200; // viewBox size

  // Hands are drawn in their own coordinate system centered on (0,0) and
  // rotated by a wrapping <g transform="translate(100,100) rotate(a)">.
  // This guarantees the rotation pivot is always the clock center regardless
  // of any CSS transform-origin quirks. Each hand extends from a small
  // counterweight (y=+12) through the pivot (y=0) out to the tip (y=-46/-70)
  // so the geometric anchor at the center is visually unambiguous.
  root.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet">
      <defs></defs>
      <circle class="clock-face-bg" cx="100" cy="100" r="92"/>
      <circle class="clock-ring" cx="100" cy="100" r="92"/>
      ${showHalfOverlay ? `<path class="clock-quarter-overlay" d="M100,100 L100,8 A92,92 0 0 1 100,192 Z"/>` : ""}
      ${showQuarterOverlay ? `<path class="clock-quarter-overlay" d="M100,100 L100,8 A92,92 0 0 1 192,100 Z"/>` : ""}
      <g class="clock-ticks"></g>
      ${showNumbers ? `<g class="clock-nums"></g>` : ""}
      <g class="clock-hands" transform="translate(100 100)">
        <g class="hand-rot hour-rot">
          <line class="clock-hand hour"   x1="0" y1="12"  x2="0" y2="-46"/>
        </g>
        <g class="hand-rot minute-rot">
          <line class="clock-hand minute" x1="0" y1="14" x2="0" y2="-72"/>
        </g>
      </g>
      <circle class="clock-center" cx="100" cy="100" r="7"/>
    </svg>
  `;
  container.appendChild(root);

  const svg = root.querySelector("svg");
  const hourRot = root.querySelector(".hour-rot");
  const minRot  = root.querySelector(".minute-rot");
  const hourHand = root.querySelector(".clock-hand.hour");
  const minHand  = root.querySelector(".clock-hand.minute");
  const ticksG   = root.querySelector(".clock-ticks");
  const numsG    = root.querySelector(".clock-nums");

  // ticks
  for (let i = 0; i < 60; i++) {
    const angle = i * 6 - 90;
    const rad = angle * Math.PI / 180;
    const outer = 92, inner = i % 5 === 0 ? 80 : 86;
    const x1 = 100 + Math.cos(rad) * outer;
    const y1 = 100 + Math.sin(rad) * outer;
    const x2 = 100 + Math.cos(rad) * inner;
    const y2 = 100 + Math.sin(rad) * inner;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("class", "clock-tick");
    line.setAttribute("x1", x1); line.setAttribute("y1", y1);
    line.setAttribute("x2", x2); line.setAttribute("y2", y2);
    line.setAttribute("stroke-width", i % 5 === 0 ? 3 : 1.2);
    ticksG.appendChild(line);
  }
  // numbers
  if (showNumbers && numsG) {
    for (let n = 1; n <= 12; n++) {
      const angle = n * 30 - 90;
      const rad = angle * Math.PI / 180;
      const r = 68;
      const x = 100 + Math.cos(rad) * r;
      const y = 100 + Math.sin(rad) * r;
      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("class", "clock-num");
      txt.setAttribute("x", x); txt.setAttribute("y", y);
      txt.setAttribute("font-size", 18);
      txt.textContent = n;
      if (highlightHour === n) {
        txt.setAttribute("fill", "#D7433C");
        txt.setAttribute("font-size", 24);
      }
      numsG.appendChild(txt);
    }
  }

  function render() {
    // Hour hand advances proportionally with minutes.
    // The parent <g> already translates to the clock center, so rotating the
    // inner <g> pivots around (0,0) in its local space == clock center.
    const hourAngle   = ((h % 12) + m / 60) * 30;
    const minuteAngle = (m % 60) * 6;
    hourRot.setAttribute("transform", `rotate(${hourAngle})`);
    minRot.setAttribute("transform",  `rotate(${minuteAngle})`);
  }

  render();

  // ----- Interaction -------------------------------------------------------
  let dragging = null; // 'hour' | 'minute' | null
  let lastTickBucket = null; // for 5-min tick SFX during free drag

  function svgPoint(evt) {
    const rect = svg.getBoundingClientRect();
    const pt = evt.touches && evt.touches[0] ? evt.touches[0] : evt;
    const x = pt.clientX - rect.left;
    const y = pt.clientY - rect.top;
    // convert to viewBox coords
    const vx = (x / rect.width) * 200;
    const vy = (y / rect.height) * 200;
    return { x: vx, y: vy };
  }

  function pointAngle(p) {
    const dx = p.x - 100, dy = p.y - 100;
    let a = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 at top
    if (a < 0) a += 360;
    return a;
  }

  function onPointerDown(e) {
    if (!draggable) return;
    const p = svgPoint(e);
    const dx = p.x - 100, dy = p.y - 100;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Ignore taps outside the clock face
    if (dist > 92) return;

    // Decide which hand: whichever current hand angle is closer to the tap.
    // Ties break by radial distance (far = minute, near = hour).
    const tapA = pointAngle(p);
    const hourA = ((h % 12) + m / 60) * 30;
    const minuteA = (m % 60) * 6;
    const dHour = angularDelta(tapA, hourA);
    const dMin  = angularDelta(tapA, minuteA);
    if (Math.abs(dHour - dMin) < 8) {
      dragging = dist > 46 ? "minute" : "hour";
    } else {
      dragging = dMin < dHour ? "minute" : "hour";
    }
    (dragging === "minute" ? minHand : hourHand).classList.add("dragging");
    prevPointerAngle = tapA;
    lastTickBucket = dragging === "minute"
      ? `m${Math.round(m / 5)}`
      : `h${Math.round(h)}`;
    e.preventDefault();
    // Don't update on the initial tap — wait for actual finger motion, so just
    // touching a hand doesn't knock it to a new position.
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function angularDelta(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function onPointerMove(e) { if (dragging) updateFromPointer(e); }
  function onPointerUp() {
    if (!dragging) return;
    (dragging === "minute" ? minHand : hourHand).classList.remove("dragging");

    // Snap to the game's grid on release. During drag the hands moved
    // continuously for a natural "swirl" feel; here we commit to a valid
    // grid value.
    if (dragging === "minute") {
      const snapped = snapMinuteTotal(m, snapMin);
      // If snap rolls over 60 (e.g. m=58 → 60 with 5-min grid), advance hour.
      if (snapped >= 60) {
        m = snapped - 60;
        h = (Math.floor(h) + 1) % 12;
      } else {
        m = snapped;
        h = Math.floor(h) % 12;
      }
    } else {
      // For hour drag we keep m as-is and snap h to nearest integer hour.
      h = ((Math.round(h) % 12) + 12) % 12;
    }
    m = ((Math.round(m) % 60) + 60) % 60;
    render();
    onChange(h, m);

    dragging = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  // Accumulate pointer motion as an angular delta. This is far more natural
  // than mapping absolute finger angle to a hand angle: the user can grab
  // anywhere on the hand and "swirl" it; the hand follows the finger's rotation
  // around the centre rather than snapping to wherever the finger happens to
  // be pointing from (0,0).
  let prevPointerAngle = 0;

  function updateFromPointer(e) {
    const p = svgPoint(e);
    const a = pointAngle(p);
    let delta = a - prevPointerAngle;
    if (delta > 180)  delta -= 360;
    if (delta < -180) delta += 360;
    prevPointerAngle = a;

    if (dragging === "minute") {
      // 6° of rotation = 1 minute
      let newM = m + delta / 6;
      // Allow wraps: if minute passes 60 going forward, roll hour. Same backward.
      while (newM >= 60) { newM -= 60; h = (h + 1) % 12; }
      while (newM < 0)   { newM += 60; h = (h + 11) % 12; }
      m = newM;
    } else {
      // 30° of rotation = 1 hour. Keep h fractional; minute is untouched.
      let newH = h + delta / 30;
      while (newH >= 12) newH -= 12;
      while (newH < 0)   newH += 12;
      h = newH;
    }
    render();
    maybeTick();
    onChange(
      ((Math.floor(h) % 12) + 12) % 12,
      ((Math.round(m) % 60) + 60) % 60
    );
  }

  function maybeTick() {
    // Fire a musical tick each time we cross a 5-minute boundary (for minute
    // drag) or an integer hour (for hour drag).
    let bucket;
    if (dragging === "minute") bucket = `m${Math.round(m / 5)}`;
    else                       bucket = `h${Math.round(h)}`;
    if (bucket !== lastTickBucket) {
      lastTickBucket = bucket;
      const idx = dragging === "minute" ? Math.round(m / 5) : Math.round(h);
      sfxTick(idx);
      onTick(idx);
    }
  }

  // Snap a minute value to the game grid. Returns 0..60 (60 signals a forward
  // hour wrap to be handled by the caller).
  function snapMinuteTotal(raw, step) {
    return Math.round(raw / step) * step;
  }

  if (draggable) {
    svg.addEventListener("pointerdown", onPointerDown);
  }

  // ----- API --------------------------------------------------------------
  function setTime(newH, newM) {
    h = ((newH % 12) + 12) % 12;
    m = ((newM % 60) + 60) % 60;
    render();
  }

  function getTime() { return [h, m]; }

  function flashCorrect() {
    root.classList.remove("wrong");
    root.classList.add("correct");
    setTimeout(() => root.classList.remove("correct"), 700);
  }
  function flashWrong() {
    root.classList.remove("correct");
    root.classList.add("wrong");
    setTimeout(() => root.classList.remove("wrong"), 500);
  }

  function destroy() { try { root.remove(); } catch {} }

  return { el: root, setTime, getTime, flashCorrect, flashWrong, destroy,
    get hour(){return h;}, get minute(){return m;} };
}

// Read-only mini clock for the Market memory game
export function renderStaticClock(container, h, m) {
  return createClock(container, { hour: h, minute: m, draggable: false, showNumbers: false });
}
