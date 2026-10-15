# Seam · Fantasy Cricket

A season-long, Sleeper-style redraft fantasy league for the IPL. Friends draft teams, set a weekly lineup, work the waiver wire and play head-to-head matchups through the season.

This repo holds the **local prototype** (`app/`), the **data pipeline** (`scripts/`) and the **research** behind the design (`docs/`). The prototype replays the real IPL 2026 season ball by ball from free Cricsheet data, with AI managers filling the other teams.

## Quick start

**Mac / Linux:**

```bash
cd app && npm install && npm run dev -- --port 5174
```

Then open http://localhost:5174. **Windows:** double-click **`Start Seam.bat`** (installs dependencies on the first run).

Requires Node 20+. Python 3 (with Pillow) is only needed to rebuild data or refresh photos.

| | |
|---|---|
| `npm test` | engine test suite: plays whole simulated seasons and checks every rule |
| `npm run build` | type-check and production build |
| `npm run lint` | lint (expected to be warning-free) |

**Working on the code? Start with the [developer guide](docs/DEVELOPER_GUIDE.md).**

## Repo layout

```
app/                 React + TypeScript (Vite) prototype — runs fully in the browser
  src/engine/        pure game logic: scoring, data & projections, league rules, chat model (portable to iPhone/server)
  src/ui/            draft room, app shell, views, modals and chat
  src/store.ts       app state + actions; saves the league to localStorage
  src/bots.ts        simulated AI managers (prototype only)
  tests/             Vitest engine suite
  public/data/       ipl.json (built from Cricsheet), player media + bio metadata — committed so the app runs after a clone
  public/media/      player portraits (WebP) and team logos
mobile/              iPhone app (Expo/React Native), sharing app/src — see mobile/README.md
scripts/             data tools: build_data.py, sync_player_media.py (+ optimize_player_media.py), sync_player_bios.py
data/                raw Cricsheet download (git-ignored) — see data/README.md
docs/
  DEVELOPER_GUIDE.md how everything works and how to change it
  CHAT.md            chat, trades, commissioner, and their multiplayer plan
  ROADMAP.md         what's done and what's next
  research/          the research report, scoring options, and the raw research notes
CLAUDE.md            short brief for AI coding sessions (AGENTS.md: extra notes for Codex and other agents)
Start Seam.bat       one-click launcher
Update Data.bat      re-download Cricsheet and rebuild the data file
```

## How a season works

1. **Create a league:** 8 or 10 teams, your draft slot, pick timer. AI managers have styles (bat-first, bowl-first, boom-or-bust, steady).
2. **Snake draft** with a queue, autopick, and an auto-draft toggle. Rankings come from each player's 2025 fantasy points.
3. **Lineup:** `1 WK · 4 BAT · 4 BOWL · 2 FLEX + 4 bench`.
   - WK → WK/BAT/FLEX · batting all-rounder → BAT/FLEX · bowling all-rounder → BOWL/FLEX
   - **One match counts:** only one match per player counts each week. It's his first, unless you lock in a later one, and you must choose before his first match starts.
   - A player is fixed in your lineup once the match that counts for him starts. Auto-sub covers starters left out of the XI for their counting match.
4. **Gameweeks:** 8 Monday–Sunday weeks over the 70-match league stage. Weeks 1–6 are the regular season (head-to-head plus a game against the league median); week 7 semifinals, week 8 final. A player's weekly score is his one counting match.
5. **Advance:** *Watch live* replays the next match ball by ball with a fantasy tracker; *Sim match / Sim week / Sim to playoffs / Sim entire season* skip ahead.
6. **Waivers and trades:** free agents add instantly; recently dropped or locked players go to FAAB waivers ($100 budget, processed at week end, AI teams bid too). Trade offers go to the other manager's DMs; accepted trades wait for the commissioner (you) to approve or veto, or go through when the next match starts. Trade deadline: start of week 5.
7. **Home screen:** swipe through every matchup of the week (lineups follow), with the league chat docked on the right.
8. **Chat:** a league chat (with adds/drops, waivers, trades and weekly results posted automatically) and a DM with each manager. See [docs/CHAT.md](docs/CHAT.md).

Scoring is **Option 1 "Standard"** (football-sized decimals: wicket = 6, run = 0.25, etc.). Full rules are on the app's Scoring page and in [docs/research/Scoring options.md](docs/research/Scoring%20options.md).

## Research

| Document | What it covers |
|---|---|
| [Developer guide](docs/DEVELOPER_GUIDE.md) | Architecture, data, every rule and where it lives, testing, conventions, recipes |
| [Chat, trades and the commissioner](docs/CHAT.md) | League chat, DMs, trade lifecycle, and how they move to multiplayer |
| [IPL fantasy cricket app research](docs/research/IPL%20fantasy%20cricket%20app%20research.md) | How the fantasy football season loop maps onto the IPL, gameweeks, roster slots, data sources, market and legal situation |
| [Scoring options](docs/research/Scoring%20options.md) | Points systems that keep scores small and balance batters against bowlers |
| [notes/](docs/research/notes/) | Raw research notes behind the report |

## Key decisions

- **Format:** redraft, snake draft, weekly head-to-head, FAAB waivers, trades
- **Season:** 8 gameweeks; fantasy playoffs end with the IPL league stage (only 4 IPL teams play in the IPL playoff week)
- **Lineup:** 4 BAT / 4 BOWL / 2 FLEX / 1 WK, no dedicated all-rounder slot
- **One match per player per week counts:** the first by default, or one you lock in before his first match. This replaces the research report's "sum every match", so two-match weeks don't decide matchups
- **Data:** [Cricsheet](https://cricsheet.org) for building and replaying past seasons; a paid live feed only when going live
- **Market:** free-to-play only (India's 2025 Online Gaming Act); no IPL or franchise branding

## Prototype limits

- Single-player against AI; the league is saved in the browser's local storage
- Weekly recap text is template-generated (placeholder for an AI-written recap)
- AI managers' chat replies are canned lines (`app/src/bots.ts`), standing in for real people
- Player names are Cricsheet scorecard names (e.g. "V Kohli"); roles are derived from stats, so some all-rounders are tagged BOWL
- Historical replay only; no live feed

See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

## Data attribution

Match data from [Cricsheet](https://cricsheet.org), licensed under the [ODC Attribution License](https://opendatacommons.org/licenses/by/1-0/).
