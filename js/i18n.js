// ============================================================================
// i18n.js — translations and bilingual time phrasing
// ============================================================================

export const STRINGS = {
  en: {
    tap_to_start: "Tap to start",
    choose_language: "Choose your language",
    ob_drag: "Can you move the big hand? Try it!",
    ob_good: "Great! You're a natural!",
    lets_go: "Let's go!",
    b_bakery: "Bakery",
    b_garden: "Garden",
    b_station: "Station",
    b_lighthouse: "Lighthouse",
    b_market: "Market",
    b_routine: "My Day",
    b_tower: "Clock Tower — Free Play",
    trophy_title: "Trophy Room",
    tikkos_outfits: "Tikko's Outfits",
    settings_title: "Grown-ups",
    language: "Language",
    both_langs: "Both",
    volume: "Volume",
    music: "Music",
    effects: "Effects",
    voice: "Voice",
    accessibility: "Accessibility",
    reduced_motion: "Reduced motion",
    dyslexia_font: "Dyslexia-friendly font",
    high_contrast: "High contrast",
    session: "Session length",
    unlimited: "Unlimited",
    reset_progress: "Reset progress",
    gate_title: "Grown-up check",
    gate_hint: "Drag each slider to match its target.",
    continue: "Continue",
    cancel: "Cancel",
    correct: "Woohoo!",
    almost: "Almost!",
    try_again: "Try again!",
    play_again: "Play again",
    back_to_town: "Back to town",
    keep_playing: "Keep playing",
    leave: "Leave",
    new_outfit: "New outfit!",
    new_item: "You earned:",
    customer_wants: "wants a pastry at",
    water_at: "Water the flower at",
    train_at: "Train departs at",
    beacon_at: "Light the beacon at",
    match_pairs: "Match the clocks!",
    your_day: "Your day",
    // routine scenes
    r_wakeup: "Wake up",
    r_breakfast: "Breakfast",
    r_school: "Go to school",
    r_lunch: "Lunchtime",
    r_play: "Playtime",
    r_dinner: "Dinner",
    r_bath: "Bath time",
    r_bed: "Bedtime",
  },
  no: {
    tap_to_start: "Trykk for å starte",
    choose_language: "Velg språk",
    ob_drag: "Kan du flytte den store viseren? Prøv!",
    ob_good: "Flott! Du er et naturtalent!",
    lets_go: "Vi går!",
    b_bakery: "Bakeri",
    b_garden: "Hage",
    b_station: "Stasjon",
    b_lighthouse: "Fyrtårn",
    b_market: "Marked",
    b_routine: "Min dag",
    b_tower: "Klokketårnet — Fri lek",
    trophy_title: "Pokalrom",
    tikkos_outfits: "Tikkos antrekk",
    settings_title: "Voksne",
    language: "Språk",
    both_langs: "Begge",
    volume: "Volum",
    music: "Musikk",
    effects: "Lydeffekter",
    voice: "Stemme",
    accessibility: "Tilgjengelighet",
    reduced_motion: "Redusert bevegelse",
    dyslexia_font: "Dyslektiker-vennlig skrift",
    high_contrast: "Høy kontrast",
    session: "Økt-lengde",
    unlimited: "Ubegrenset",
    reset_progress: "Nullstill fremgang",
    gate_title: "Voksen-sjekk",
    gate_hint: "Dra hver glidebryter til målet.",
    continue: "Fortsett",
    cancel: "Avbryt",
    correct: "Jippi!",
    almost: "Nesten!",
    try_again: "Prøv igjen!",
    play_again: "Spill igjen",
    back_to_town: "Tilbake til byen",
    keep_playing: "Fortsett å spille",
    leave: "Avslutt",
    new_outfit: "Nytt antrekk!",
    new_item: "Du fikk:",
    customer_wants: "vil ha en bakverk klokken",
    water_at: "Vann blomsten klokken",
    train_at: "Toget går klokken",
    beacon_at: "Tenn fyret klokken",
    match_pairs: "Match klokkene!",
    your_day: "Dagen din",
    r_wakeup: "Stå opp",
    r_breakfast: "Frokost",
    r_school: "Gå på skolen",
    r_lunch: "Lunsjtid",
    r_play: "Leketid",
    r_dinner: "Middag",
    r_bath: "Badetid",
    r_bed: "Legge seg",
  }
};

