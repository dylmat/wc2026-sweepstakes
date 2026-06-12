# ⚽ WC 2026 Sweepstakes Tracker

A live World Cup 2026 sweepstakes tracker for tracking points across friends' teams. Built with React + Vite, deployed free on GitHub Pages.

## Features

- **Live group stage standings** — pulls from the open-source `openfootball/worldcup.json` API, auto-refreshes every 5 minutes
- **Knockout bracket tracker** — shows sweepstakes points earned as teams advance
- **Live leaderboard** with bar chart — updates automatically as results come in
- **Player colour coding** — each friend's teams are visually highlighted across all views

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

Points are designed so that even a player whose team wins the tournament (max ~82pts from one team) can still be beaten by opponents with multiple teams advancing deeply.

## 🚀 Deploy to GitHub Pages (Free)

### One-time setup

1. **Create a new GitHub repo** (e.g. `wc2026-sweepstakes`)

2. **Push this code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/wc2026-sweepstakes.git
   git push -u origin main
   ```

3. **Update `vite.config.js`** — change `base` to match your repo name:
   ```js
   base: '/wc2026-sweepstakes/',
   ```

4. **Enable GitHub Pages:**
   - Go to your repo → Settings → Pages
   - Under **Source**, select **GitHub Actions**
   - Save

5. **That's it!** Every push to `main` auto-deploys. Your URL will be:
   `https://YOUR_USERNAME.github.io/wc2026-sweepstakes/`

### Local development
```bash
npm install
npm run dev
```

## Data Source

Live data from [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) — free, no API key required. Updated manually by the maintainer daily during the tournament.
