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
} from "./data";
import { SCHEDULE } from "./schedule";
import "./App.css";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Replace with your Cloudflare Worker URL (see README for 2-min setup)
// Worker proxies football-data.org and odds-api to fix CORS
const WORKER_BASE = "https://odd-union-1066.dm-dylanmathews.workers.dev"; // e.g. https://wc-proxy.yourname.workers.dev

const MELBOURNE_TZ = "Australia/Melbourne";

// ─── API FETCHING ─────────────────────────────────────────────────────────────
async function fetchStandings() {
  if (WORKER_BASE === "YOUR_WORKER_URL") return null;
  const res = await fetch(`${WORKER_BASE}/standings`);
  if (!res.ok) throw new Error(`Standings ${res.status}`);
  return res.json();
}

async function fetchMatches() {
  if (WORKER_BASE === "YOUR_WORKER_URL") return null;
  const res = await fetch(`${WORKER_BASE}/matches`);
  if (!res.ok) throw new Error(`Matches ${res.status}`);
  return res.json();
}

async function fetchOdds() {
  if (WORKER_BASE === "YOUR_WORKER_URL") return null;
  const res = await fetch(`${WORKER_BASE}/odds`);
  if (!res.ok) return null;
  return res.json();
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
        if (FD_KEY === "983f65dff5bd497390516b7f3ae876b2") {
          setUsingDemoMode(true);
          setLoading(false);
          return;
        }
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
function normalizeTeam(name) {
  if (!name) return "";
  const map = {
    "United States": "USA",
    "Bosnia and Herzegovina": "Bosnia & Herz.",
    "Bosnia & Herzegovina": "Bosnia & Herz.",
    "Korea Republic": "South Korea",
    "Côte d'Ivoire": "Ivory Coast",
    "Czech Republic": "Czechia",
    Turkey: "Türkiye",
    "Congo, DR": "DR Congo",
    "DR Congo": "DR Congo",
  };
  return map[name] || name;
}

function parseStandings(data) {
  const result = {};
  (data.standings || []).forEach((stage) => {
    if (stage.type !== "TOTAL") return;
    stage.table?.forEach((row) => {
      const grp = stage.group?.replace("GROUP_", "") || "A";
      if (!result[grp]) result[grp] = [];
      result[grp].push({
        team: normalizeTeam(row.team?.name),
        mp: row.playedGames,
        w: row.won,
        d: row.draw,
        l: row.lost,
        gf: row.goalsFor,
        ga: row.goalsAgainst,
        pts: row.points,
      });
    });
  });
  return result;
}

function parseMatches(data) {
  return (data.matches || []).map((m) => ({
    id: m.id,
    date: m.utcDate,
    team1: normalizeTeam(m.homeTeam?.name),
    team2: normalizeTeam(m.awayTeam?.name),
    score:
      m.status === "FINISHED"
        ? { ft: [m.score?.fullTime?.home ?? 0, m.score?.fullTime?.away ?? 0] }
        : null,
    status: m.status, // SCHEDULED, LIVE, IN_PLAY, FINISHED
    stage: m.stage,
    group: m.group?.replace("GROUP_", ""),
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

function computeKnockoutResults(matches) {
  const reached = {};
  matches
    .filter((m) => m.score)
    .forEach((m) => {
      const stage = (m.stage || m.round || "").toUpperCase();
      const isKnockout = [
        "ROUND_OF_32",
        "LAST_32",
        "ROUND_OF_16",
        "LAST_16",
        "QUARTER",
        "SEMI",
        "FINAL",
      ].some((k) => stage.includes(k));
      if (!isKnockout) return;
      const [g1, g2] = m.score.ft;
      let winner = null,
        loser = null;
      if (g1 > g2) {
        winner = m.team1;
        loser = m.team2;
      } else if (g2 > g1) {
        winner = m.team2;
        loser = m.team1;
      }
      if (!winner) return;
      let rk = "Round of 32";
      if (stage.includes("16") || stage.includes("LAST_16")) rk = "Round of 16";
      else if (stage.includes("QUARTER")) rk = "Quarter-final";
      else if (stage.includes("SEMI")) rk = "Semi-final";
      else if (stage.includes("THIRD") || stage.includes("3RD"))
        rk = "3rd Place";
      else if (stage.includes("FINAL")) rk = "Winner";
      if (!reached[winner]) reached[winner] = new Set();
      reached[winner].add(rk);
      if (rk === "Winner") {
        if (!reached[loser]) reached[loser] = new Set();
        reached[loser].add("Runner-up");
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

  const isLive =
    status === "IN_PLAY" || status === "LIVE" || status === "PAUSED";
  const isFinished = status === "FINISHED";
  const isScheduled = !isLive && !isFinished;

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

function UpcomingSection({ odds, usingDemoMode }) {
  // Group schedule by Melbourne day, show next 5 days with matches
  const now = new Date();

  // Sort and filter: upcoming + today + live + recently finished (last 48h)
  const cutoff = new Date(now.getTime() - 48 * 3600 * 1000);
  const relevant = SCHEDULE.filter((m) => new Date(m.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 40); // cap at 40 matches

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
  return (
    <section className="section">
      <h2 className="section-title bebas">Group Stage</h2>
      <div className="groups-grid">
        {Object.entries(standings).map(([grp, teams]) => (
          <div key={grp} className="group-card">
            <div className="group-header bebas">Group {grp}</div>
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
                  return (
                    <tr
                      key={t.team}
                      className={`group-row ${i < 2 ? "advancing" : ""}`}
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
        ))}
      </div>
      <div className="legend-row">
        <span className="legend-adv">
          ■ Top 2 per group advance · Best 8 third-place teams also advance
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
    (m) => m.status === "IN_PLAY" || m.status === "LIVE",
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
            {usingDemoMode && (
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
            <UpcomingSection odds={odds} usingDemoMode={usingDemoMode} />
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
