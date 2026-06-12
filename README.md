# ⚽ WC 2026 Sweepstakes Tracker

Live World Cup 2026 sweepstakes tracker. Built with React + Vite, deployed free on GitHub Pages.

---

## Why there's a proxy Worker

Football APIs block direct browser requests (CORS). The included Cloudflare Worker sits in the middle, adds the right headers, and keeps your API keys secret. Cloudflare's free tier is more than enough (100,000 requests/day free).

---

## Setup — 3 steps

### Step 1 — Get free API keys (2 min)

| Key | Where | Free tier |
|-----|-------|-----------|
| `FD_KEY` | [football-data.org/client/register](https://www.football-data.org/client/register) | Instant, no card |
| `ODDS_KEY` | [the-odds-api.com](https://the-odds-api.com/#get-access) | 500 req/month (optional) |

### Step 2 — Deploy the Cloudflare Worker (2 min)

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) → sign up free
2. Click **Create Application → Create Worker**
3. Replace the default code with the contents of **`worker/worker.js`** in this repo
4. Click **Deploy**
5. Go to your Worker → **Settings → Variables → Environment Variables**
   - Add `FD_KEY` = your football-data.org key
   - Add `ODDS_KEY` = your the-odds-api.com key *(optional — skip if you don't want odds)*
6. Copy your Worker URL — looks like `https://wc-proxy.yourname.workers.dev`

### Step 3 — Paste your Worker URL into the app (30 sec)

Open `src/App.jsx`, find line ~9:

```js
const WORKER_BASE = 'YOUR_WORKER_URL';
```

Replace with your actual Worker URL:

```js
const WORKER_BASE = 'https://wc-proxy.yourname.workers.dev';
```

---

## Deploy to GitHub Pages (free)

```bash
# First time
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/wc2026-sweepstakes.git
git push -u origin main
```

Then in GitHub: **Settings → Pages → Source → GitHub Actions → Save**

Every `git push` after that auto-deploys. URL: `https://YOUR_USERNAME.github.io/wc2026-sweepstakes/`

**Note:** If your repo is named differently, update `base` in `vite.config.js` to match.

---

## Local dev

```bash
npm install
npm run dev
```

---

## Sweepstakes Points

| Round | Points |
|-------|--------|
| Round of 32 | +2 |
| Round of 16 | +5 |
| Quarter-final | +12 |
| Semi-final | +22 |
| 3rd Place | +15 |
| Runner-up | +35 |
| Winner | +50 |

Max from a single winning team ≈ 86pts — but 7 other teams advancing still matters.
