// Full WC 2026 schedule — UTC kickoff times
// All times verified from official FIFA schedule
// Melbourne (AEDT/AEST) = UTC+10 in June-July (no daylight saving)
// So UTC+0 = Melbourne -10h (e.g. 19:00 UTC = 05:00 AEDT next day)

export const SCHEDULE = [
  // ── GROUP STAGE MATCHDAY 1 ─────────────────────────────────────────────
  // Jun 11
  { id: 1,  date: '2026-06-11T19:00:00Z', team1: 'Mexico',       team2: 'South Africa', group: 'A', status: 'FINISHED', score: null },
  { id: 2,  date: '2026-06-12T02:00:00Z', team1: 'South Korea',  team2: 'Czechia',      group: 'A', status: 'SCHEDULED', score: null },
  // Jun 12
  { id: 3,  date: '2026-06-12T19:00:00Z', team1: 'Canada',       team2: 'Bosnia & Herz.', group: 'B', status: 'SCHEDULED', score: null },
  { id: 4,  date: '2026-06-12T22:00:00Z', team1: 'USA',          team2: 'Paraguay',     group: 'D', status: 'SCHEDULED', score: null },
  // Jun 13
  { id: 5,  date: '2026-06-13T16:00:00Z', team1: 'Qatar',        team2: 'Switzerland',  group: 'B', status: 'SCHEDULED', score: null },
  { id: 6,  date: '2026-06-13T22:00:00Z', team1: 'Brazil',       team2: 'Morocco',      group: 'C', status: 'SCHEDULED', score: null },
  { id: 7,  date: '2026-06-14T01:00:00Z', team1: 'Haiti',        team2: 'Scotland',     group: 'C', status: 'SCHEDULED', score: null },
  { id: 8,  date: '2026-06-14T01:00:00Z', team1: 'Australia',    team2: 'Türkiye',      group: 'D', status: 'SCHEDULED', score: null },
  // Jun 14
  { id: 9,  date: '2026-06-14T17:00:00Z', team1: 'Germany',      team2: 'Curaçao',      group: 'E', status: 'SCHEDULED', score: null },
  { id: 10, date: '2026-06-14T20:00:00Z', team1: 'Netherlands',  team2: 'Japan',        group: 'F', status: 'SCHEDULED', score: null },
  { id: 11, date: '2026-06-14T23:00:00Z', team1: 'Ivory Coast',  team2: 'Ecuador',      group: 'E', status: 'SCHEDULED', score: null },
  { id: 12, date: '2026-06-15T02:00:00Z', team1: 'Sweden',       team2: 'Tunisia',      group: 'F', status: 'SCHEDULED', score: null },
  // Jun 15
  { id: 13, date: '2026-06-15T17:00:00Z', team1: 'Spain',        team2: 'Cape Verde',   group: 'H', status: 'SCHEDULED', score: null },
  { id: 14, date: '2026-06-15T20:00:00Z', team1: 'Belgium',      team2: 'Egypt',        group: 'G', status: 'SCHEDULED', score: null },
  { id: 15, date: '2026-06-15T22:00:00Z', team1: 'Saudi Arabia', team2: 'Uruguay',      group: 'H', status: 'SCHEDULED', score: null },
  { id: 16, date: '2026-06-16T01:00:00Z', team1: 'Iran',         team2: 'New Zealand',  group: 'G', status: 'SCHEDULED', score: null },
  // Jun 16
  { id: 17, date: '2026-06-16T19:00:00Z', team1: 'France',       team2: 'Senegal',      group: 'I', status: 'SCHEDULED', score: null },
  { id: 18, date: '2026-06-16T22:00:00Z', team1: 'Iraq',         team2: 'Norway',       group: 'I', status: 'SCHEDULED', score: null },
  { id: 19, date: '2026-06-17T00:00:00Z', team1: 'Argentina',    team2: 'Algeria',      group: 'J', status: 'SCHEDULED', score: null },
  { id: 20, date: '2026-06-17T01:00:00Z', team1: 'Austria',      team2: 'Jordan',       group: 'J', status: 'SCHEDULED', score: null },
  // Jun 17
  { id: 21, date: '2026-06-17T17:00:00Z', team1: 'Portugal',     team2: 'DR Congo',     group: 'K', status: 'SCHEDULED', score: null },
  { id: 22, date: '2026-06-17T20:00:00Z', team1: 'England',      team2: 'Croatia',      group: 'L', status: 'SCHEDULED', score: null },
  { id: 23, date: '2026-06-17T23:00:00Z', team1: 'Ghana',        team2: 'Panama',       group: 'L', status: 'SCHEDULED', score: null },
  { id: 24, date: '2026-06-18T02:00:00Z', team1: 'Uzbekistan',   team2: 'Colombia',     group: 'K', status: 'SCHEDULED', score: null },

  // ── GROUP STAGE MATCHDAY 2 ─────────────────────────────────────────────
  // Jun 18
  { id: 25, date: '2026-06-18T16:00:00Z', team1: 'South Africa', team2: 'Czechia',      group: 'A', status: 'SCHEDULED', score: null },
  { id: 26, date: '2026-06-18T19:00:00Z', team1: 'Mexico',       team2: 'South Korea',  group: 'A', status: 'SCHEDULED', score: null },
  { id: 27, date: '2026-06-18T19:00:00Z', team1: 'Switzerland',  team2: 'Bosnia & Herz.', group: 'B', status: 'SCHEDULED', score: null },
  { id: 28, date: '2026-06-18T22:00:00Z', team1: 'Canada',       team2: 'Qatar',        group: 'B', status: 'SCHEDULED', score: null },
  // Jun 19
  { id: 29, date: '2026-06-19T16:00:00Z', team1: 'USA',          team2: 'Australia',    group: 'D', status: 'SCHEDULED', score: null },
  { id: 30, date: '2026-06-19T19:00:00Z', team1: 'Scotland',     team2: 'Morocco',      group: 'C', status: 'SCHEDULED', score: null },
  { id: 31, date: '2026-06-19T22:00:00Z', team1: 'Brazil',       team2: 'Haiti',        group: 'C', status: 'SCHEDULED', score: null },
  { id: 32, date: '2026-06-20T01:00:00Z', team1: 'Türkiye',      team2: 'Paraguay',     group: 'D', status: 'SCHEDULED', score: null },
  // Jun 20
  { id: 33, date: '2026-06-20T16:00:00Z', team1: 'Sweden',       team2: 'Netherlands',  group: 'F', status: 'SCHEDULED', score: null },
  { id: 34, date: '2026-06-20T19:00:00Z', team1: 'Germany',      team2: 'Ivory Coast',  group: 'E', status: 'SCHEDULED', score: null },
  { id: 35, date: '2026-06-20T22:00:00Z', team1: 'Japan',        team2: 'Tunisia',      group: 'F', status: 'SCHEDULED', score: null },
  { id: 36, date: '2026-06-21T01:00:00Z', team1: 'Ecuador',      team2: 'Curaçao',      group: 'E', status: 'SCHEDULED', score: null },
  // Jun 21
  { id: 37, date: '2026-06-21T16:00:00Z', team1: 'New Zealand',  team2: 'Egypt',        group: 'G', status: 'SCHEDULED', score: null },
  { id: 38, date: '2026-06-21T19:00:00Z', team1: 'Spain',        team2: 'Saudi Arabia', group: 'H', status: 'SCHEDULED', score: null },
  { id: 39, date: '2026-06-21T22:00:00Z', team1: 'Belgium',      team2: 'Iran',         group: 'G', status: 'SCHEDULED', score: null },
  { id: 40, date: '2026-06-22T01:00:00Z', team1: 'Uruguay',      team2: 'Cape Verde',   group: 'H', status: 'SCHEDULED', score: null },
  // Jun 22
  { id: 41, date: '2026-06-22T17:00:00Z', team1: 'Argentina',    team2: 'Austria',      group: 'J', status: 'SCHEDULED', score: null },
  { id: 42, date: '2026-06-22T20:00:00Z', team1: 'France',       team2: 'Iraq',         group: 'I', status: 'SCHEDULED', score: null },
  { id: 43, date: '2026-06-23T00:00:00Z', team1: 'Norway',       team2: 'Senegal',      group: 'I', status: 'SCHEDULED', score: null },
  { id: 44, date: '2026-06-23T01:00:00Z', team1: 'Jordan',       team2: 'Algeria',      group: 'J', status: 'SCHEDULED', score: null },
  // Jun 23
  { id: 45, date: '2026-06-23T17:00:00Z', team1: 'Portugal',     team2: 'Uzbekistan',   group: 'K', status: 'SCHEDULED', score: null },
  { id: 46, date: '2026-06-23T20:00:00Z', team1: 'England',      team2: 'Ghana',        group: 'L', status: 'SCHEDULED', score: null },
  { id: 47, date: '2026-06-24T00:00:00Z', team1: 'Croatia',      team2: 'Panama',       group: 'L', status: 'SCHEDULED', score: null },
  { id: 48, date: '2026-06-24T01:00:00Z', team1: 'Colombia',     team2: 'DR Congo',     group: 'K', status: 'SCHEDULED', score: null },

  // ── GROUP STAGE MATCHDAY 3 ─────────────────────────────────────────────
  // Jun 24
  { id: 49, date: '2026-06-24T23:00:00Z', team1: 'South Africa', team2: 'South Korea',  group: 'A', status: 'SCHEDULED', score: null },
  { id: 50, date: '2026-06-24T23:00:00Z', team1: 'Czechia',      team2: 'Mexico',       group: 'A', status: 'SCHEDULED', score: null },
  { id: 51, date: '2026-06-25T01:00:00Z', team1: 'Bosnia & Herz.', team2: 'Qatar',      group: 'B', status: 'SCHEDULED', score: null },
  { id: 52, date: '2026-06-25T01:00:00Z', team1: 'Switzerland',  team2: 'Canada',       group: 'B', status: 'SCHEDULED', score: null },
  // Jun 25
  { id: 53, date: '2026-06-25T23:00:00Z', team1: 'Scotland',     team2: 'Brazil',       group: 'C', status: 'SCHEDULED', score: null },
  { id: 54, date: '2026-06-25T23:00:00Z', team1: 'Morocco',      team2: 'Haiti',        group: 'C', status: 'SCHEDULED', score: null },
  { id: 55, date: '2026-06-26T01:00:00Z', team1: 'Türkiye',      team2: 'USA',          group: 'D', status: 'SCHEDULED', score: null },
  { id: 56, date: '2026-06-26T01:00:00Z', team1: 'Paraguay',     team2: 'Australia',    group: 'D', status: 'SCHEDULED', score: null },
  // Jun 26
  { id: 57, date: '2026-06-26T23:00:00Z', team1: 'Ivory Coast',  team2: 'Germany',      group: 'E', status: 'SCHEDULED', score: null },
  { id: 58, date: '2026-06-26T23:00:00Z', team1: 'Curaçao',      team2: 'Ecuador',      group: 'E', status: 'SCHEDULED', score: null },
  { id: 59, date: '2026-06-27T01:00:00Z', team1: 'Tunisia',      team2: 'Sweden',       group: 'F', status: 'SCHEDULED', score: null },
  { id: 60, date: '2026-06-27T01:00:00Z', team1: 'Japan',        team2: 'Netherlands',  group: 'F', status: 'SCHEDULED', score: null },
  // Jun 27
  { id: 61, date: '2026-06-27T23:00:00Z', team1: 'Egypt',        team2: 'Belgium',      group: 'G', status: 'SCHEDULED', score: null },
  { id: 62, date: '2026-06-27T23:00:00Z', team1: 'New Zealand',  team2: 'Iran',         group: 'G', status: 'SCHEDULED', score: null },
  { id: 63, date: '2026-06-28T01:00:00Z', team1: 'Cape Verde',   team2: 'Spain',        group: 'H', status: 'SCHEDULED', score: null },
  { id: 64, date: '2026-06-28T01:00:00Z', team1: 'Uruguay',      team2: 'Saudi Arabia', group: 'H', status: 'SCHEDULED', score: null },
  // Jun 28
  { id: 65, date: '2026-06-28T23:00:00Z', team1: 'Iraq',         team2: 'France',       group: 'I', status: 'SCHEDULED', score: null },
  { id: 66, date: '2026-06-28T23:00:00Z', team1: 'Senegal',      team2: 'Norway',       group: 'I', status: 'SCHEDULED', score: null },
  { id: 67, date: '2026-06-29T01:00:00Z', team1: 'Algeria',      team2: 'Austria',      group: 'J', status: 'SCHEDULED', score: null },
  { id: 68, date: '2026-06-29T01:00:00Z', team1: 'Jordan',       team2: 'Argentina',    group: 'J', status: 'SCHEDULED', score: null },
  // Jun 29
  { id: 69, date: '2026-06-29T23:00:00Z', team1: 'DR Congo',     team2: 'Portugal',     group: 'K', status: 'SCHEDULED', score: null },
  { id: 70, date: '2026-06-29T23:00:00Z', team1: 'Colombia',     team2: 'Uzbekistan',   group: 'K', status: 'SCHEDULED', score: null },
  { id: 71, date: '2026-06-30T01:00:00Z', team1: 'Panama',       team2: 'England',      group: 'L', status: 'SCHEDULED', score: null },
  { id: 72, date: '2026-06-30T01:00:00Z', team1: 'Croatia',      team2: 'Ghana',        group: 'L', status: 'SCHEDULED', score: null },
];
