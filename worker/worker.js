/**
 * WC 2026 Sweepstakes — Cloudflare Worker Proxy
 *
 * Environment Variables (Settings → Variables):
 *   FD_KEY = your football-data.org API key
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...CORS },
  });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const path = new URL(request.url).pathname.replace(/^\/+/, '');

    if (!env.FD_KEY) {
      return json({ error: 'FD_KEY environment variable is not set in Cloudflare Worker settings.' }, 500);
    }

    const FD_BASE = 'https://api.football-data.org/v4/competitions/WC';
    const headers = { 'X-Auth-Token': env.FD_KEY };

    try {
      if (path === 'standings') {
        const res = await fetch(`${FD_BASE}/standings?season=2026`, { headers });
        return json(await res.json(), res.status);

      } else if (path === 'matches') {
        const res = await fetch(`${FD_BASE}/matches?season=2026`, { headers });
        return json(await res.json(), res.status);

      } else {
        return json({ error: 'Not found', path }, 404);
      }
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};
