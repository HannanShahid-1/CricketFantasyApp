# Seam · Fantasy Cricket

A season-long, Sleeper-style redraft fantasy league for the IPL. Friends draft teams, set a weekly lineup, work the waiver wire and play head-to-head matchups through the season.

This repo holds the **local prototype** (`app/`), the **data pipeline** (`scripts/`) and the **research** behind the design (`docs/`). The prototype replays the real IPL 2026 season ball by ball from free Cricsheet data, with AI managers filling the other teams.

## Quick start

Double-click **`Start Seam.bat`** (Windows). The first run installs dependencies, then the app opens at http://localhost:5174.

Manually:

```
cd app
npm install
npm run dev
```

Requires Node 20+. Python 3 is only needed to rebuild the data.

## Repo layout

```
app/                 React + TypeScript (Vite) prototype — runs fully in the browser
  src/engine/        scoring, data loading & projections, league engine (draft, lineups, waivers, trades, playoffs)
  src/ui/            draft room, app shell, views and modals
  public/data/       ipl.json — built from Cricsheet, committed so the app runs after a clone
scripts/             build_data.py — converts Cricsheet JSON into app/public/data/ipl.json
data/                raw Cricsheet download (git-ignored) — see data/README.md
docs/
  ROADMAP.md         what's done and what's next
  research/          the research report, scoring options, and the raw research notes
Start Seam.bat       one-click launcher
Update Data.bat      re-download Cricsheet and rebuild the data file
```

## How a season works

1. **Create a league:** 8 or 10 teams, your draft slot, pick timer. AI managers have styles (bat-first, bowl-first, boom-or-bust, steady).
2. **Snake draft** with a queue, autopick, and an auto-draft toggle. Rankings come from each player's 2025 fantasy points.
3. **Lineup:** `1 WK · 4 BAT · 4 BOWL · 2 FLEX + 4 bench`.
   - WK → WK/BAT/FLEX · batting all-rounder → BAT/FLEX · bowling all-rounder → BOWL/FLEX
   - A player locks when his first match of the week starts; auto-sub covers starters left out of the XI.
4. **Gameweeks:** 8 Monday–Sunday weeks over the 70-match league stage. Weeks 1–6 are the regular season (head-to-head plus a game against the league median); week 7 semifinals, week 8 final. A player's weekly score is the sum of every match he plays that week.
5. **Advance:** *Watch live* replays the next match ball by ball with a fantasy tracker; *Sim match / Sim week / Sim to playoffs / Sim entire season* skip ahead.
6. **Waivers and trades:** free agents add instantly; recently dropped or locked players go to FAAB waivers ($100 budget, processed at week end, AI teams bid too). Trades with AI managers until the deadline at the start of week 5.

Scoring is **Option 1 "Standard"** (football-sized decimals: wicket = 6, run = 0.25, etc.). Full rules are on the app's Scoring page and in [docs/research/Scoring options.md](docs/research/Scoring%20options.md).

## Research

| Document | What it covers |
|---|---|
| [IPL fantasy cricket app research](docs/research/IPL%20fantasy%20cricket%20app%20research.md) | How the fantasy football season loop maps onto the IPL, gameweeks, roster slots, data sources, market and legal situation |
| [Scoring options](docs/research/Scoring%20options.md) | Points systems that keep scores small and balance batters against bowlers |
| [notes/](docs/research/notes/) | Raw research notes behind the report |

## Key decisions

- **Format:** redraft, snake draft, weekly head-to-head, FAAB waivers, trades
- **Season:** 8 gameweeks; fantasy playoffs end with the IPL league stage (only 4 IPL teams play in the IPL playoff week)
- **Lineup:** 4 BAT / 4 BOWL / 2 FLEX / 1 WK, no dedicated all-rounder slot
- **Data:** [Cricsheet](https://cricsheet.org) for building and replaying past seasons; a paid live feed only when going live
- **Market:** free-to-play only (India's 2025 Online Gaming Act); no IPL or franchise branding

## Prototype limits

- Single-player against AI; the league is saved in the browser's local storage
- Weekly recap text is template-generated (placeholder for an AI-written recap)
- Player names are Cricsheet scorecard names (e.g. "V Kohli"); roles are derived from stats, so some all-rounders are tagged BOWL
- Historical replay only; no live feed

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

## Data attribution

Match data from [Cricsheet](https://cricsheet.org), licensed under the [ODC Attribution License](https://opendatacommons.org/licenses/by/1-0/).
