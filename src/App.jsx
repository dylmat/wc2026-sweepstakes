import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PLAYERS, PLAYER_TEAMS, GROUPS, ROUND_POINTS, getTeamOwner, FLAGS } from './data';
import './App.css';

// ─── API ────────────────────────────────────────────────────────────────────
const WC_API = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

function useWorldCupData() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(WC_API);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setMatches(json.matches || []);
        setLastUpdated(new Date());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  return { matches, loading, error, lastUpdated };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function normalizeTeam(name) {
  const map = {
    'United States': 'USA', 'Bosnia and Herzegovina': 'Bosnia & Herz.',
    'Bosnia & Herzegovina': 'Bosnia & Herz.', 'Korea Republic': 'South Korea',
    "Côte d'Ivoire": 'Ivory Coast', 'Ivory Coast': 'Ivory Coast',
  };
  return map[name] || name;
}

function computeGroupStandings(matches) {
  const standings = {};
  Object.entries(GROUPS).forEach(([grp, teams]) => {
    standings[grp] = {};
    teams.forEach(t => {
      standings[grp][t] = { team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    });
  });

  matches.forEach(m => {
    if (!m.score || m.score.ft === undefined) return;
    const [g1, g2] = m.score.ft;
    const t1 = normalizeTeam(m.team1);
    const t2 = normalizeTeam(m.team2);
    const grp = m.group?.replace('Group ', '');
    if (!grp || !standings[grp]) return;
    const s1 = standings[grp][t1];
    const s2 = standings[grp][t2];
    if (!s1 || !s2) return;
    s1.mp++; s2.mp++;
    s1.gf += g1; s1.ga += g2;
    s2.gf += g2; s2.ga += g1;
    if (g1 > g2)      { s1.w++; s1.pts += 3; s2.l++; }
    else if (g2 > g1) { s2.w++; s2.pts += 3; s1.l++; }
    else              { s1.d++; s1.pts++; s2.d++; s2.pts++; }
  });

  // Sort each group
  Object.keys(standings).forEach(grp => {
    standings[grp] = Object.values(standings[grp]).sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    );
  });
  return standings;
}

function computeKnockoutResults(matches) {
  // Returns map of team → [rounds they reached]
  const reached = {};
  const knockoutRounds = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final', '3rd Place Play-off'];

  matches.forEach(m => {
    if (!m.score?.ft) return;
    const round = m.round;
    if (!knockoutRounds.some(r => round?.includes(r) || round === r)) return;

    const [g1, g2] = m.score.ft;
    let winner = null, loser = null;
    if (g1 > g2) { winner = normalizeTeam(m.team1); loser = normalizeTeam(m.team2); }
    else if (g2 > g1) { winner = normalizeTeam(m.team2); loser = normalizeTeam(m.team1); }
    else if (m.score.et) {
      const [e1, e2] = m.score.et;
      if (e1 > e2) { winner = normalizeTeam(m.team1); loser = normalizeTeam(m.team2); }
      else { winner = normalizeTeam(m.team2); loser = normalizeTeam(m.team1); }
    }
    if (!winner) return;

    const roundName = round.includes('Final') && !round.includes('Semi') && !round.includes('3rd')
      ? (round.includes('3rd') ? '3rd Place' : 'Final')
      : round;

    if (!reached[winner]) reached[winner] = new Set();
    reached[winner].add(roundName);

    // The loser of final = Runner-up, loser of 3rd place = 4th
    if (roundName === 'Final' || round.includes('Final')) {
      if (!reached[loser]) reached[loser] = new Set();
      reached[loser].add('Runner-up');
    }
  });

  return reached;
}

