# Seam developer guide

How the app is built, where every rule lives, and how to change things safely. Read this before working on the
code; keep it up to date when you change how something works.

**Contents**

1. [What Seam is](#1-what-seam-is)
2. [Running, testing and building](#2-running-testing-and-building)
3. [Repository map](#3-repository-map)
4. [Architecture](#4-architecture)
5. [Data: where it comes from and its shape](#5-data-where-it-comes-from-and-its-shape)
6. [The league object (all game state)](#6-the-league-object-all-game-state)
7. [Game rules and where they live](#7-game-rules-and-where-they-live)
8. [The simulation loop](#8-the-simulation-loop)
9. [Store, persistence and UI](#9-store-persistence-and-ui)
10. [AI managers (`bots.ts`)](#10-ai-managers-botsts)
11. [Testing](#11-testing)
12. [Conventions and gotchas](#12-conventions-and-gotchas)
13. [Recipes: common changes](#13-recipes-common-changes)
14. [Road to iPhone and multiplayer](#14-road-to-iphone-and-multiplayer)
15. [Known limitations](#15-known-limitations)

---

## 1. What Seam is

A season-long, Sleeper-style fantasy league for the IPL. You draft a 15-player squad against AI managers, set a
weekly lineup, work waivers and trades, chat with the league, and play head-to-head each week. The prototype
replays the real IPL 2026 season ball by ball from free [Cricsheet](https://cricsheet.org) data, so a whole season
can be played in minutes on one machine.

**Where it's going:** an iPhone app (Expo/React Native, distributed via TestFlight) for a small group of friends,
then multiplayer. The code is organised so the game engine moves across unchanged. See
[section 14](#14-road-to-iphone-and-multiplayer).

**Design principles the owner cares about**

- **Skill over luck, and no hindsight.** Every choice has to be made before the information that would make it
  easy. The "one match counts" lock-in rule is the clearest example.
- **Mobile-first and portable.** Game rules go in the engine (plain TypeScript), never in screens.
- **Free-to-play only** (India's 2025 Online Gaming Act); no IPL branding in the product name.

## 2. Running, testing and building

Requires Node 20+. Python 3 (with Pillow) is only needed to rebuild data or refresh photos.

| Task | Mac / Linux (from `app/`) | Windows |
|---|---|---|
| First install | `npm install` | `Start Seam.bat` installs automatically |
| Run the app | `npm run dev -- --port 5174` → http://localhost:5174 | double-click `Start Seam.bat` |
| Engine tests | `npm test` | same |
| Type-check + production build | `npm run build` | same |
| Lint | `npm run lint` | same |
| Refresh Cricsheet data | see [section 5](#5-data-where-it-comes-from-and-its-shape) | `Update Data.bat` |

`.claude/launch.json` defines a `seam` dev-server config (port 5174) for Claude Code's preview browser.

**Before calling a change done:** `npm test`, `npm run build` (includes `tsc`), `npm run lint`, and click through the
affected screens in the browser.

## 3. Repository map

```
README.md                 overview + quick start
docs/
  DEVELOPER_GUIDE.md      this file
  CHAT.md                 chat + trades + commissioner design and the multiplayer plan for them
  ROADMAP.md              done / next / later
  research/               the research report, scoring options, raw notes (background, not code docs)
scripts/                  Python data tools (run from the repo root)
  build_data.py           Cricsheet zip → app/public/data/ipl.json (players, matches, roles, gameweeks)
  sync_player_media.py    downloads player portraits + team logos, writes player-media.json
  optimize_player_media.py  PNG/JPG portraits → WebP (max 512px); runs at the end of the sync
  sync_player_bios.py     age / nationality / batting & bowling style → player-bios.json
  player_media_fallbacks.json, player_bio_ids.json   explicit identity mappings for the syncs
data/                     raw Cricsheet download (git-ignored)
Start Seam.bat, Update Data.bat   Windows launchers
app/                      the React + TypeScript (Vite) app
  public/data/            ipl.json, player-media.json, player-bios.json (+ READMEs on sources)
  public/media/           players/*.webp portraits, teams/*.svg logos
  tests/engine.test.ts    Vitest suite (whole simulated seasons + rule checks)
  src/
    main.tsx, App.tsx     entry; App loads data, upgrades saved leagues, starts bots, routes Setup/Draft/Shell
    store.ts              Zustand store: UI state + every action; persistence
    bots.ts               simulated AI managers (chat, reads, typing, trade answers) — prototype only
    engine/               pure game logic, no React, no DOM (portable to iPhone/server)
      types.ts            raw data shapes + ball flag constants
      data.ts             loadData(), Player/Match/Data types, projections
      scoring.ts          per-match stat lines and fantasy points (scoring Option 1)
      league.ts           the League model + every rule: draft, lineups, one-match lock-in, sim, waivers, trades
      chat.ts             chat model: channels, messages, read cursors, reactions
      playerNames.ts, playerAge.ts   small helpers
    ui/
      Shell.tsx           app frame: sidebar nav, clock bar (sim controls), routes the views
      Setup.tsx           create-a-league landing page
      DraftRoom.tsx       live snake draft (+ DraftBoard grid used after the draft)
      MatchPicker.tsx     "which match counts" chips
      common.tsx          shared components (avatars, chips, Modal, MatchBalls…)
      format.ts           plain formatters (dates, week labels, initials)
      helpers.ts          live team score, weekly summaries, template recap
      scorecard.ts        ball-by-ball commentary + scorecard text
      views/              one file per sidebar screen (Matchup, Team, Players, Chat, Standings, …)
      modals/             Player card, Add/claim, Trade, Match scorecard, Live match
      chat/               chat cards (trades, results, waivers…) + preview text helpers
    styles.css            the whole design system (tokens at the top; sections per feature)
```

## 4. Architecture

```
Cricsheet zip ──build_data.py──▶ public/data/ipl.json ─┐
IPL site ──sync_player_media.py──▶ player-media.json + media/ ─┼─▶ loadData() ─▶ Data (static, read-only)
KKR feed ──sync_player_bios.py──▶ player-bios.json ─┘                │
                                                                       ▼
                                   engine/league.ts + chat.ts  (pure functions that mutate a League copy)
                                                                       ▲
                     store.ts  (Zustand: holds the League, clones it per action, persists to localStorage)
                        ▲   ▲
                 UI (React) bots.ts (simulated managers calling the same store actions)
```

Two kinds of state:

- **`Data`** (from `loadData()`): players, matches, ball-by-ball, gameweeks. Built once at startup, never changes.
  Get it anywhere with `getData()`.
- **`League`**: everything that happens in your league (rosters, lineups, results, trades, chat). Lives in the store
  and is saved to `localStorage`.

**The engine never touches React or the browser.** Functions take `(d: Data, l: League, ...)` and mutate `l`. The
store hands them a fresh copy and then saves it, so React sees a new object. That split is what lets the same engine
run on an iPhone or a server later.

## 5. Data: where it comes from and its shape

**Cricsheet** (ODC-BY licence, attribution required wherever data is shown) provides ball-by-ball JSON.
`scripts/build_data.py` turns the zip into `ipl.json`:

```bash
curl -L -o data/raw/ipl_male_json.zip https://cricsheet.org/downloads/ipl_male_json.zip
python3 -I scripts/build_data.py data/raw/ipl_male_json.zip app/public/data/ipl.json
```

- `SEASONS = ("2025", "2026")`, `SIM_SEASON = "2026"` at the top of the script. 2025 is only used for pre-draft
  rankings and projections; 2026 is the season that's replayed.
- **Roles** are derived from stats (`KNOWN_KEEPERS`, stumpings, runs vs overs): WK, BAT, ARB (batting all-rounder),
  ARW (bowling all-rounder), BOWL. Some real all-rounders get tagged BOWL (see Known limitations).
- **Gameweeks:** Monday–Sunday, opening weekend merged into week 1, league stage only (8 weeks, 70 matches).
- **Ball encoding:** `[over, batter, bowler, runsBatter, runsExtras, flags, wicket?]`; flags are bit masks
  (`FLAG_WIDE` 1, `FLAG_NOBALL` 2, `FLAG_BYE` 4, `FLAG_LEGBYE` 8, `FLAG_PENALTY` 16, `FLAG_NONBOUNDARY` 32 in
  `engine/types.ts`); wicket is `[kindCode, playerOut, fielders[]]` with codes listed in `WICKET_KINDS`.

**`loadData()`** (`engine/data.ts`) fetches the three JSON files in parallel and builds:

| Field | What it is |
|---|---|
| `players[idx]` | Every player. **`idx` is the number used everywhere in the engine** (rosters, picks, trades). `id` is Cricsheet's stable id (used by the photo/bio files). |
| `pool` | Players on a 2026 team (draftable). |
| `matches[mi]` | The sim season's matches in order. **`mi` (match index) is the clock**: `league.played` = number of matches played. Each has `gw`, `xi` (who played), per-player `points` and stat `lines`. |
| `gameweeks[gw-1]` | `{ gw, start, end, mis }`. |
| `teamGw[team][gw]` | A team's match indexes in a gameweek. `teamMis[team]` is all of them in order. |
| `version` | `simSeason-players-matches`. If saved league's `dataVersion` differs, the league is reset on load. |

Player photos are WebP in `public/media/players` (`photo` path from `player-media.json`); a missing photo falls
back to initials. Photo sources and licensing caveats: `app/public/media/README.md`. Bios: `public/data/player-bios-README.md`.

**Projections** (`data.ts`): `perMatchProj` blends 2025 average, 2026 results so far and a role baseline;
`availability` estimates the chance he plays; `restOfSeason` = per-match × availability × **weeks** he still has a
match in (one match counts per week, so matches beyond one per week add nothing).

## 6. The league object (all game state)

Defined in `engine/league.ts`. Everything here is plain JSON (it's saved to `localStorage` as is).

| Field | Meaning |
|---|---|
| `teams[]` (`FTeam`) | `id` (0 = you), `name`, `owner`, `isUser`, AI `persona`, `color`, `roster` (15 player idx), `starters` (11 slots, idx or null), `faab`, `autoSub`, `autoLineup`, `picks` (this week's locked-in matches). |
| `phase` | `'draft' → 'season' → 'complete'`. |
| `draft` | snake `order`, `picks[]`, `rounds` (15), pick `timer`, AI `speed`, your `queue`. |
| `played` | Matches played so far (the sim clock). `currentWeek(d, l)` is derived from it. |
| `schedule[]` | `Matchup { week, a, b, kind, label? }`: round-robin weeks 1–6, playoffs added at week 6/7. |
| `results[week]` | Frozen at week end: `scores`, `proj`, `starters`, `counted` (which match counted per starter), `median`. |
| `claims[]`, `waiverOrder`, `onWaivers` | FAAB waiver state, processed at week end. |
| `txns[]` | Transaction log (adds, drops, waivers, trades, auto-subs) for the Activity screen. |
| `trades[]` (`TradeOffer`) | Every trade offer and its status (see trades below). |
| `commissionerId`, `settings.tradeReview` | Commissioner (the creator, team 0) and whether accepted trades need review. |
| `chat` (`ChatState`) | Messages, read cursors, reactions (`engine/chat.ts`). |
| `nextId` | Id counter for txns, claims and trades. |

**Adding a field?** Give it a default in `upgradeLeague()` so leagues saved before the change still load.

## 7. Game rules and where they live

| Rule | Where |
|---|---|
| Lineup: `1 WK · 4 BAT · 4 BOWL · 2 FLEX` + 4 bench (`SLOTS`, `ROSTER_SIZE` 15) | `league.ts` constants |
| Eligibility: WK → WK/BAT/FLEX; ARB → BAT/FLEX; ARW → BOWL/FLEX | `data.ts` (`ELIGIBILITY`) |
| Best legal lineup (max projected points; optimal matching) | `bestLineup`; `canFillLineup` checks legality |
| Season: 8 weeks, weeks 1–6 regular (head-to-head **plus a game vs the league median**), week 7 semis (top 4), week 8 final | `REG_WEEKS`, `LAST_WEEK`, `roundRobin`, `seedPlayoffs`, `setFinals`, `standings` |
| Standings order: wins incl. median wins, then points for | `standings` |
| Scoring Option 1 "Standard" (e.g. run 0.25, wicket 6) | `scoring.ts` (`SCORING_RULES` table is also shown on the Scoring screen) |
| Draft: snake order, AI personas, noise, positional sanity | `teamAtPick`, `chooseDraftPick`, `preseasonValue` |
| FAAB $100, free agents vs waivers | `FAAB_BUDGET`, `addMode`, `freeAgentAdd`, `placeClaim`, `processWaivers` |
| Trade deadline: start of week 5 | `TRADE_DEADLINE_WEEK`, `tradeProblem` |

### One match counts (lock-in)

Only **one** of a player's matches counts each week. It's **his first match unless you lock in another**, and you
must choose **before his first match of the week starts**. All in `league.ts`:

| Function | Rule |
|---|---|
| `weekMatches(d, p, week)` | His matches that week. |
| `countedMatch(d, l, teamId, p, week)` | The pick if locked in, else the first match; for finished weeks, what `results.counted` recorded. |
| `pickOpen` / `setMatchPick` | A pick can be set or changed only while none of his matches this week has started, and only with 2+ matches. Choosing his first match clears the pick. Picks reset every week. |
| `slotLocked(d, l, teamId, p)` | In the lineup a player is fixed once **his counting match** has started; before that he can move even if an earlier, non-counting match was played. |
| `lineupProblem` | Rejects lineups that move a slot-locked starter or bring in a player whose counting match already started (the hindsight exploit). The store's `setStarters` uses it. |
| `playerWeek(...)` | Points (or projection) from the counted match only. **Use this for anything "this week".** |

`isLocked(d, l, p)` is different: "any of his matches this week has begun". It gates drops, trades, free-agent adds
and the pick deadline.

**Auto-sub** (`autoSubs`, at each match's toss): if a starter's counting match is this one and he isn't in the XI, the
best eligible bench player whose own counting match hasn't started takes the slot.

### Trades and the commissioner

```
pending ──▶ declined | withdrawn | expired (end of the week it was sent)
   │ accepted
   ▼
review ──▶ approved (commissioner, or automatically when the next match starts) | vetoed (commissioner)
any step ─▶ failed (no longer legal when processed, e.g. a player moved)
```

`proposeTrade`, `respondTrade`, `withdrawTrade`, `reviewTrade`, `processTrade`, `endReviewPeriod`, `expireOffers`.
Every step is posted to the two managers' DM; review and outcome go to the league chat. AI managers answer offers with
`botTradeVerdict` (accept if they gain enough projected value, varying by persona) and, at some week ends, offer you
trades or trade with each other (`botTradeActivity`). Details: [CHAT.md](CHAT.md).

### Chat

`engine/chat.ts`: one league channel plus a DM channel per pair (`dmChannel(a, b)`). Messages are text or **events**
(`ChatEvent`: league created, draft complete, add/drop, waivers, trade stages, week result, playoffs set, champion).
The engine posts events through `say()` in `league.ts`. "Seen" receipts are a per-member, per-channel read cursor
(`reads[channel][member] = { id, at }`), which is how a chat backend would store them too.

## 8. The simulation loop

`playNext(d, l)` plays one IPL match. **Order matters:**

1. `endReviewPeriod`: accepted trades still in review are processed.
2. `autoSubs` for this match.
3. `l.played++`.
4. If that was the week's last match, `endWeek`:
   1. scores each starter's counted match, stores `results[week]` (with `counted`), clears picks;
   2. posts the week result to chat; seeds playoffs after week 6, sets the final after week 7, crowns the champion after week 8;
   3. expires unanswered offers, processes waivers (AI teams bid too);
   4. AI teams (and you, if "Auto-set weekly" is on) get their best lineup for next week;
   5. AI trade activity.

Score only exists at week end. Live numbers on screen are computed on the fly by `liveTeamScore` / `playerWeek`.

## 9. Store, persistence and UI

**`store.ts`** holds the league plus UI state (current tab, open modal ids, toast, chat channel, typing indicators).

- Every game action goes through `mutate(fn)`: `structuredClone` the league, run the engine function, `set` the copy.
- Chat-only actions use `mutateChat(fn)`, which copies only `chat`. Rosters, results etc. keep their identity, so
  memoised screens don't recompute when someone sends a message.
- Actions that can fail return an error string (or `null`); screens show it as a toast.
- `ME = 0` is "the signed-in manager". In multiplayer it becomes the account's team id.

**Persistence:** Zustand `persist` saves `{ league, tab, chatChannel }` under the `localStorage` key
`cricket-fantasy-league`. A custom storage skips the write when none of those changed (typing dots, toasts and modals
don't re-serialise the league). On load, `App.tsx` resets the league if the data version changed, otherwise runs
`upgradeLeague`.

**Reading the store in components:** select only what you need. `useApp((s) => s.league)` for state, and for several
actions `useApp(useShallow((s) => ({ a: s.a, b: s.b })))`. **Never call `useApp()` with no selector**: that
re-renders the component on every store change.

**Screens** (sidebar order) → files:

| Screen | File | Notes |
|---|---|---|
| Matchup (home) | `views/MatchupView.tsx` | swipeable carousel of the week's matchups (yours first), lineups follow; league chat docked on the right (`Conversation` in compact mode) |
| My Team | `views/TeamView.tsx` | tap-to-move lineup, `MatchPicker` per player, optimise / auto-sub / auto-set |
| Players | `views/PlayersView.tsx` | filters + sortable table; all row numbers computed once in a `useMemo` |
| Chat | `views/ChatView.tsx` | league chat + DMs; trade offer cards; read receipts; typing |
| Standings / Playoffs / IPL Fixtures / Activity / Draft Board / Scoring | `views/*View.tsx` | |
| Player card, Add/claim, Trade, Scorecard, Live match | `modals/*.tsx` | opened via store ids (`openPlayer(idx)` etc.), rendered by `App.tsx` |

**Layout breakpoints** (`styles.css`): > 1180px full sidebar; 821–1180px icon-rail sidebar; ≤ 1100px narrower chat dock;
≤ 860px chat stacks under the matchup; ≤ 820px phone layout (top nav, single-column chat with back button).
The scoreboard compacts with a container query when its slot is narrow.

**Design system:** colour tokens at the top of `styles.css` (`--turf` primary green, `--ball` red, `--gold`, `--sky`,
role colours). Fonts: Inter Variable (body), Chakra Petch (display/numbers). Icons: `lucide-react`.

## 10. AI managers (`bots.ts`)

Prototype-only stand-ins for real people. `startBots()` subscribes to the store and, through the same store actions a
person would use:

- marks messages read after short random delays (all bots catch up whenever a match is simmed);
- shows typing, then replies to your league and DM messages (keyword-based canned lines);
- reacts with emojis sometimes;
- answers your trade offers after a "thinking" delay (`botAnswerTrade` → `botTradeVerdict`);
- posts banter after each week's results.

Timers are cancelled if the league is reset. Nothing else depends on this file. **In multiplayer it is deleted.**
AI draft picks, waiver bids, lineups and trade offers are game logic and live in the engine.

## 11. Testing

`npm test` runs `app/tests/engine.test.ts` (Vitest, about 0.2s). It loads the real data files from `public/` and
plays whole seasons, so it checks rules end to end:

- full 8- and 10-team seasons complete with valid rosters and 8 results;
- every weekly score equals exactly one counted match per starter (with random lock-ins);
- auto-subs only replace players missing from the XI, with players whose counting match hasn't started;
- one-match lock-in: default, locking, freezing after the first match, switching back, weekly reset, every hindsight
  exploit blocked, invalid picks rejected;
- trade lifecycle: approve, veto, auto-approve at the next match, withdraw, decline, expiry, chat trail, deadline;
- chat unread counts / read cursors / reactions;
- a scoring edge case (no-ball + leg-byes).

The engine is random (AI picks, trades), so tests assert **invariants that must always hold**, not exact numbers.
To add a test, reuse `drafted()` (makes a drafted league) and `playSeason()`.

**Manual check after UI changes:** create a league, draft (try the pick timer and auto-draft), lock a match on My Team,
move a bench player in, add a free agent, watch a live match, sim a week (week-result + waivers in chat), send a DM
trade and approve it in the league chat, sim to the end (bracket + champion). Check a phone-width layout too.

## 12. Conventions and gotchas

- **Engine stays pure.** No React/DOM imports in `engine/`. New rules go there, with a test.
- **Line endings:** some files came from Windows and use CRLF (currently `engine/league.ts`, `store.ts`,
  `styles.css`, `ui/DraftRoom.tsx`, `ui/Setup.tsx`, `ui/modals/LiveMatch.tsx`, `ui/views/MatchupView.tsx`,
  `ui/views/PlayoffsView.tsx`, `ui/views/TeamView.tsx`, the `.bat` files and the research docs). Keep each file's
  existing style: a tool that rewrites one as LF makes the whole file show as changed. List them with
  `git ls-files | xargs grep -l $'\r$'`.
- **"This week" points/projections:** always `playerWeek()` (one counted match). There is deliberately no helper that
  sums a player's matches.
- **New league fields** need a default in `upgradeLeague()`. Changing the data shape bumps `version` (resets saves).
- **Never mutate `league` from a component.** Add a store action that calls the engine through `mutate`/`mutateChat`.
- **Selectors:** no bare `useApp()`; see section 9.
- **Constants over literals:** use `SLOTS`, `ROSTER_SIZE`, `FAAB_BUDGET`, `REG_WEEKS`, `LAST_WEEK`, `TRADE_DEADLINE_WEEK`.
- **Player names:** `name` is "V. Kohli" style (lists); `fullName` is for cards.
- **Images and licensing:** portraits are official IPL images, fine for private testing, but they need a licence
  before any public release (see `app/public/media/README.md`).
- **Lint:** `npm run lint` (oxlint) should report no warnings.

## 13. Recipes: common changes

**Change a scoring value.** Edit the calculation in `scoring.ts` (`score()`, `srBonus`, `econBonus`) *and* the
`SCORING_RULES` display table next to it. Run `npm test`. Points are computed at load, so no data rebuild is needed.

**Add a league setting** (e.g. trade review on/off for the commissioner). Add it to `LeagueSettings`, default it in
`createLeague` and `upgradeLeague`, read it in the engine, add a store action, and expose it in a settings UI.

**Add a chat event.** Add a variant to `ChatEvent` (`chat.ts`), post it with `say(d, l, channel, null, { event })`
where it happens in the engine, render it in `EventMessage` (`ui/chat/ChatCards.tsx`), and add a one-line preview in
`previewText` (`ui/chat/chatText.ts`).

**Add a screen.** Add the tab id to `Tab` in `store.ts`, an entry in `NAV` and the view switch in `Shell.tsx` (the nav
separators are index-based), and a file in `ui/views/`.

**Change the season or weeks.** Edit `SEASONS`/`SIM_SEASON` or the gameweek logic in `build_data.py`, rebuild
`ipl.json`, and check `REG_WEEKS`/`LAST_WEEK`/`TRADE_DEADLINE_WEEK` still fit. Saved leagues reset automatically
because the data version changes.

**Refresh photos or bios.** `python3 scripts/sync_player_media.py [--reuse]` (converts to WebP automatically) and
`python3 scripts/sync_player_bios.py`. Both validate identities and fail loudly rather than guessing.

## 14. Road to iPhone and multiplayer

- **iPhone (Expo/React Native):** `engine/` and most of `store.ts` move unchanged (swap `localStorage` for
  AsyncStorage); `ui/` is rebuilt with native components. Screens were built mobile-first to make that easier. Ship to
  friends with TestFlight (needs an Apple Developer account).
- **Multiplayer:** a backend (e.g. Supabase: Postgres + auth + realtime) owns the league; engine rules run on the
  server so a client can't approve its own trade; `bots.ts` is deleted; the draft room uses realtime. The chat and
  trade data model already matches how a backend would store it: see [CHAT.md](CHAT.md).
- **Live data:** a paid feed (e.g. SportMonks) replaces the Cricsheet replay; the replay clock (`played`) becomes real
  match state.

## 15. Known limitations

- Single player vs AI; the league lives in this browser's `localStorage` only.
- AI managers always count a player's first match (no smart lock-ins); their chat is canned lines.
- Roles come from stats, so some all-rounders are tagged BOWL; names are scorecard style.
- Weekly recap is a template ("AI · placeholder").
- Reactions need a mouse (hover); not available at phone width yet. No chat during the draft.
- Commissioner tools are minimal: approve/veto trades only; no settings screen yet.
- Historical replay only; no live feed. See [ROADMAP.md](ROADMAP.md).
