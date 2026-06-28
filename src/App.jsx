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

async function fetchOdds() {
  return null;
}

function useWorldCupData() {
  const [standings, setStandings] = useState({});
  const [matches, setMatches] = useState([]);
  const [odds, setOdds] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [usingDemoMode, setUsingDemoMode] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [standData, matchData, oddsData] = await Promise.allSettled([
          fetchStandings(),
          fetchMatches(),
          fetchOdds(),
        ]);

        if (standData.status === "fulfilled" && standData.value) {
          setStandings(parseStandings(standData.value));
        }
        if (matchData.status === "fulfilled" && matchData.value) {
          setMatches(parseMatches(matchData.value));
        }
        if (oddsData.status === "fulfilled" && oddsData.value) {
          setOdds(parseOdds(oddsData.value));
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
    odds,
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
    .map((m) => ({
      id: m.id,
      date: m.utcDate,
      team1: normalizeTeam(m.homeTeam?.name),
      team2: normalizeTeam(m.awayTeam?.name),
      score:
        m.status === "FINISHED"
          ? {
              ft: [m.score?.fullTime?.home ?? 0, m.score?.fullTime?.away ?? 0],
              // 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' (DRAW only valid in
              // group-stage matches; knockout ties always have a winner
              // once finished, decided by extra time or penalties)
              winner: m.score?.winner ?? null,
              // 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
              duration: m.score?.duration ?? null,
            }
          : null,
      // API uses: TIMED, SCHEDULED, IN_PLAY, PAUSED, FINISHED, SUSPENDED, CANCELLED
      status: m.status,
      stage: m.stage,
      group: m.group?.replace("GROUP_", "") || null,
      round: m.stage,
    }));
}

function parseOdds(data) {
  const map = {};
  (data || []).forEach((game) => {
    const key = `${normalizeTeam(game.home_team)}|${normalizeTeam(game.away_team)}`;
    const bookie = game.bookmakers?.[0];
    const h2h = bookie?.markets?.find((m) => m.key === "h2h");
    if (!h2h) return;
    const outcomes = {};
    h2h.outcomes?.forEach((o) => {
      outcomes[normalizeTeam(o.name)] = o.price;
    });
    map[key] = {
      home: outcomes[normalizeTeam(game.home_team)],
      draw: outcomes["Draw"],
      away: outcomes[normalizeTeam(game.away_team)],
    };
  });
  return map;
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
// Rather than inferring "how far did team X get" purely by pattern-matching
// each match's stage string in isolation, we build the bracket as a real
// tree: every knockout match has a known round, and we resolve winners by
// walking matches in calendar order so later rounds can depend on earlier
// results. This also lets us use the API's authoritative `score.winner`
// field (HOME_TEAM / AWAY_TEAM) instead of comparing fulltime goals, which
// is wrong whenever a match is decided by extra time or penalties (e.g. a
// 1-1 draw after 90 minutes, won on penalties — fulltime score alone can't
// tell us who actually advanced).
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

// Build a map of team -> Set of rounds reached, by walking all knockout
// matches in bracket order (Round of 32 first, then Round of 16, etc).
// Walking in order means a team that's confirmed to have won its Round of
// 32 tie is credited with "Round of 32" even before its Round of 16 match
// has been played, and every later round it wins adds on top of that —
// so a single deep run accumulates the correct cumulative point total.
function computeKnockoutResults(matches) {
  const reached = {};
  const credit = (team, round) => {
    if (!team || !round) return;
    if (!reached[team]) reached[team] = new Set();
    reached[team].add(round);
  };

  const knockoutMatches = matches.filter((m) => {
    const stage = (m.stage || m.round || "").toUpperCase();
    return KNOCKOUT_STAGE_ORDER.some((s) => stage === s || stage.includes(s));
  });

  // Sort by FIFA's fixed stage order first, then kickoff time — this
  // guarantees we always resolve a Round of 32 result before trying to
  // use it as input to a Round of 16 calculation, regardless of what
  // order the API happened to return matches in.
  const stageRank = (m) => {
    const s = (m.stage || m.round || "").toUpperCase();
    const idx = KNOCKOUT_STAGE_ORDER.findIndex((k) => s === k || s.includes(k));
    return idx === -1 ? 999 : idx;
  };
  knockoutMatches.sort(
    (a, b) => stageRank(a) - stageRank(b) || new Date(a.date) - new Date(b.date),
  );

  knockoutMatches.forEach((m) => {
    if (!m.score) return; // not played yet
    const result = resolveMatchResult(m);
    if (!result) return; // undecided / incomplete data

    const round = stageToRoundLabel(m.stage || m.round);
    if (!round) return;

    // The team that wins this match is credited with having reached
    // (i.e. won) this round.
    credit(result.winner, round);

    // The Final is special: its loser is credited as Runner-up, and its
    // winner is credited as Winner (on top of every earlier round they
    // already won on the way here).
    if (round === "Winner") {
      credit(result.loser, "Runner-up");
    }
  });

  return reached;
}

function computeSweepstakesPoints(knockoutResults) {
  const pp = {};
  PLAYERS.forEach((p) => {
    pp[p.id] = { total: 0, breakdown: {} };
  });
  Object.entries(PLAYER_TEAMS).forEach(([pid, teams]) => {
    teams.forEach((team) => {
      const rounds = knockoutResults[team];
      if (!rounds) return;
      let pts = 0;
      rounds.forEach((r) => {
        pts += ROUND_POINTS[r] || 0;
      });
      pp[pid].breakdown[team] = pts;
      pp[pid].total += pts;
    });
  });
  return pp;
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
function MatchCard({ match, oddsMap }) {
  const { team1, team2, date, status, score, group, round } = match;
  const owner1 = getTeamOwner(team1);
  const owner2 = getTeamOwner(team2);
  const p1 = PLAYERS.find((p) => p.id === owner1);
  const p2 = PLAYERS.find((p) => p.id === owner2);

  const isLive = status === "IN_PLAY" || status === "PAUSED";
  const isFinished = status === "FINISHED";
  const isScheduled =
    status === "TIMED" || status === "SCHEDULED" || (!isLive && !isFinished);

  const oddsKey = `${team1}|${team2}`;
  const matchOdds = oddsMap[oddsKey];

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
              <span className={score?.ft[0] > score?.ft[1] ? "mc-winner" : ""}>
                {score?.ft[0] ?? "–"}
              </span>
              <span className="mc-sep">:</span>
              <span className={score?.ft[1] > score?.ft[0] ? "mc-winner" : ""}>
                {score?.ft[1] ?? "–"}
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

      {/* Odds */}
      {matchOdds && isScheduled && (
        <div className="mc-odds">
          <div
            className="mc-odd"
            style={{ color: p1?.color || "var(--text-secondary)" }}
          >
            <span className="mc-odd-label">1</span>
            <span className="mc-odd-val">{matchOdds.home?.toFixed(2)}</span>
          </div>
          <div className="mc-odd">
            <span className="mc-odd-label">X</span>
            <span className="mc-odd-val">{matchOdds.draw?.toFixed(2)}</span>
          </div>
          <div
            className="mc-odd"
            style={{ color: p2?.color || "var(--text-secondary)" }}
          >
            <span className="mc-odd-label">2</span>
            <span className="mc-odd-val">{matchOdds.away?.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function UpcomingSection({ odds, usingDemoMode, liveMatches }) {
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
              <MatchCard key={m.id} match={m} oddsMap={odds} />
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

function KnockoutSection({ knockoutResults }) {
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
      <h2 className="section-title bebas">
        Knockout Stage — Sweepstakes Points
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
          <p>Knockout stage begins June 28. Check back then!</p>
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
  const data = PLAYERS.map((p) => ({
    ...p,
    total: playerPoints[p.id]?.total || 0,
    breakdown: playerPoints[p.id]?.breakdown || {},
  })).sort((a, b) => b.total - a.total);
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
    odds,
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
  const knockoutResults = useMemo(
    () => computeKnockoutResults(matches),
    [matches],
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
              odds={odds}
              usingDemoMode={usingDemoMode}
              liveMatches={matches}
            />
          )}
          {activeTab === "groups" && (
            <GroupsSection standings={groupStandings} />
          )}
          {activeTab === "knockout" && (
            <KnockoutSection knockoutResults={knockoutResults} />
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