function computeSweepstakesPoints(knockoutResults) {
  // For each player, sum points from all their teams' knockout advances
  const playerPoints = {};
  PLAYERS.forEach(p => { playerPoints[p.id] = { total: 0, breakdown: {} }; });

  Object.entries(PLAYER_TEAMS).forEach(([playerId, teams]) => {
    teams.forEach(team => {
      const rounds = knockoutResults[team];
      if (!rounds) return;
      let teamPts = 0;
      rounds.forEach(r => {
        const pts = ROUND_POINTS[r] || (ROUND_POINTS['Winner'] && r === 'Winner' ? ROUND_POINTS['Winner'] : 0);
        teamPts += pts;
      });
      playerPoints[playerId].breakdown[team] = teamPts;
      playerPoints[playerId].total += teamPts;
    });
  });

  return playerPoints;
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function PlayerBadge({ playerId, size = 'sm' }) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return null;
  const sz = size === 'sm' ? { width: 22, height: 22, fontSize: 10 } : { width: 28, height: 28, fontSize: 11 };
  return (
    <span className="player-badge" style={{ background: player.color + '22', border: `1.5px solid ${player.color}`, color: player.color, ...sz }}>
      {player.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function TeamCell({ team }) {
  const owner = getTeamOwner(team);
  const player = PLAYERS.find(p => p.id === owner);
  return (
    <span className="team-cell">
      <span className="team-flag">{FLAGS[team] || '🏳️'}</span>
      <span className="team-name">{team}</span>
      {player && <PlayerBadge playerId={owner} />}
    </span>
  );
}

function GroupsSection({ standings }) {
  const groups = Object.entries(standings);

  return (
    <section className="section">
      <h2 className="section-title bebas">Group Stage</h2>
      <div className="groups-grid">
        {groups.map(([grp, teams]) => (
          <div key={grp} className="group-card">
            <div className="group-header bebas">Group {grp}</div>
            <table className="group-table">
              <thead>
                <tr>
                  <th className="th-pos">#</th>
                  <th className="th-team">Team</th>
                  <th>MP</th><th>W</th><th>D</th><th>L</th>
                  <th>GD</th><th className="th-pts">Pts</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => {
                  const owner = getTeamOwner(t.team);
                  const player = PLAYERS.find(p => p.id === owner);
                  const advancing = i < 2;
                  return (
                    <tr key={t.team} className={`group-row ${advancing ? 'advancing' : ''}`}
                        style={player ? { borderLeft: `3px solid ${player.color}` } : {}}>
                      <td className="td-pos">{i + 1}</td>
                      <td className="td-team"><TeamCell team={t.team} /></td>
                      <td>{t.mp}</td>
                      <td>{t.w}</td>
                      <td>{t.d}</td>
                      <td>{t.l}</td>
                      <td className={t.gf - t.ga > 0 ? 'pos' : t.gf - t.ga < 0 ? 'neg' : ''}>
                        {t.gf - t.ga > 0 ? '+' : ''}{t.gf - t.ga}
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
        <span className="legend-adv">■ Top 2 advance · Best 8 third-place also advance</span>
      </div>
    </section>
  );
}

function KnockoutSection({ knockoutResults }) {
  const rounds = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Runner-up', 'Winner'];

  // Build a list of all sweepstakes teams and their knockout progress
  const allTeams = Object.values(PLAYER_TEAMS).flat();
  const teamProgress = allTeams.map(team => {
    const reached = knockoutResults[team] || new Set();
    const pts = [...reached].reduce((sum, r) => sum + (ROUND_POINTS[r] || 0), 0);
    return { team, reached, pts };
  }).filter(t => t.reached.size > 0).sort((a, b) => b.pts - a.pts);

  return (
    <section className="section">
      <h2 className="section-title bebas">Knockout Stage — Sweepstakes Points</h2>
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
            {rounds.map(r => <span key={r} className="kp-col">{r}</span>)}
            <span className="kp-col kp-total">Pts</span>
          </div>
          {teamProgress.map(({ team, reached, pts }) => {
            const owner = getTeamOwner(team);
            const player = PLAYERS.find(p => p.id === owner);
            return (
              <div key={team} className="kp-row" style={player ? { borderLeft: `3px solid ${player.color}` } : {}}>
                <span className="kp-team"><TeamCell team={team} /></span>
                {rounds.map(r => (
                  <span key={r} className={`kp-cell ${reached.has(r) ? 'kp-reached' : ''}`}
                        style={reached.has(r) ? { color: player?.color } : {}}>
                    {reached.has(r) ? `+${ROUND_POINTS[r]}` : '—'}
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
  const player = PLAYERS.find(p => p.id === d.id);
  return (
    <div className="chart-tooltip" style={{ borderColor: player?.color }}>
      <div className="ct-name" style={{ color: player?.color }}>{d.name}</div>
      <div className="ct-pts">{d.total} pts</div>
      <div className="ct-breakdown">
        {Object.entries(d.breakdown)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([team, pts]) => (
            <div key={team} className="ct-row">
              <span>{FLAGS[team]} {team}</span>
              <span>+{pts}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function LeaderboardChart({ playerPoints }) {
  const data = PLAYERS.map(p => ({
    ...p,
    total: playerPoints[p.id]?.total || 0,
    breakdown: playerPoints[p.id]?.breakdown || {},
  })).sort((a, b) => b.total - a.total);

  const max = Math.max(...data.map(d => d.total), 1);

  return (
    <aside className="leaderboard">
      <h2 className="section-title bebas lb-title">Leaderboard</h2>
      <div className="lb-subtitle">Sweepstakes Points</div>

      {/* Rank list */}
      <div className="lb-ranks">
        {data.map((d, i) => (
          <div key={d.id} className="lb-rank-row">
            <span className="lb-rank-num" style={{ color: i === 0 ? '#f5c518' : 'var(--text-secondary)' }}>
              {i === 0 ? '🏆' : `#${i + 1}`}
            </span>
            <span className="lb-rank-name" style={{ color: d.color }}>{d.name}</span>
            <div className="lb-bar-wrap">
              <div className="lb-bar" style={{ width: `${(d.total / max) * 100}%`, background: d.color }} />
            </div>
            <span className="lb-rank-pts">{d.total}</span>
          </div>
        ))}
      </div>

      {/* Recharts bar */}
      <div className="lb-chart-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }} barSize={28}>
            <XAxis dataKey="name" tick={{ fill: '#8892a4', fontSize: 11, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4a5568', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {data.map(d => <Cell key={d.id} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Teams per player */}
      <div className="lb-teams">
        <div className="lb-teams-title">Your Teams</div>
        {PLAYERS.map(p => (
          <div key={p.id} className="lb-player-teams">
            <span className="lb-pt-name" style={{ color: p.color }}>{p.name}</span>
            <div className="lb-pt-list">
              {PLAYER_TEAMS[p.id].map(t => (
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
  const { matches, loading, error, lastUpdated } = useWorldCupData();
  const [activeTab, setActiveTab] = useState('groups');

  const standings = useMemo(() => computeGroupStandings(matches), [matches]);
  const knockoutResults = useMemo(() => computeKnockoutResults(matches), [matches]);
  const playerPoints = useMemo(() => computeSweepstakesPoints(knockoutResults), [knockoutResults]);

  return (
    <div className="app">
      {/* Header */}
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
            {loading && <span className="status-dot loading" />}
            {error && <span className="status-err">⚠ {error}</span>}
            {lastUpdated && !loading && (
              <span className="status-time">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Player legend */}
        <div className="player-legend">
          {PLAYERS.map(p => (
            <div key={p.id} className="pl-item">
              <span className="pl-dot" style={{ background: p.color }} />
              <span className="pl-name" style={{ color: p.color }}>{p.name}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Nav */}
      <nav className="tab-nav">
        <button className={`tab ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => setActiveTab('groups')}>
          Groups
        </button>
        <button className={`tab ${activeTab === 'knockout' ? 'active' : ''}`} onClick={() => setActiveTab('knockout')}>
          Knockout
        </button>
      </nav>

      {/* Body */}
      <div className="body">
        <main className="main-content">
          {activeTab === 'groups' && <GroupsSection standings={standings} />}
          {activeTab === 'knockout' && <KnockoutSection knockoutResults={knockoutResults} />}
        </main>
        <LeaderboardChart playerPoints={playerPoints} />
      </div>

      <footer className="footer">
        Data from <a href="https://github.com/openfootball/worldcup.json" target="_blank" rel="noreferrer">openfootball/worldcup.json</a>
        &nbsp;· Refreshes every 5 minutes
      </footer>
    </div>
  );
}