export function t(key, lang) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
}

// -----------------------------------------------------------------------------
// Time phrasing — English
// -----------------------------------------------------------------------------

const EN_HOURS_12 = [
  "twelve","one","two","three","four","five","six","seven","eight","nine","ten","eleven"
];

function enHourWord(h24) { return EN_HOURS_12[h24 % 12]; }

function enMinutesWord(m) {
  if (m === 15) return "quarter";
  if (m === 30) return "half";
  if (m === 45) return "quarter";
  const n = [
    "","one","two","three","four","five","six","seven","eight","nine","ten",
    "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
    "eighteen","nineteen","twenty","twenty one","twenty two","twenty three",
    "twenty four","twenty five","twenty six","twenty seven","twenty eight","twenty nine"
  ];
  return n[m] || String(m);
}

export function speakTimeEn(h, m) {
  if (m === 0) return `${enHourWord(h)} o'clock`;
  if (m === 30) return `half past ${enHourWord(h)}`;
  if (m === 15) return `quarter past ${enHourWord(h)}`;
  if (m === 45) return `quarter to ${enHourWord(h + 1)}`;
  if (m <= 30) return `${enMinutesWord(m)} past ${enHourWord(h)}`;
  return `${enMinutesWord(60 - m)} to ${enHourWord(h + 1)}`;
}

// -----------------------------------------------------------------------------
// Time phrasing — Norwegian
// Norwegian convention:
//   3:00  -> "klokka tre"
//   3:15  -> "kvart over tre"
//   3:30  -> "halv fire"          (half toward next hour)
//   3:45  -> "kvart på fire"
//   3:05  -> "fem over tre"
//   3:10  -> "ti over tre"
//   3:20  -> "ti på halv fire"
//   3:25  -> "fem på halv fire"
//   3:35  -> "fem over halv fire"
//   3:40  -> "ti over halv fire"
//   3:50  -> "ti på fire"
//   3:55  -> "fem på fire"
// -----------------------------------------------------------------------------

const NO_HOURS = [
  "tolv","ett","to","tre","fire","fem","seks","sju","åtte","ni","ti","elleve"
];
function noHour(h24) { return NO_HOURS[h24 % 12]; }

export function speakTimeNo(h, m) {
  const next = (h + 1);
  if (m === 0)  return `klokka ${noHour(h)}`;
  if (m === 5)  return `fem over ${noHour(h)}`;
  if (m === 10) return `ti over ${noHour(h)}`;
  if (m === 15) return `kvart over ${noHour(h)}`;
  if (m === 20) return `ti på halv ${noHour(next)}`;
  if (m === 25) return `fem på halv ${noHour(next)}`;
  if (m === 30) return `halv ${noHour(next)}`;
  if (m === 35) return `fem over halv ${noHour(next)}`;
  if (m === 40) return `ti over halv ${noHour(next)}`;
  if (m === 45) return `kvart på ${noHour(next)}`;
  if (m === 50) return `ti på ${noHour(next)}`;
  if (m === 55) return `fem på ${noHour(next)}`;
  // fallback for any non-5-minute time
  return `klokka ${noHour(h)} ${m}`;
}

export function speakTime(h, m, lang) {
  if (lang === "no") return speakTimeNo(h, m);
  return speakTimeEn(h, m);
}

// Returns a short visible label used in customer speech bubbles
export function timeLabel(h, m, lang) {
  const hh = ((h + 11) % 12) + 1;
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}
