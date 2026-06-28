// ─── PLAYERS ───────────────────────────────────────────────────────────────
export const PLAYERS = [
  { id: "dylan", name: "Dylan", color: "#34d399" },
  { id: "harshi", name: "Harshi", color: "#a78bfa" },
  { id: "oscar", name: "Oscar", color: "#f97316" },
  { id: "adam", name: "Adam", color: "#fbbf24" },
  { id: "carly", name: "Carly", color: "#f472b6" },
  { id: "hylton", name: "Hylton", color: "#60a5fa" },
  { id: "felicity", name: "Felicity", color: "#fb7185" },
  { id: "ben", name: "Ben", color: "#38bdf8" },
];

// ─── SWEEPSTAKES ASSIGNMENTS ────────────────────────────────────────────────
export const PLAYER_TEAMS = {
  dylan: ["France", "Mexico", "Paraguay", "Canada", "Iran", "Jordan"],
  harshi: ["Spain", "Switzerland", "USA", "Sweden", "Curaçao", "New Zealand"],
  oscar: ["Portugal", "Morocco", "Austria", "Egypt", "Tunisia", "Australia"],
  adam: ["Argentina", "Uruguay", "Ecuador", "Scotland", "Czechia", "Panama"],
  carly: ["England", "Japan", "Türkiye", "South Korea", "Cape Verde", "Qatar"],
  hylton: [
    "Brazil",
    "Norway",
    "Croatia",
    "Bosnia & Herz.",
    "DR Congo",
    "Saudi Arabia",
  ],
  felicity: [
    "Germany",
    "Colombia",
    "Senegal",
    "Algeria",
    "Haiti",
    "South Africa",
  ],
  ben: ["Netherlands", "Belgium", "Ivory Coast", "Ghana", "Iraq", "Uzbekistan"],
};

// ─── SWEEPSTAKES POINTS PER KNOCKOUT ROUND ─────────────────────────────────
export const ROUND_POINTS = {
  "Round of 32": 2,
  "Round of 16": 5,
  "Quarter-final": 12,
  "Semi-final": 22,
  "3rd Place": 15,
  "Runner-up": 35,
  Winner: 50,
};

// ─── ACTUAL WC 2026 GROUPS (Official draw) ──────────────────────────────────
export const GROUPS = {
  A: ["Mexico", "South Korea", "South Africa", "Czechia"],
  B: ["Canada", "Bosnia & Herz.", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["USA", "Australia", "Paraguay", "Türkiye"],
  E: ["Germany", "Ecuador", "Ivory Coast", "Curaçao"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

// ─── TEAM → PLAYER LOOKUP ───────────────────────────────────────────────────
// Single source of truth for team-name normalisation. Both data.js (here)
// and App.jsx import from this — keeping one map avoids the two files'
// name-variant lists silently drifting apart, which can make a team's
// points vanish from the leaderboard with no visible error.
export const NORMALIZE_MAP = {
  "United States": "USA",
  US: "USA",
  "Bosnia and Herzegovina": "Bosnia & Herz.",
  "Bosnia & Herzegovina": "Bosnia & Herz.",
  "Bosnia-Herzegovina": "Bosnia & Herz.",
  "Bosnia-H.": "Bosnia & Herz.",
  "Côte d'Ivoire": "Ivory Coast",
  "Cote d'Ivoire": "Ivory Coast",
  "Korea Republic": "South Korea",
  Turkey: "Türkiye",
  "Congo DR": "DR Congo",
  "Congo, DR": "DR Congo",
  "Cape Verde Islands": "Cape Verde",
  "Czech Republic": "Czechia",
};

export function normalizeTeamName(name) {
  if (!name) return "";
  return NORMALIZE_MAP[name] || name;
}

export function getTeamOwner(teamName) {
  const key = normalizeTeamName(teamName);
  for (const [playerId, teams] of Object.entries(PLAYER_TEAMS)) {
    if (teams.includes(key)) return playerId;
  }
  return null;
}

// ─── ROUND OF 32 MATCHUPS (hardcoded — fill in once group stage is final) ────
// Match numbers 73-88 follow the official FIFA WC 2026 schedule in
// chronological order. Use exact team names as they appear in PLAYER_TEAMS.
export const ROUND_OF_32_MATCHES = [
  { match: 73, home: "South Africa", away: "Canada" },
  { match: 74, home: "Germany", away: "Paraguay" },
  { match: 75, home: "Netherlands", away: "Morocco" },
  { match: 76, home: "Brazil", away: "Japan" },
  { match: 77, home: "France", away: "Sweden" },
  { match: 78, home: "Ivory Coast", away: "Norway" },
  { match: 79, home: "Mexico", away: "Ecuador" },
  { match: 80, home: "England", away: "DR Congo" },
  { match: 81, home: "USA", away: "Bosnia & Herz." },
  { match: 82, home: "Belgium", away: "Senegal" },
  { match: 83, home: "Portugal", away: "Croatia" },
  { match: 84, home: "Spain", away: "Austria" },
  { match: 85, home: "Switzerland", away: "Algeria" },
  { match: 86, home: "Argentina", away: "Cape Verde" },
  { match: 87, home: "Colombia", away: "Ghana" },
  { match: 88, home: "Australia", away: "Egypt" },
];

// ─── FLAG EMOJIS ────────────────────────────────────────────────────────────
export const FLAGS = {
  Mexico: "🇲🇽",
  "South Korea": "🇰🇷",
  "South Africa": "🇿🇦",
  Czechia: "🇨🇿",
  Canada: "🇨🇦",
  "Bosnia & Herz.": "🇧🇦",
  Qatar: "🇶🇦",
  Switzerland: "🇨🇭",
  Brazil: "🇧🇷",
  Morocco: "🇲🇦",
  Haiti: "🇭🇹",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA: "🇺🇸",
  Australia: "🇦🇺",
  Paraguay: "🇵🇾",
  Türkiye: "🇹🇷",
  Germany: "🇩🇪",
  Ecuador: "🇪🇨",
  "Ivory Coast": "🇨🇮",
  Curaçao: "🇨🇼",
  Netherlands: "🇳🇱",
  Japan: "🇯🇵",
  Sweden: "🇸🇪",
  Tunisia: "🇹🇳",
  Belgium: "🇧🇪",
  Egypt: "🇪🇬",
  Iran: "🇮🇷",
  "New Zealand": "🇳🇿",
  Spain: "🇪🇸",
  "Cape Verde": "🇨🇻",
  "Saudi Arabia": "🇸🇦",
  Uruguay: "🇺🇾",
  France: "🇫🇷",
  Senegal: "🇸🇳",
  Iraq: "🇮🇶",
  Norway: "🇳🇴",
  Argentina: "🇦🇷",
  Algeria: "🇩🇿",
  Austria: "🇦🇹",
  Jordan: "🇯🇴",
  Portugal: "🇵🇹",
  "DR Congo": "🇨🇩",
  Uzbekistan: "🇺🇿",
  Colombia: "🇨🇴",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Croatia: "🇭🇷",
  Ghana: "🇬🇭",
  Panama: "🇵🇦",
};
