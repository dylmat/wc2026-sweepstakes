import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  PLAYERS,
  PLAYER_TEAMS,
  GROUPS,
  ROUND_POINTS,
  ROUND_OF_32_MATCHES,
  getTeamOwner,
  FLAGS,
  normalizeTeamName,
} from "./data";
import { SCHEDULE } from "./schedule";
import "./App.css";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Replace with your Cloudflare Worker URL (see README for 2-min setup)
// Worker proxies football-data.org and odds-api to fix CORS
const WORKER_BASE = "https://odd-union-1066.dm-dylanmathews.workers.dev"; // e.g. https://wc-proxy.yourname.workers.dev

const MELBOURNE_TZ = "Australia/Melbourne";

// ─── API FETCHING ─────────────────────────────────────────────────────────────
async function workerFetch(path) {
  const res = await fetch(`${WORKER_BASE}/${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `${path} error ${res.status}`);
  return data;
}

async function fetchStandings() {
  return workerFetch("standings");
}

async function fetchMatches() {
  return workerFetch("matches");
}

function useWorldCupData() {
  const [standings, setStandings] = useState({});
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [usingDemoMode, setUsingDemoMode] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [standData, matchData] = await Promise.allSettled([
          fetchStandings(),
          fetchMatches(),
        ]);

        if (standData.status === "fulfilled" && standData.value) {
          setStandings(parseStandings(standData.value));
        }
        if (matchData.status === "fulfilled" && matchData.value) {
          setMatches(parseMatches(matchData.value));
        }
        setLastUpdated(new Date());
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  return {
    standings,
    matches,
    loading,
    error,
    lastUpdated,
    usingDemoMode,
  };
}

// ─── PARSERS ─────────────────────────────────────────────────────────────────
// Team-name normalisation lives in one place: data.js's normalizeTeamName.
// This local alias keeps the rest of this file's code unchanged.
const normalizeTeam = normalizeTeamName;

function parseStandings(data) {
  // football-data.org returns one flat table of 48 teams with group=null
  // We assign teams to groups using our own GROUPS map
  const totalStage = (data.standings || []).find((s) => s.type === "TOTAL");
  if (!totalStage) return {};

  // Build a lookup: normalised team name -> row data
  const byTeam = {};
  (totalStage.table || []).forEach((row) => {
    const name = normalizeTeam(row.team?.name || row.team?.shortName);
    byTeam[name] = {
      team: name,
      mp: row.playedGames,
      w: row.won,
      d: row.draw,
      l: row.lost,
      gf: row.goalsFor,
      ga: row.goalsAgainst,
      pts: row.points,
    };
  });

  // Slot into our per-group structure, sorted by pts/gd/gf
  const result = {};
  Object.entries(GROUPS).forEach(([grp, teams]) => {
    result[grp] = teams
      .map(
        (t) =>
          byTeam[t] || {
            team: t,
            mp: 0,
            w: 0,
            d: 0,
            l: 0,
            gf: 0,
            ga: 0,
            pts: 0,
          },
      )
      .sort(
        (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf,
      );
  });
  return result;
}

function parseMatches(data) {
  return (data.matches || [])
    .filter((m) => m.homeTeam?.name) // skip TBD knockout slots
    .map((m) => {
      const s = m.score;
      // Use regularTime + extraTime for the displayed score so penalty goals
      // don't inflate the scoreline (e.g. 1-1 aet not 4-5). Fall back to
      // fullTime when regularTime is absent (group-stage REGULAR matches).
      const regH = s?.regularTime?.home ?? s?.fullTime?.home ?? 0;
      const regA = s?.regularTime?.away ?? s?.fullTime?.away ?? 0;
      const etH  = s?.extraTime?.home ?? 0;
      const etA  = s?.extraTime?.away ?? 0;
      const isPens = s?.duration === "PENALTY_SHOOTOUT";
      return {
        id: m.id,
        date: m.utcDate,
        team1: normalizeTeam(m.homeTeam?.name),
        team2: normalizeTeam(m.awayTeam?.name),
        score:
          m.status === "FINISHED"
            ? {
                ft: [regH + etH, regA + etA],
                pens: isPens ? [s.penalties?.home ?? 0, s.penalties?.away ?? 0] : null,
                winner: s?.winner ?? null,
                duration: s?.duration ?? null,
              }
            : null,
        status: m.status,
        stage: m.stage,
        group: m.group?.replace("GROUP_", "") || null,
        round: m.stage,
      };
    });
}

// ─── GROUP STANDINGS (from API or fallback) ──────────────────────────────────
function computeGroupStandings(apiStandings, scheduleMatches) {
  if (apiStandings && Object.keys(apiStandings).length > 0) {
    // Fill any missing groups from our known structure
    const result = {};
    Object.entries(GROUPS).forEach(([grp, teams]) => {
      if (apiStandings[grp]?.length > 0) {
        result[grp] = apiStandings[grp];
      } else {
        result[grp] = teams.map((t) => ({
          team: t,
          mp: 0,
          w: 0,
          d: 0,
          l: 0,
          gf: 0,
          ga: 0,
          pts: 0,
        }));
      }
    });
    return result;
  }
  // Compute from embedded schedule
  const standings = {};
  Object.entries(GROUPS).forEach(([grp, teams]) => {
    standings[grp] = {};
    teams.forEach((t) => {
      standings[grp][t] = {
        team: t,
        mp: 0,
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        pts: 0,
      };
    });
  });
  scheduleMatches
    .filter((m) => m.score && m.group)
    .forEach((m) => {
      const [g1, g2] = m.score.ft;
      const t1 = m.team1,
        t2 = m.team2,
        grp = m.group;
      const s1 = standings[grp]?.[t1],
        s2 = standings[grp]?.[t2];
      if (!s1 || !s2) return;
      s1.mp++;
      s2.mp++;
      s1.gf += g1;
      s1.ga += g2;
      s2.gf += g2;
      s2.ga += g1;
      if (g1 > g2) {
        s1.w++;
        s1.pts += 3;
        s2.l++;
      } else if (g2 > g1) {
        s2.w++;
        s2.pts += 3;
        s1.l++;
      } else {
        s1.d++;
        s1.pts++;
        s2.d++;
        s2.pts++;
      }
    });
  Object.keys(standings).forEach((g) => {
    standings[g] = Object.values(standings[g]).sort(
      (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf,
    );
  });
  return standings;
}

// ─── KNOCKOUT BRACKET ────────────────────────────────────────────────────────
// Round of 32 teams are hardcoded in ROUND_OF_32_MATCHES (data.js).
// Progression from R16 onwards is inferred from API match results in order.

// R16 through Final: fixed pairing of "winner of match N vs winner of match M".
const LATER_ROUND_SEEDS = [
  { match: 89, round: "Round of 16", home: { type: "winnerOf", match: 74 }, away: { type: "winnerOf", match: 77 } },
  { match: 90, round: "Round of 16", home: { type: "winnerOf", match: 73 }, away: { type: "winnerOf", match: 75 } },
  { match: 91, round: "Round of 16", home: { type: "winnerOf", match: 76 }, away: { type: "winnerOf", match: 78 } },
  { match: 92, round: "Round of 16", home: { type: "winnerOf", match: 79 }, away: { type: "winnerOf", match: 80 } },
  { match: 93, round: "Round of 16", home: { type: "winnerOf", match: 83 }, away: { type: "winnerOf", match: 84 } },
  { match: 94, round: "Round of 16", home: { type: "winnerOf", match: 81 }, away: { type: "winnerOf", match: 82 } },
  { match: 95, round: "Round of 16", home: { type: "winnerOf", match: 86 }, away: { type: "winnerOf", match: 88 } },
  { match: 96, round: "Round of 16", home: { type: "winnerOf", match: 85 }, away: { type: "winnerOf", match: 87 } },
  { match: 97, round: "Quarter-final", home: { type: "winnerOf", match: 89 }, away: { type: "winnerOf", match: 90 } },
  { match: 98, round: "Quarter-final", home: { type: "winnerOf", match: 93 }, away: { type: "winnerOf", match: 94 } },
  { match: 99, round: "Quarter-final", home: { type: "winnerOf", match: 91 }, away: { type: "winnerOf", match: 92 } },
  { match: 100, round: "Quarter-final", home: { type: "winnerOf", match: 95 }, away: { type: "winnerOf", match: 96 } },
  { match: 101, round: "Semi-final", home: { type: "winnerOf", match: 97 }, away: { type: "winnerOf", match: 98 } },
  { match: 102, round: "Semi-final", home: { type: "winnerOf", match: 99 }, away: { type: "winnerOf", match: 100 } },
  { match: 103, round: "3rd Place", home: { type: "loserOf", match: 101 }, away: { type: "loserOf", match: 102 } },
  { match: 104, round: "Winner", home: { type: "winnerOf", match: 101 }, away: { type: "winnerOf", match: 102 } },
];

function resolveFromBracket(slot, resolvedMatches) {
  if (slot.type === "winnerOf") return resolvedMatches[slot.match]?.winner || null;
  if (slot.type === "loserOf") return resolvedMatches[slot.match]?.loser || null;
  return null;
}

function buildBracket(liveMatches) {
  // Group API knockout matches by round, sorted chronologically so the Nth
  // API match in a round aligns with the Nth bracket slot in that round.
  const byRound = {};
  liveMatches.forEach((m) => {
    const round = stageToRoundLabel(m.stage || m.round);
    if (!round) return;
    if (!byRound[round]) byRound[round] = [];
    byRound[round].push(m);
  });
  Object.values(byRound).forEach((list) => list.sort((a, b) => new Date(a.date) - new Date(b.date)));

  const resolvedMatches = {};
  const bracket = [];

  // ── Round of 32: hardcoded teams are always correct; look up the API match
  //    by team names (not by index) to get scores/status/date only. ──
  const r32Api = byRound["Round of 32"] || [];
  ROUND_OF_32_MATCHES.forEach((seed) => {
    const homeTeam = seed.home !== "TBD" ? seed.home : null;
    const awayTeam = seed.away !== "TBD" ? seed.away : null;
    // Find the corresponding API match regardless of ordering
    const apiMatch = (homeTeam && awayTeam)
      ? r32Api.find(
          (m) =>
            (m.team1 === homeTeam && m.team2 === awayTeam) ||
            (m.team1 === awayTeam && m.team2 === homeTeam),
        )
      : null;
    const result = apiMatch ? resolveMatchResult(apiMatch) : null;

    resolvedMatches[seed.match] = {
      winner: result?.winner || null,
      loser: result?.loser || null,
    };
    bracket.push({
      match: seed.match,
      round: "Round of 32",
      homeTeam,
      awayTeam,
      homeLabel: homeTeam || "TBD",
      awayLabel: awayTeam || "TBD",
      score: apiMatch?.score || null,
      status: apiMatch?.status || (homeTeam && awayTeam ? "SCHEDULED" : "TBD"),
      date: apiMatch?.date || null,
      winner: result?.winner || null,
    });
  });

  // ── R16 onwards: API has actual teams once matches are scheduled; fall back
  //    to projecting winners from already-resolved earlier rounds. ──
  //    Find the corresponding API match by team names (same as R32) — never
  //    let API team names override bracket-derived teams, which avoids the
  //    index-mismatch bug where a team ends up in two different bracket slots.
  const laterApiByRound = {
    "Round of 16": byRound["Round of 16"] || [],
    "Quarter-final": byRound["Quarter-final"] || [],
    "Semi-final": byRound["Semi-final"] || [],
    "3rd Place": byRound["3rd Place"] || [],
    Winner: byRound["Winner"] || [],
  };

  LATER_ROUND_SEEDS.forEach((seed) => {
    const projHome = resolveFromBracket(seed.home, resolvedMatches);
    const projAway = resolveFromBracket(seed.away, resolvedMatches);

    const apiMatch = (projHome && projAway)
      ? laterApiByRound[seed.round].find(
          (m) =>
            (m.team1 === projHome && m.team2 === projAway) ||
            (m.team1 === projAway && m.team2 === projHome),
        )
      : null;

    const result = apiMatch ? resolveMatchResult(apiMatch) : null;

    resolvedMatches[seed.match] = {
      winner: result?.winner || null,
      loser: result?.loser || null,
    };
    const homeLabel = projHome || (seed.home.type === "winnerOf" ? `W M${seed.home.match}` : `L M${seed.home.match}`);
    const awayLabel = projAway || (seed.away.type === "winnerOf" ? `W M${seed.away.match}` : `L M${seed.away.match}`);
    bracket.push({
      match: seed.match,
      round: seed.round,
      homeTeam: projHome,
      awayTeam: projAway,
      homeLabel,
      awayLabel,
      score: apiMatch?.score || null,
      status: apiMatch?.status || (projHome && projAway ? "SCHEDULED" : "TBD"),
      date: apiMatch?.date || null,
      winner: result?.winner || null,
    });
  });

  return bracket;
}

// Used elsewhere to identify which matches count as "knockout" matches at
// all (as opposed to group stage), independent of the bracket-seed logic
// above, e.g. when computing simple per-team "rounds reached" sets.
const KNOCKOUT_STAGE_ORDER = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

const STAGE_TO_ROUND_LABEL = {
  LAST_32: "Round of 32",
  ROUND_OF_32: "Round of 32",
  LAST_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  QUARTER_FINALS: "Quarter-final",
  SEMI_FINALS: "Semi-final",
  THIRD_PLACE: "3rd Place",
  FINAL: "Winner",
};

function stageToRoundLabel(stage) {
  const s = (stage || "").toUpperCase();
  // Exact match first (avoids "FINAL" substring wrongly matching
  // "SEMI_FINALS" or "QUARTER_FINALS", which was the bug previously).
  if (STAGE_TO_ROUND_LABEL[s]) return STAGE_TO_ROUND_LABEL[s];
  // Fallback substring match for any stage-name variant we haven't seen.
  if (s.includes("32")) return "Round of 32";
  if (s.includes("16")) return "Round of 16";
  if (s.includes("QUARTER")) return "Quarter-final";
  if (s.includes("SEMI")) return "Semi-final";
  if (s.includes("THIRD") || s.includes("3RD")) return "3rd Place";
  if (s.includes("FINAL")) return "Winner";
  return null;
}

// Resolve the winner/loser of a single finished knockout match.
// Uses the API's `score.winner` field first (authoritative — correctly
// reflects extra-time and penalty results); falls back to comparing the
// fulltime score only if `winner` wasn't supplied at all.
function resolveMatchResult(m) {
  if (!m.score) return null;
  if (m.score.winner === "HOME_TEAM") return { winner: m.team1, loser: m.team2 };
  if (m.score.winner === "AWAY_TEAM") return { winner: m.team2, loser: m.team1 };
  if (m.score.winner === "DRAW") return null; // group stage only; no knockout draws
  // Fallback for any response shape that omitted `winner`.
  const [g1, g2] = m.score.ft || [];
  if (g1 > g2) return { winner: m.team1, loser: m.team2 };
  if (g2 > g1) return { winner: m.team2, loser: m.team1 };
  return null; // genuinely undecided (e.g. fulltime draw, no winner field — data incomplete)
}

// Build a map of team -> Set of rounds reached, by walking the resolved
// bracket (built by buildBracket, in fixed match-number order 73→104).
//
// Scoring semantics: appearing in a bracket match earns points for *reaching*
// that round — both the winner and loser of a Round of 32 match earn the R32
// points (+2) just for qualifying from the group stage, including the best-8
// third-place teams. The winner then also plays in the next round and earns
// those points in addition. The Final and 3rd Place match are special-cased:
// only the actual winner gets the top credit, and the Final loser earns
// "Runner-up" instead of "Winner".
function computeKnockoutResults(bracket) {
  const reached = {};
  const credit = (team, round) => {
    if (!team || !round) return;
    if (!reached[team]) reached[team] = new Set();
    reached[team].add(round);
  };

  bracket
    .slice()
    .sort((a, b) => a.match - b.match)
    .forEach((m) => {
      if (m.round === "Winner") {
        if (m.winner) {
          credit(m.winner, "Winner");
          const loser = m.homeTeam === m.winner ? m.awayTeam : m.homeTeam;
          credit(loser, "Runner-up");
        }
        return;
      }
      if (m.round === "3rd Place") {
        if (m.winner) credit(m.winner, "3rd Place");
        return;
      }
      // Both teams reached this round — credit regardless of outcome
      credit(m.homeTeam, m.round);
      credit(m.awayTeam, m.round);
    });

  return reached;
}

// Returns a sorted array of { id, name, color, total, breakdown } — one entry
// per player, ranked highest-to-lowest. breakdown maps team name → pts earned.
function computeSweepstakesPoints(knockoutResults) {
  return PLAYERS.map((p) => {
    const breakdown = {};
    let total = 0;
    PLAYER_TEAMS[p.id].forEach((team) => {
      const rounds = knockoutResults[team];
      if (!rounds) return;
      const pts = [...rounds].reduce((s, r) => s + (ROUND_POINTS[r] || 0), 0);
      if (pts > 0) {
        breakdown[team] = pts;
        total += pts;
      }
    });
    return { ...p, total, breakdown };
  }).sort((a, b) => b.total - a.total);
}

// ─── TIME HELPERS ────────────────────────────────────────────────────────────
function toMelbourne(isoDate) {
  const d = new Date(isoDate);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function toMelbourneDateOnly(isoDate) {
  const d = new Date(isoDate);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function toMelbourneTimeOnly(isoDate) {
  const d = new Date(isoDate);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function getMelbourneDay(isoDate) {
  const d = new Date(isoDate);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isToday(isoDate) {
  return getMelbourneDay(isoDate) === getMelbourneDay(new Date().toISOString());
}

function isTomorrow(isoDate) {
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  return getMelbourneDay(isoDate) === getMelbourneDay(tom.toISOString());
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function PlayerBadge({ playerId }) {
  const player = PLAYERS.find((p) => p.id === playerId);
  if (!player) return null;
  return (
    <span
      className="player-badge"
      style={{
        background: player.color + "22",
        border: `1.5px solid ${player.color}`,
        color: player.color,
      }}
    >
      {player.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function TeamCell({ team, showFlag = true }) {
  const owner = getTeamOwner(team);
  return (
    <span className="team-cell">
      {showFlag && <span className="team-flag">{FLAGS[team] || "🏳️"}</span>}
      <span className="team-name">{team}</span>
      {owner && <PlayerBadge playerId={owner} />}
    </span>
  );
}

// ─── MATCH CARDS (upcoming / live / recent) ──────────────────────────────────
function MatchCard({ match }) {
  const { team1, team2, date, status, score, group, round } = match;
  const owner1 = getTeamOwner(team1);
  const owner2 = getTeamOwner(team2);
  const p1 = PLAYERS.find((p) => p.id === owner1);
  const p2 = PLAYERS.find((p) => p.id === owner2);

  const isLive = status === "IN_PLAY" || status === "PAUSED";
  const isFinished = status === "FINISHED";

  const timeLabel = isToday(date)
    ? `Today ${toMelbourneTimeOnly(date)}`
    : isTomorrow(date)
      ? `Tomorrow ${toMelbourneTimeOnly(date)}`
      : toMelbourne(date);

  const stageLabel = group
    ? `Group ${group}`
    : round?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "";

  return (
    <div
      className={`match-card ${isLive ? "live" : ""} ${isFinished ? "finished" : ""}`}
    >
      <div className="mc-header">
        <span className="mc-stage">{stageLabel}</span>
        {isLive && <span className="mc-live-badge">● LIVE</span>}
        {!isLive && <span className="mc-time">{timeLabel} AEDT</span>}
      </div>

      <div className="mc-teams">
        {/* Team 1 */}
        <div
          className="mc-team"
          style={{ borderBottom: p1 ? `2px solid ${p1.color}` : "none" }}
        >
          <span className="mc-flag">{FLAGS[team1] || "🏳️"}</span>
          <span className="mc-tname">{team1}</span>
          {p1 && <PlayerBadge playerId={owner1} />}
        </div>

        {/* Score or VS */}
        <div className="mc-score-wrap">
          {isFinished || isLive ? (
            <div className="mc-score">
              <span className={score?.winner === "HOME_TEAM" || (!score?.winner && score?.ft[0] > score?.ft[1]) ? "mc-winner" : ""}>
                {score?.ft[0] ?? "–"}{score?.pens ? ` (${score.pens[0]})` : ""}
              </span>
              <span className="mc-sep">:</span>
              <span className={score?.winner === "AWAY_TEAM" || (!score?.winner && score?.ft[1] > score?.ft[0]) ? "mc-winner" : ""}>
                {score?.ft[1] ?? "–"}{score?.pens ? ` (${score.pens[1]})` : ""}
              </span>
            </div>
          ) : (
            <span className="mc-vs">VS</span>
          )}
        </div>

        {/* Team 2 */}
        <div
          className="mc-team mc-team-right"
          style={{ borderBottom: p2 ? `2px solid ${p2.color}` : "none" }}
        >
          {p2 && <PlayerBadge playerId={owner2} />}
          <span className="mc-tname">{team2}</span>
          <span className="mc-flag">{FLAGS[team2] || "🏳️"}</span>
        </div>
      </div>

    </div>
  );
}

function UpcomingSection({ usingDemoMode, liveMatches }) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 48 * 3600 * 1000);

  // Use live API matches if available, otherwise fall back to embedded schedule
  const source = liveMatches?.length > 0 ? liveMatches : SCHEDULE;

  const relevant = source
    .filter((m) => new Date(m.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 40);

  // Group by Melbourne date
  const byDay = {};
  relevant.forEach((m) => {
    const day = getMelbourneDay(m.date);
    if (!byDay[day])
      byDay[day] = { label: toMelbourneDateOnly(m.date), matches: [] };
    byDay[day].matches.push(m);
  });

  const days = Object.values(byDay).slice(0, 7);

  return (
    <section className="section">
      <div className="section-header-row">
        <h2 className="section-title bebas">Schedule</h2>
        <span className="tz-label">All times AEDT (Melbourne)</span>
      </div>
      {usingDemoMode && (
        <div className="demo-banner">
          📋 <strong>Schedule mode</strong> — Deploy the proxy Worker to enable
          live scores &amp; odds (see README).
        </div>
      )}
      {days.map(({ label, matches }) => (
        <div key={label} className="day-group">
          <div className="day-label">
            {isToday(matches[0].date)
              ? "📍 Today"
              : isTomorrow(matches[0].date)
                ? "⏭ Tomorrow"
                : `📅 ${label}`}
          </div>
          <div className="match-cards-row">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function GroupsSection({ standings }) {
  // Rank all 3rd-place teams across groups to show which are currently
  // "in the mix" for the best-8-of-12 qualification spots. This is
  // display-only — the actual Round of 32 lineup comes from the live API
  // once FIFA locks the bracket in; this just helps a person reading the
  // group tables see who's provisionally through as things stand.
  const thirdPlaceTeams = Object.values(standings)
    .map((teams) => teams[2])
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.pts - a.pts ||
        (b.gf || 0) - (b.ga || 0) - ((a.gf || 0) - (a.ga || 0)) ||
        (b.gf || 0) - (a.gf || 0),
    );
  const top8ThirdPlaceTeams = new Set(
    thirdPlaceTeams.slice(0, 8).map((t) => t.team),
  );

  return (
    <section className="section">
      <h2 className="section-title bebas">Group Stage</h2>
      <div className="groups-grid">
        {Object.entries(standings).map(([grp, teams]) => (
          <div key={grp} className="group-card">
            <div className="group-header bebas">Group {grp}</div>
            <div className="group-table-wrap">
              <table className="group-table">
                <thead>
                  <tr>
                    <th className="th-pos">#</th>
                    <th className="th-team">Team</th>
                    <th>MP</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GD</th>
                    <th className="th-pts">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const owner = getTeamOwner(t.team);
                    const player = PLAYERS.find((p) => p.id === owner);
                    const gd = (t.gf || 0) - (t.ga || 0);
                    const isQualifyingThird =
                      i === 2 && top8ThirdPlaceTeams.has(t.team);
                    return (
                      <tr
                        key={t.team}
                        className={`group-row ${i < 2 ? "advancing" : ""} ${isQualifyingThird ? "qualifying-third" : ""}`}
                        style={
                          player
                            ? { borderLeft: `3px solid ${player.color}` }
                            : {}
                        }
                      >
                        <td className="td-pos">{i + 1}</td>
                        <td className="td-team">
                          <TeamCell team={t.team} />
                        </td>
                        <td>{t.mp}</td>
                        <td>{t.w}</td>
                        <td>{t.d}</td>
                        <td>{t.l}</td>
                        <td className={gd > 0 ? "pos" : gd < 0 ? "neg" : ""}>
                          {gd > 0 ? "+" : ""}
                          {gd}
                        </td>
                        <td className="td-pts">{t.pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <div className="legend-row">
        <span className="legend-adv">■ Top 2 per group advance</span>
        {" · "}
        <span className="legend-third">
          ■ Currently in best-8 third-place spots
        </span>
      </div>
    </section>
  );
}

function BracketMatchCard({ m }) {
  const homeOwner = m.homeTeam ? getTeamOwner(m.homeTeam) : null;
  const awayOwner = m.awayTeam ? getTeamOwner(m.awayTeam) : null;
  const homePlayer = PLAYERS.find((p) => p.id === homeOwner);
  const awayPlayer = PLAYERS.find((p) => p.id === awayOwner);

  const isFinished = m.status === "FINISHED";
  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
  const showScore = isFinished || isLive;
  const homeScore = showScore ? m.score?.ft?.[0] : null;
  const awayScore = showScore ? m.score?.ft?.[1] : null;
  const pens = m.score?.pens ?? null; // [homePens, awayPens] or null
  const homeWon = m.winner && m.homeTeam === m.winner;
  const awayWon = m.winner && m.awayTeam === m.winner;

  return (
    <div className={`bracket-card ${isLive ? "bracket-live" : ""}`}>
      <div
        className={`bracket-team ${homeWon ? "bracket-winner" : ""}`}
        style={homePlayer ? { borderLeftColor: homePlayer.color } : {}}
      >
        <span className="bracket-flag">{m.homeTeam ? FLAGS[m.homeTeam] || "🏳️" : ""}</span>
        <span className="bracket-tname">{m.homeLabel}</span>
        {homePlayer && <PlayerBadge playerId={homeOwner} />}
        {homeScore !== null && (
          <span className="bracket-score">
            {homeScore}{pens ? ` (${pens[0]})` : ""}
          </span>
        )}
      </div>
      <div
        className={`bracket-team ${awayWon ? "bracket-winner" : ""}`}
        style={awayPlayer ? { borderLeftColor: awayPlayer.color } : {}}
      >
        <span className="bracket-flag">{m.awayTeam ? FLAGS[m.awayTeam] || "🏳️" : ""}</span>
        <span className="bracket-tname">{m.awayLabel}</span>
        {awayPlayer && <PlayerBadge playerId={awayOwner} />}
        {awayScore !== null && (
          <span className="bracket-score">
            {awayScore}{pens ? ` (${pens[1]})` : ""}
          </span>
        )}
      </div>
      {isLive && <span className="bracket-live-tag">● LIVE</span>}
    </div>
  );
}

// Derive the correct R32 display order from the R16 pairings in LATER_ROUND_SEEDS:
// for each R16 match (in match-number order), its two R32 feeders appear adjacent.
// This means M74 and M77 (which meet in R16) are shown next to each other, not
// M73 and M74 (which are just numerically adjacent but in different R16 slots).
const R32_DISPLAY_ORDER = (() => {
  const order = {};
  LATER_ROUND_SEEDS
    .filter((s) => s.round === "Round of 16")
    .sort((a, b) => a.match - b.match)
    .flatMap((s) => [s.home.match, s.away.match])
    .forEach((matchNum, i) => { order[matchNum] = i; });
  return order;
})();

function BracketVisual({ bracket }) {
  const roundOrder = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Winner"];
  const byRound = {};
  bracket.forEach((m) => {
    // Group the 3rd-place playoff alongside the Final visually.
    const key = m.round === "3rd Place" ? "Winner" : m.round;
    if (!byRound[key]) byRound[key] = [];
    byRound[key].push(m);
  });
  // R32: sort by bracket tree position so paired matches are adjacent.
  // All other rounds: sort by match number (which is already chronological).
  if (byRound["Round of 32"]) {
    byRound["Round of 32"].sort(
      (a, b) => (R32_DISPLAY_ORDER[a.match] ?? a.match) - (R32_DISPLAY_ORDER[b.match] ?? b.match),
    );
  }
  ["Round of 16", "Quarter-final", "Semi-final", "Winner"].forEach((r) => {
    byRound[r]?.sort((a, b) => a.match - b.match);
  });

  return (
    <div className="bracket-wrap">
      {roundOrder.map((round) => (
        <div key={round} className="bracket-col">
          <div className="bracket-col-title">{round === "Winner" ? "Final" : round}</div>
          <div className="bracket-matches">
            {(byRound[round] || []).map((m) => (
              <BracketMatchCard key={m.match} m={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function KnockoutSection({ knockoutResults, bracket }) {
  const rounds = [
    "Round of 32",
    "Round of 16",
    "Quarter-final",
    "Semi-final",
    "Runner-up",
    "Winner",
  ];
  const allTeams = Object.values(PLAYER_TEAMS).flat();
  const teamProgress = allTeams
    .map((team) => {
      const reached = knockoutResults[team] || new Set();
      const pts = [...reached].reduce((s, r) => s + (ROUND_POINTS[r] || 0), 0);
      return { team, reached, pts };
    })
    .filter((t) => t.reached.size > 0)
    .sort((a, b) => b.pts - a.pts);

  return (
    <section className="section">
      <h2 className="section-title bebas">Knockout Bracket</h2>
      <BracketVisual bracket={bracket} />

      <h2 className="section-title bebas" style={{ marginTop: 28 }}>
        Sweepstakes Points
      </h2>
      <div className="knockout-points-legend">
        {Object.entries(ROUND_POINTS).map(([round, pts]) => (
          <div key={round} className="kp-pill">
            <span className="kp-round">{round}</span>
            <span className="kp-pts">+{pts}pts</span>
          </div>
        ))}
      </div>
      {teamProgress.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⚽</div>
          <p>No sweepstakes points yet — check back once Round of 32 results are in!</p>
        </div>
      ) : (
        <div className="knockout-progress">
          <div className="kp-header">
            <span>Team</span>
            {rounds.map((r) => (
              <span key={r} className="kp-col">
                {r}
              </span>
            ))}
            <span className="kp-col kp-total">Pts</span>
          </div>
          {teamProgress.map(({ team, reached, pts }) => {
            const owner = getTeamOwner(team);
            const player = PLAYERS.find((p) => p.id === owner);
            return (
              <div
                key={team}
                className="kp-row"
                style={
                  player ? { borderLeft: `3px solid ${player.color}` } : {}
                }
              >
                <span className="kp-team">
                  <TeamCell team={team} />
                </span>
                {rounds.map((r) => (
                  <span
                    key={r}
                    className={`kp-cell ${reached.has(r) ? "kp-reached" : ""}`}
                    style={reached.has(r) ? { color: player?.color } : {}}
                  >
                    {reached.has(r) ? `+${ROUND_POINTS[r]}` : "—"}
                  </span>
                ))}
                <span className="kp-cell kp-total kp-pts-val">{pts}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const player = PLAYERS.find((p) => p.id === d.id);
  return (
    <div className="chart-tooltip" style={{ borderColor: player?.color }}>
      <div className="ct-name" style={{ color: player?.color }}>
        {d.name}
      </div>
      <div className="ct-pts">{d.total} pts</div>
      <div className="ct-breakdown">
        {Object.entries(d.breakdown)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([team, pts]) => (
            <div key={team} className="ct-row">
              <span>
                {FLAGS[team]} {team}
              </span>
              <span>+{pts}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function LeaderboardChart({ playerPoints }) {
  const data = playerPoints; // sorted array from computeSweepstakesPoints
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <aside className="leaderboard">
      <h2 className="section-title bebas lb-title">Leaderboard</h2>
      <div className="lb-subtitle">Sweepstakes Points</div>
      <div className="lb-ranks">
        {data.map((d, i) => (
          <div key={d.id} className="lb-rank-row">
            <span
              className="lb-rank-num"
              style={{ color: i === 0 ? "#f5c518" : "var(--text-secondary)" }}
            >
              {i === 0 ? "🏆" : `#${i + 1}`}
            </span>
            <span className="lb-rank-name" style={{ color: d.color }}>
              {d.name}
            </span>
            <div className="lb-bar-wrap">
              <div
                className="lb-bar"
                style={{
                  width: `${(d.total / max) * 100}%`,
                  background: d.color,
                }}
              />
            </div>
            <span className="lb-rank-pts">{d.total}</span>
          </div>
        ))}
      </div>
      <div className="lb-chart-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            barSize={28}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: "#8892a4", fontSize: 11, fontFamily: "Inter" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#4a5568", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.id} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="lb-teams">
        <div className="lb-teams-title">Your Teams</div>
        {PLAYERS.map((p) => (
          <div key={p.id} className="lb-player-teams">
            <span className="lb-pt-name" style={{ color: p.color }}>
              {p.name}
            </span>
            <div className="lb-pt-list">
              {PLAYER_TEAMS[p.id].map((t) => (
                <span key={t} className="lb-pt-team">
                  {FLAGS[t]} {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    standings: apiStandings,
    matches,
    loading,
    error,
    lastUpdated,
    usingDemoMode,
  } = useWorldCupData();
  const [activeTab, setActiveTab] = useState("schedule");

  const groupStandings = useMemo(
    () => computeGroupStandings(apiStandings, SCHEDULE),
    [apiStandings],
  );
  const bracket = useMemo(
    () => buildBracket(matches),
    [matches],
  );
  const knockoutResults = useMemo(
    () => computeKnockoutResults(bracket),
    [bracket],
  );
  const playerPoints = useMemo(
    () => computeSweepstakesPoints(knockoutResults),
    [knockoutResults],
  );

  const isLive = matches.some(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED",
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="header-icon">⚽</span>
            <div>
              <div className="header-title bebas">WC 2026 Sweepstakes</div>
              <div className="header-sub">USA · Canada · Mexico</div>
            </div>
          </div>
          <div className="header-meta">
            {loading && <span className="status-pill loading">Updating…</span>}
            {isLive && !loading && (
              <span className="status-pill live">● LIVE</span>
            )}
            {error && <span className="status-pill err">⚠ {error}</span>}
            {usingDemoMode && matches.length === 0 && (
              <span className="status-pill demo">
                📋 Add API key for live scores
              </span>
            )}
            {lastUpdated && !loading && !isLive && (
              <span className="status-time">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div className="player-legend">
          {PLAYERS.map((p) => (
            <div key={p.id} className="pl-item">
              <span className="pl-dot" style={{ background: p.color }} />
              <span className="pl-name" style={{ color: p.color }}>
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </header>

      <nav className="tab-nav">
        {["schedule", "groups", "knockout"].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "schedule"
              ? "Schedule"
              : tab === "groups"
                ? "Groups"
                : "Knockout"}
          </button>
        ))}
      </nav>

      <div className="body">
        <main className="main-content">
          {activeTab === "schedule" && (
            <UpcomingSection
              usingDemoMode={usingDemoMode}
              liveMatches={matches}
            />
          )}
          {activeTab === "groups" && (
            <GroupsSection standings={groupStandings} />
          )}
          {activeTab === "knockout" && (
            <KnockoutSection knockoutResults={knockoutResults} bracket={bracket} />
          )}
        </main>
        <LeaderboardChart playerPoints={playerPoints} />
      </div>

      <footer className="footer">
        Scores:{" "}
        <a
          href="https://www.football-data.org"
          target="_blank"
          rel="noreferrer"
        >
          football-data.org
        </a>
        · Odds:{" "}
        <a href="https://the-odds-api.com" target="_blank" rel="noreferrer">
          The Odds API
        </a>
        · Refreshes on load
      </footer>
    </div>
  );
}
