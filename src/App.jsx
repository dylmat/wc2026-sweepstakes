import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PLAYERS, PLAYER_TEAMS, GROUPS, ROUND_POINTS, getTeamOwner, FLAGS } from './data';
import './App.css';

// ─── ESPN API ────────────────────────────────────────────────────────────────
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260611-20260719';
const ESPN_STANDINGS  = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';

function parseESPNMatches(events) {
  return (events || []).map(ev => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    const away = comp?.competitors?.find(c => c.homeAway === 'away');
    const status = comp?.status?.type?.name;
    const finished = status === 'STATUS_FINAL';
    return {
      id: ev.id,
      date: ev.date,
      team1: home?.team?.displayName || '',
      team2: away?.team?.displayName || '',
      score: finished ? { ft: [parseInt(home?.score || 0), parseInt(away?.score || 0)] } : null,
      status,
      round: comp?.series?.summary || ev.name || '',
    };
  });
}

function useWorldCupData() {
  const [matches, setMatches] = useState([]);
  const [espnStandings, setEspnStandings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const scoreRes = await fetch(ESPN_SCOREBOARD);
        if (!scoreRes.ok) throw new Error(`ESPN API ${scoreRes.status}`);
        const scoreJson = await scoreRes.json();
        setMatches(parseESPNMatches(scoreJson.events || []));

        // Try standings endpoint
        try {
          const standRes = await fetch(ESPN_STANDINGS);
          if (standRes.ok) {
            const standJson = await standRes.json();
            // ESPN standings come back as children groups
            const grouped = {};
            (standJson.children || []).forEach(grp => {
              const letter = grp.abbreviation || grp.name?.replace('Group ', '');
              if (!letter || letter.length > 2) return;
              grouped[letter] = (grp.standings?.entries || []).map(e => {
                const stat = k => e.stats?.find(s => s.name === k)?.value ?? 0;
                return {
                  team: e.team?.displayName,
                  mp: stat('gamesPlayed'),
                  w: stat('wins'),
                  d: stat('ties'),
                  l: stat('losses'),
                  gf: stat('pointsFor'),
                  ga: stat('pointsAgainst'),
                  pts: stat('points'),
                };
              });
            });
            setEspnStandings(grouped);
          }
        } catch (_) {}

        setLastUpdated(new Date());
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const iv = setInterval(fetchData, 60 * 1000); // every 60s
    return () => clearInterval(iv);
  }, []);

  return { matches, espnStandings, loading, error, lastUpdated };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function normalizeTeam(name) {
  if (!name) return '';
  const map = {
    'United States': 'USA', 'US': 'USA',
    'Bosnia and Herzegovina': 'Bosnia & Herz.',
    'Bosnia & Herzegovina': 'Bosnia & Herz.',
    'Bosnia-Herzegovina': 'Bosnia & Herz.',
    'Korea Republic': 'South Korea', 'South Korea': 'South Korea',
    "Côte d'Ivoire": 'Ivory Coast', "Cote d'Ivoire": 'Ivory Coast',
    'DR Congo': 'DR Congo', 'Congo DR': 'DR Congo',
    'Czech Republic': 'Czechia',
    'Turkey': 'Türkiye',
  };
  return map[name] || name;
}

