/**
 * WC 2026 Sweepstakes — Cloudflare Worker Proxy
 * Fixes CORS for football-data.org and the-odds-api.com
 *
 * SETUP (free, ~2 minutes):
 * 1. Go to https://workers.cloudflare.com → sign up free
 * 2. Create new Worker → paste this entire file
 * 3. Add your secrets under Settings → Variables → Environment Variables:
 *      FD_KEY   = your football-data.org key
 *      ODDS_KEY = your the-odds-api.com key (optional)
 * 4. Click Deploy → copy the worker URL (e.g. https://wc-proxy.yourname.workers.dev)
 * 5. Paste that URL into src/App.jsx as WORKER_BASE
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const path = url.pathname;

    try {
      let data;

      if (path === '/standings') {
        const res = await fetch(
          'https://api.football-data.org/v4/competitions/WC/standings?season=2026',
          { headers: { 'X-Auth-Token': env.FD_KEY } }
        );
        data = await res.json();

      } else if (path === '/matches') {
        const res = await fetch(
          'https://api.football-data.org/v4/competitions/WC/matches?season=2026',
          { headers: { 'X-Auth-Token': env.FD_KEY } }
        );
        data = await res.json();

      } else if (path === '/odds') {
        if (!env.ODDS_KEY) {
          return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', ...CORS } });
        }
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${env.ODDS_KEY}&regions=au&markets=h2h&oddsFormat=decimal`
        );
        data = await res.json();

      } else {
        return new Response('Not found', { status: 404, headers: CORS });
      }

      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...CORS },
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
  },
};
