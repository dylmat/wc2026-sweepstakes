// ─── PLAYERS ───────────────────────────────────────────────────────────────
export const PLAYERS = [
  { id: 'oscar',    name: 'Oscar',    color: '#f97316' },
  { id: 'ben',      name: 'Ben',      color: '#38bdf8' },
  { id: 'harshi',   name: 'Harshi',   color: '#a78bfa' },
  { id: 'felicity', name: 'Felicity', color: '#f472b6' },
  { id: 'dylan',    name: 'Dylan',    color: '#34d399' },
  { id: 'adam',     name: 'Adam',     color: '#fbbf24' },
];

// ─── SWEEPSTAKES ASSIGNMENTS ────────────────────────────────────────────────
export const PLAYER_TEAMS = {
  oscar:    ['USA', 'Brazil', 'Colombia', 'Japan', 'South Africa', 'Iran', 'Czechia', 'New Zealand'],
  ben:      ['Canada', 'Argentina', 'Switzerland', 'Croatia', 'Qatar', 'Saudi Arabia', 'Bosnia & Herz.', 'Cape Verde'],
  harshi:   ['Mexico', 'France', 'Uruguay', 'Morocco', 'Haiti', 'Norway', 'Scotland', 'Iraq'],
  felicity: ['Germany', 'Portugal', 'Austria', 'Australia', 'Paraguay', 'Algeria', 'Türkiye', 'Jordan'],
  dylan:    ['England', 'Netherlands', 'Ecuador', 'South Korea', 'Ivory Coast', 'Uzbekistan', 'Curaçao', 'DR Congo'],
  adam:     ['Spain', 'Belgium', 'Senegal', 'Egypt', 'Sweden', 'Ghana', 'Tunisia', 'Panama'],
};

// ─── SWEEPSTAKES POINTS PER KNOCKOUT ROUND ─────────────────────────────────
// Scaling: winner ~82pts total, but 7 other teams still matter
export const ROUND_POINTS = {
  'Round of 32':  2,
  'Round of 16':  5,
  'Quarter-final': 12,
  'Semi-final':   22,
  '3rd Place':    15,
  'Runner-up':    35,
  'Winner':       50,
};

// ─── ACTUAL WC 2026 GROUPS (Official draw Dec 5, 2025) ─────────────────────
export const GROUPS = {
  A: ['Mexico', 'South Korea', 'South Africa', 'Czechia'],
  B: ['Canada', 'Bosnia & Herz.', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  D: ['USA', 'Australia', 'Paraguay', 'Türkiye'],
  E: ['Germany', 'Ecuador', 'Ivory Coast', 'Curaçao'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Iraq', 'Norway'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
  L: ['England', 'Croatia', 'Ghana', 'Panama'],
};

// ─── TEAM → PLAYER LOOKUP ───────────────────────────────────────────────────
export function getTeamOwner(teamName) {
  // Normalize some name variants
  const norm = {
    'United States': 'USA',
    'Bosnia and Herzegovina': 'Bosnia & Herz.',
    'Bosnia & Herzegovina': 'Bosnia & Herz.',
    'Ivory Coast': 'Ivory Coast',
    "Côte d'Ivoire": 'Ivory Coast',
    'Korea Republic': 'South Korea',
  };
  const key = norm[teamName] || teamName;
  for (const [playerId, teams] of Object.entries(PLAYER_TEAMS)) {
    if (teams.includes(key)) return playerId;
  }
  return null;
}

// ─── FLAG EMOJIS ────────────────────────────────────────────────────────────
export const FLAGS = {
  'Mexico': '🇲🇽', 'South Korea': '🇰🇷', 'South Africa': '🇿🇦', 'Czechia': '🇨🇿',
  'Canada': '🇨🇦', 'Bosnia & Herz.': '🇧🇦', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
  'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Haiti': '🇭🇹', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'USA': '🇺🇸', 'Australia': '🇦🇺', 'Paraguay': '🇵🇾', 'Türkiye': '🇹🇷',
  'Germany': '🇩🇪', 'Ecuador': '🇪🇨', 'Ivory Coast': '🇨🇮', 'Curaçao': '🇨🇼',
  'Netherlands': '🇳🇱', 'Japan': '🇯🇵', 'Sweden': '🇸🇪', 'Tunisia': '🇹🇳',
  'Belgium': '🇧🇪', 'Egypt': '🇪🇬', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿',
  'Spain': '🇪🇸', 'Cape Verde': '🇨🇻', 'Saudi Arabia': '🇸🇦', 'Uruguay': '🇺🇾',
  'France': '🇫🇷', 'Senegal': '🇸🇳', 'Iraq': '🇮🇶', 'Norway': '🇳🇴',
  'Argentina': '🇦🇷', 'Algeria': '🇩🇿', 'Austria': '🇦🇹', 'Jordan': '🇯🇴',
  'Portugal': '🇵🇹', 'DR Congo': '🇨🇩', 'Uzbekistan': '🇺🇿', 'Colombia': '🇨🇴',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷', 'Ghana': '🇬🇭', 'Panama': '🇵🇦',
};