function computeGroupStandings(matches, espnStandings) {
  // Prefer ESPN standings when available
  if (espnStandings && Object.keys(espnStandings).length > 0) {
    const merged = {};
    Object.entries(GROUPS).forEach(([grp, teams]) => {
      const espnGrp = espnStandings[grp];
      if (espnGrp && espnGrp.length > 0) {
        merged[grp] = espnGrp.map(e => {
          const norm = normalizeTeam(e.team);
          const canonical = teams.find(t => t === norm || norm.includes(t) || t.includes(norm)) || norm;
          return { ...e, team: canonical };
        });
      } else {
        merged[grp] = teams.map(t => ({ team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
      }
    });
    return merged;
  }

  // Fallback: compute from match results
  const standings = {};
  Object.entries(GROUPS).forEach(([grp, teams]) => {
    standings[grp] = {};
    teams.forEach(t => { standings[grp][t] = { team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
  });
  matches.forEach(m => {
    if (!m.score?.ft) return;
    const [g1, g2] = m.score.ft;
    const t1 = normalizeTeam(m.team1);
    const t2 = normalizeTeam(m.team2);
    // find which group these teams are in
    for (const [grp, teams] of Object.entries(GROUPS)) {
      if (teams.includes(t1) && teams.includes(t2)) {
        const s1 = standings[grp][t1], s2 = standings[grp][t2];
        if (!s1 || !s2) break;
        s1.mp++; s2.mp++;
        s1.gf += g1; s1.ga += g2; s2.gf += g2; s2.ga += g1;
        if (g1 > g2)      { s1.w++; s1.pts += 3; s2.l++; }
        else if (g2 > g1) { s2.w++; s2.pts += 3; s1.l++; }
        else              { s1.d++; s1.pts++; s2.d++; s2.pts++; }
        break;
      }
    }
  });
  Object.keys(standings).forEach(grp => {
    standings[grp] = Object.values(standings[grp]).sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    );
  });
  return standings;
}

function computeKnockoutResults(matches) {
  const reached = {};
  matches.forEach(m => {
    if (!m.score?.ft) return;
    const name = (m.round || '').toLowerCase();
    const isKnockout = ['round of 32','round of 16','quarter','semi','final','3rd'].some(k => name.includes(k));
    if (!isKnockout) return;
    const [g1, g2] = m.score.ft;
    let winner = null, loser = null;
    if (g1 > g2) { winner = normalizeTeam(m.team1); loser = normalizeTeam(m.team2); }
    else if (g2 > g1) { winner = normalizeTeam(m.team2); loser = normalizeTeam(m.team1); }
    if (!winner) return;

    let roundKey = 'Round of 32';
    if (name.includes('16')) roundKey = 'Round of 16';
    else if (name.includes('quarter')) roundKey = 'Quarter-final';
    else if (name.includes('semi')) roundKey = 'Semi-final';
    else if (name.includes('3rd') || name.includes('third')) roundKey = '3rd Place';
    else if (name.includes('final')) roundKey = 'Winner';

    if (!reached[winner]) reached[winner] = new Set();
    reached[winner].add(roundKey);
    if (roundKey === 'Winner') {
      if (!reached[loser]) reached[loser] = new Set();
      reached[loser].add('Runner-up');
    }
  });
  return reached;
}

function computeSweepstakesPoints(knockoutResults) {
  const playerPoints = {};
  PLAYERS.forEach(p => { playerPoints[p.id] = { total: 0, breakdown: {} }; });
  Object.entries(PLAYER_TEAMS).forEach(([playerId, teams]) => {
    teams.forEach(team => {
      const rounds = knockoutResults[team];
      if (!rounds) return;
      let pts = 0;
      rounds.forEach(r => { pts += ROUND_POINTS[r] || 0; });
      playerPoints[playerId].breakdown[team] = pts;
      playerPoints[playerId].total += pts;
    });
  });
  return playerPoints;
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function PlayerBadge({ playerId }) {
  const player = PLAYERS.find(p => p.id === playerId);
  if (!player) return null;
  return (
    <span className="player-badge" style={{ background: player.color + '22', border: `1.5px solid ${player.color}`, color: player.color }}>
      {player.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function TeamCell({ team }) {
  const owner = getTeamOwner(team);
  return (
    <span className="team-cell">
      <span className="team-flag">{FLAGS[team] || '🏳️'}</span>
      <span className="team-name">{team}</span>
      {owner && <PlayerBadge playerId={owner} />}
    </span>
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
                  <th>MP</th><th>W</th><th>D</th><th>L</th>
                  <th>GD</th><th className="th-pts">Pts</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => {
                  const owner = getTeamOwner(t.team);
                  const player = PLAYERS.find(p => p.id === owner);
                  const gd = (t.gf || 0) - (t.ga || 0);
                  return (
                    <tr key={t.team} className={`group-row ${i < 2 ? 'advancing' : ''}`}
                        style={player ? { borderLeft: `3px solid ${player.color}` } : {}}>
                      <td className="td-pos">{i + 1}</td>
                      <td className="td-team"><TeamCell team={t.team} /></td>
                      <td>{t.mp}</td><td>{t.w}</td><td>{t.d}</td><td>{t.l}</td>
                      <td className={gd > 0 ? 'pos' : gd < 0 ? 'neg' : ''}>{gd > 0 ? '+' : ''}{gd}</td>
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
        <span className="legend-adv">■ Top 2 per group advance · Best 8 third-place teams also advance</span>
      </div>
    </section>
  );
}

function KnockoutSection({ knockoutResults }) {
  const rounds = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Runner-up', 'Winner'];
  const allTeams = Object.values(PLAYER_TEAMS).flat();
  const teamProgress = allTeams.map(team => {
    const reached = knockoutResults[team] || new Set();
    const pts = [...reached].reduce((s, r) => s + (ROUND_POINTS[r] || 0), 0);
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
        {Object.entries(d.breakdown).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([team, pts]) => (
          <div key={team} className="ct-row">
            <span>{FLAGS[team]} {team}</span><span>+{pts}</span>
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
      <div className="lb-teams">
        <div className="lb-teams-title">Your Teams</div>
        {PLAYERS.map(p => (
          <div key={p.id} className="lb-player-teams">
            <span className="lb-pt-name" style={{ color: p.color }}>{p.name}</span>
            <div className="lb-pt-list">
              {PLAYER_TEAMS[p.id].map(t => (
                <span key={t} className="lb-pt-team">{FLAGS[t]} {t}</span>
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
  const { matches, espnStandings, loading, error, lastUpdated } = useWorldCupData();
  const [activeTab, setActiveTab] = useState('groups');

  const standings      = useMemo(() => computeGroupStandings(matches, espnStandings), [matches, espnStandings]);
  const knockoutResults = useMemo(() => computeKnockoutResults(matches), [matches]);
  const playerPoints   = useMemo(() => computeSweepstakesPoints(knockoutResults), [knockoutResults]);

  const isLive = matches.some(m => m.status === 'STATUS_IN_PROGRESS');

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
            {isLive && !loading && <span className="status-pill live">● LIVE</span>}
            {error && <span className="status-pill err">⚠ {error}</span>}
            {lastUpdated && !loading && !isLive && (
              <span className="status-time">Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
        <div className="player-legend">
          {PLAYERS.map(p => (
            <div key={p.id} className="pl-item">
              <span className="pl-dot" style={{ background: p.color }} />
              <span className="pl-name" style={{ color: p.color }}>{p.name}</span>
            </div>
          ))}
        </div>
      </header>

      <nav className="tab-nav">
        <button className={`tab ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => setActiveTab('groups')}>Groups</button>
        <button className={`tab ${activeTab === 'knockout' ? 'active' : ''}`} onClick={() => setActiveTab('knockout')}>Knockout</button>
      </nav>

      <div className="body">
        <main className="main-content">
          {activeTab === 'groups'   && <GroupsSection standings={standings} />}
          {activeTab === 'knockout' && <KnockoutSection knockoutResults={knockoutResults} />}
        </main>
        <LeaderboardChart playerPoints={playerPoints} />
      </div>

      <footer className="footer">
        Data from <a href="https://www.espn.com" target="_blank" rel="noreferrer">ESPN</a> · Refreshes every 60 seconds
      </footer>
    </div>
  );
}
