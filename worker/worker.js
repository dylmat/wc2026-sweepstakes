/**
 * WC 2026 Sweepstakes — Cloudflare Worker Proxy
 * Fixes CORS for football-data.org
 *
 * Environment Variables to set in Cloudflare:
 *   FD_KEY = your football-data.org key
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

    // Strip any leading slashes and normalise
    const path = url.pathname.replace(/^\/+/, '');

    try {
      let upstream;

      if (path === 'standings') {
        upstream = 'https://api.football-data.org/v4/competitions/WC/standings?season=2026';
      } else if (path === 'matches') {
        upstream = 'https://api.football-data.org/v4/competitions/WC/matches?season=2026';
      } else {
        // Return debug info so you can see what path is arriving
        return new Response(
          JSON.stringify({ error: 'Not found', path, url: request.url }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } }
        );
      }

      const res = await fetch(upstream, {
        headers: { 'X-Auth-Token': env.FD_KEY },
      });

      const data = await res.json();

      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...CORS },
      });

    } catch (e) {
      return new Response(
        JSON.stringify({ error: e.message }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
      );
    }
  },
};
