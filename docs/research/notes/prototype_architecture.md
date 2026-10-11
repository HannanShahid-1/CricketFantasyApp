# Prototype Architecture and Build Plan: Local-First, Sleeper-Style, Season-Long H2H IPL Fantasy Cricket App (Windows 11, Cricsheet Replay)

Research date: 2026-10-11. About 17 tool calls. Primary sources: Sleeper API docs, Cricsheet docs, Docker docs, MDN, DraftFantasy docs, Sleeper support pages, and GitHub repos. A lot of the architecture guidance below is engineering judgment. It is marked under "Inferences" and has no external citation.

---

## 1. Open-source fantasy platforms and clones to learn from (and their stacks)

### Takeaway
No mature open-source "Sleeper clone" covers draft, FAAB waivers, H2H matchups and live scoring all at once. The open-source landscape is a set of partial references: Rails/Elixir/PHP league managers with simple waivers, PHP draft boards, many read-only Sleeper API tools, and Python Cricsheet ingestion and analytics tools. Treat them as pattern references, not as codebases to fork.

### Cited Findings
- **cantonyselim/fantasy-league**: an open-source NFL fantasy app with head-to-head fixtures ranking and a waiver wire that runs once per game-week. Waiver priority is based on the previous week's score. It supports up to 8 users and an 18-player squad split into Active and Benched. License EPL-1.0. — [GitHub](https://github.com/cantonyselim/fantasy-league) (via search summary)
- **ishakir/shakitz-fantasy-football**: a near-identical Rails implementation with H2H ranking, a weekly waiver wire and a "Smack Board". — [GitHub](https://github.com/ishakir/shakitz-fantasy-football) (via search summary)
- **axelclark/ex338**: an Elixir/Phoenix app that runs a fantasy league where you pick teams, not players. "The draft, waivers, and trades are accomplished through the website." — [GitHub](https://github.com/axelclark/ex338); [Elixir Forum](https://elixirforum.com/t/ex338-web-app-to-manage-a-fantasy-sports-league/2063)
- **lukasdotcom/fantasy-manager**: a self-hosted, open-source fantasy manager focused on soccer (Bundesliga, EPL, custom plugins). Search results did not confirm H2H or waivers. — [GitHub](https://github.com/lukasdotcom/fantasy-manager)
- **phpdraft (Hoot Draft)**: a web draft board with real-time updates across devices, customizable pick timers and in-draft trades. It supports NFL/NBA/MLB/NHL/Super 15 rugby. Stack: PHP 7.1+, MySQL 5.6+, and a Gulp/Babel/Yarn JS build. License GPL-3.0. The README does not name its real-time transport (polling vs. WebSockets). — [GitHub TheAceMan/phpdraft](https://github.com/TheAceMan/phpdraft)
- **anacronw/fantasy-auction**: a single-auction draft web app where the admin nominates a player and it is pushed to all devices (push-to-all pattern). — [GitHub](https://github.com/anacronw/fantasy-auction)
- **DraftRes**: a fantasy soccer draft room on ResilientDB (Apache 2.0) with a serpentine draft order and real-time pick broadcast. — [GitHub](https://github.com/swatisinghvi99/DraftRes)
- **Sleeper API tools, all read-only**: dylstockard/sleeper-fantasy-football (Next.js App Router + TypeScript + Tailwind; shows standings and FAAB budgets) — [GitHub](https://github.com/dylstockard/sleeper-fantasy-football). tkforgeworks/lazy-sleeper (Python backend + Flutter client + Supabase Postgres) — [GitHub](https://github.com/tkforgeworks/lazy-sleeper). yidinghou/sleeper_draft_tool PR #6 adds a local FAAB waiver-resolution simulator (highest bid wins, drop requirements) — [GitHub PR](https://github.com/yidinghou/sleeper_draft_tool/pull/6).
- **Cricket and Cricsheet projects**: CricCatapult is a Python package that downloads IPL data from Cricsheet and builds batting and bowling features — [docs](https://criccatapult.readthedocs.io/en/latest/). cricket-mcp (mavaali) loads the full Cricsheet archive (~21k matches) into local DuckDB via Node.js `npm run ingest` (search summary; [glama listing](https://glama.ai/mcp/servers/ltv07htydo)). Best11-Fantasycricket (HackerSpace-PESU) uses a linear model on each player's last-5-game scores to pick a DFS XI; it may not use Cricsheet — [GitHub](https://github.com/HackerSpace-PESU/Best11-Fantasycricket). machina-sports sports-skills notes that Cricsheet covers only completed matches, with about a 1-day lag — [listing](https://skillselion.com/skills/machina-sports/sports-skills/cricket-data).
- **Twilio's archived 2012 draft room** ran on Node (Nodejitsu) + Redis (RedisToGo) + Twilio Client. It is an early example of Node + Redis pub/sub for drafts. — [Twilio blog archive](https://www.twilio.com/en-us/blog/archive/2012/cloud-powered-trash-talking-for-your-fantasy-draft-html)
- **Sleeper's own stack is not publicly documented** in anything I found. A 2026 job posting lists "Elixir, Go, Java, Python, Rust, Node, or similar" as acceptable backend languages. It describes needing to "ingest live stat feeds and deliver every change to millions of rosters" and mentions "data modeling, caching, queues". — [General Catalyst job board](https://jobs.generalcatalyst.com/companies/sleeper-2/jobs/93362540-senior-staff-software-engineer-backend-fantasy-sports)

### Inferences
- The stacks seen are Rails, Phoenix/Elixir, PHP/MySQL, Next.js/TS and Python/Supabase. Nothing in OSS is a de facto standard, so pick for team velocity.
- The most reusable OSS ideas are: the weekly waiver wire with priority (shakitz/fantasy-league), the server-pushed draft board with pick timers (phpdraft, fantasy-auction), and Cricsheet → DuckDB/Postgres ingestion (cricket-mcp, CricCatapult).
- The draft room, FAAB processor, cricket scoring engine and replay simulator will have to be written from scratch. These are the parts where the project's own value lies.

### Gaps
- Could not confirm phpdraft's real-time mechanism, or the current maintenance status and license details of most repos.
- Found no Sleeper or ESPN engineering blog posts about their architecture. A search on "Sleeper engineering blog Elixir" returned only job listings.
- Found no open-source season-long (non-DFS) cricket fantasy league manager.

---

## 2. Sleeper public API data model (schema reference)

### Takeaway
Sleeper's read-only v1 API (`https://api.sleeper.app/v1`) is a clean, battle-tested schema to copy. The key ideas are: a league holds settings, scoring_settings and roster_positions; a roster has `players`, `starters` and `reserve` arrays plus win/loss/FAAB counters; matchups are rows per roster per week paired by `matchup_id`; transactions are a single polymorphic table (`adds`/`drops` maps, `waiver_budget`, `settings.waiver_bid`); a draft has `slot_to_roster_id`; picks carry `pick_no`/`round`/`draft_slot`.

### Cited Findings (all from [Sleeper API docs](https://docs.sleeper.com/))
- **General**: read-only, no auth, free for non-commercial use (commercial use needs a license). Stay under 1000 calls/min or risk an IP block.
- **User**: `user_id`, `username`, `display_name`, `avatar`. Usernames can change, so key on `user_id`.
- **League** (`GET /league/<league_id>`, `GET /user/<user_id>/leagues/<sport>/<season>`): `league_id`, `name`, `season`, `season_type`, `sport`, `avatar`, `status` (`pre_draft` | `drafting` | `in_season` | `complete`), `total_rosters`, `settings` (object), `scoring_settings` (object), `roster_positions` (array), `draft_id`, `previous_league_id` (links seasons, for dynasty/keeper chains).
- **League users** (`/league/<id>/users`): `user_id`, `username`, `display_name`, `avatar`, `metadata.team_name`, `is_owner` (commissioner flag; there can be several).
- **Rosters** (`/league/<id>/rosters`): `roster_id` (small int within league), `owner_id`, `league_id`, `players` (all player IDs), `starters` (ordered starting IDs), `reserve` (IR), and `settings` = {`wins`, `losses`, `ties`, `fpts`, `fpts_decimal`, `fpts_against`, `fpts_against_decimal`, `waiver_position`, `waiver_budget_used`, `total_moves`}.
- **Matchups** (`/league/<id>/matchups/<week>`): one row per roster with `roster_id`, `matchup_id` (rows sharing it play each other), `points`, `custom_points` (commissioner override), `starters` (ordered), `players`. Bench = `players` − `starters`.
- **Playoff brackets** (`/winners_bracket`, `/losers_bracket`): rows with `r` (round), `m` (match id), `t1`/`t2` (roster_id or `{w: m}`/`{l: m}` references), `t1_from`/`t2_from`, `w`, `l`, and `p` (shown in examples, not documented).
- **Transactions** (`/league/<id>/transactions/<round>`): `transaction_id`, `type` (`trade`, `free_agent`, `waiver`), `status`, `status_updated`, `created`, `creator`, `roster_ids`, `consenter_ids`, `adds` {player_id: roster_id}, `drops` {player_id: roster_id}, `draft_picks` [{season, round, roster_id, previous_owner_id, owner_id}], `waiver_budget` [{sender, receiver, amount}], `settings` (e.g. `{"waiver_bid": 44}`), `metadata` (e.g. why a waiver failed), `leg` (week).
- **Traded picks** (`/league/<id>/traded_picks`): `season`, `round`, `roster_id` (original owner), `previous_owner_id`, `owner_id`.
- **State** (`/state/<sport>`): `week`, `season_type`, `season_start_date`, `season`, `previous_season`, `leg`, `league_season`, `league_create_season`, `display_week`.
- **Drafts** (`/draft/<draft_id>`, `/league/<id>/drafts`): `draft_id`, `league_id`, `type` (e.g. `snake`), `status`, `start_time`, `sport`, `season`, `season_type`, `created`, `creators`, `settings` {`teams`, `rounds`, `pick_timer`, `slots_qb`, `slots_wr`, ..., `slots_bn`}, `metadata` {`name`, `scoring_type`, `description`}, `draft_order` {user_id: slot}, `slot_to_roster_id` {slot: roster_id}, `last_picked`, `last_message_time`, `last_message_id`.
- **Draft picks** (`/draft/<id>/picks`): `pick_no`, `round`, `draft_slot`, `picked_by` (user_id, may be empty for autopick/CPU), `roster_id`, `player_id`, `is_keeper`, `draft_id`, `metadata` {team, position, first_name, last_name, ...}.
- **Players** (`/players/<sport>`): `player_id`, `first_name`, `last_name`, `position`, `fantasy_positions` (array, which means multi-eligibility), `team`, `status`, `injury_status`, `age`, `years_exp`, `depth_chart_order`, `search_full_name`, and external IDs (`espn_id`, `yahoo_id`). The full map is about 5 MB; fetch it at most once per day and cache it.
- **Trending** (`/players/<sport>/trending/add|drop?lookback_hours=&limit=`): `player_id`, `count`.

### Inferences
- Copy these Sleeper patterns directly: (a) a per-league `roster_id` int separate from `user_id`, so ownership can transfer; (b) `scoring_settings` as a flat key→points map; (c) `roster_positions` as an ordered array of slot codes (for IPL, e.g. `["WK","BAT","BAT","BAT","BAT","BOWL","BOWL","BOWL","BOWL","FLEX","FLEX","BN","BN",...]`); (d) `fantasy_positions` arrays for dual eligibility (WK-batters, all-rounders); (e) one polymorphic `transactions` table with JSON adds/drops; (f) matchup rows per roster per week joined by `matchup_id`; (g) `previous_league_id` for season chaining; (h) a `/state` endpoint that the replay simulator drives.
- Store `starters` as an ordered array aligned to `roster_positions`. Validate it on write against slot eligibility.

### Gaps
- The docs do not enumerate keys inside league `settings` or `scoring_settings`. The NFL field names (e.g. `waiver_type`, `waiver_budget`, `playoff_week_start`) were not confirmed in this session.
- Sleeper does not publicly document write APIs (draft pick submission, waiver claims, lineup set).

---

## 3. Recommended stack for a local prototype that can graduate to production

### Takeaway
Recommendation: a **TypeScript monorepo**. Next.js (web) + a Node API service (Fastify or NestJS) + **PostgreSQL** from day one + a Postgres-backed job queue (pg-boss or Graphile Worker) + **WebSockets** for the draft room and **SSE** (or the same socket) for live scoring. Add a Python sidecar only for Cricsheet ingestion and analytics, and add Expo/React Native later, sharing TS types. A Python/FastAPI-only stack is also viable if the team is Python-first. Avoid SQLite as the primary DB because concurrency and locking semantics differ from production.

### Cited Findings
- Postgres `SKIP LOCKED` lets several workers consume a queue-like table without lock contention. This is the basis of the pg-boss and Graphile Worker job libraries. — [mfyz.com](https://mfyz.com/durable-queue-workers-with-just-postgres/); [env.dev](https://env.dev/guides/postgres-as-a-queue)
- pg-boss (Node) feature claims: exactly-once delivery, enqueueing within your existing DB transaction, cron scheduling, priority queues, dead-letter queues, deferral, and retries with backoff. — [npm pg-boss](https://npmjs.com/package/pg-boss); [README](https://cdn.jsdelivr.net/gh/timgit/pg-boss@master/README.md)
- Graphile Worker's stated goal is to "keep your infrastructure simple". It uses LISTEN/NOTIFY for low latency and de-duplicates by job key. Throughput claims (~10k jobs/s) are vendor-style and unverified. — [Graphile Worker docs](https://worker.graphile.org/docs)
- Enqueueing inside the same transaction as the data change avoids the dual-write problem that an external broker has. — [env.dev](https://env.dev/guides/postgres-as-a-queue)
- SSE is one-way, server to client only. Over HTTP/1.x browsers allow only ~6 connections per browser+domain; HTTP/2 negotiates ~100 streams. It reconnects automatically, and the `id`/`retry` fields let a client resume (via `Last-Event-ID`). — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- Supabase (hosted Postgres) is used by at least one Sleeper-adjacent OSS tool (lazy-sleeper), and Next.js + TS by another (dylstockard). — [lazy-sleeper](https://github.com/tkforgeworks/lazy-sleeper); [dylstockard](https://github.com/dylstockard/sleeper-fantasy-football)
- Sleeper's job postings accept Elixir/Go/Java/Python/Rust/Node and stress caching, queues and fan-out of live stat changes to rosters. — [job posting](https://jobs.generalcatalyst.com/companies/sleeper-2/jobs/93362540-senior-staff-software-engineer-backend-fantasy-sports)

### Inferences (opinionated; no external citation)
- **Option A, recommended: TS full stack.** pnpm/Turborepo monorepo with these packages:
  - `apps/web`: Next.js + Tailwind.
  - `apps/api`: Fastify (lighter) or NestJS (more structure) + Socket.IO or `ws`.
  - `apps/worker`: pg-boss jobs for waivers, lineup locks, draft autopick, and the replay clock.
  - `packages/domain`: pure TS scoring, waiver and draft logic with no I/O, unit-tested.
  - `packages/db`: Drizzle or Prisma schema and migrations.
  - `apps/mobile`: added later; Expo reuses `packages/domain` and the types.
  - Pros: one language, shared types for web, mobile and server, and a strong real-time ecosystem.
  - Cons: Cricsheet analytics are nicer in Python. Mitigate with a one-off Python or DuckDB ingest script that writes to Postgres.
- **Option B: Python FastAPI + Postgres + Procrastinate/APScheduler/ARQ + a separate Next.js or Expo frontend.** Pros: pandas/DuckDB for Cricsheet, and the scoring engine and simulator in the same language. Cons: two languages, types not shared with the frontend, and FastAPI WebSockets need Redis pub/sub once there is more than one process.
- **Option C: Elixir/Phoenix (Channels + LiveView + Oban).** Phoenix Channels/PubSub and Oban are an excellent fit for drafts and live scoring (ex338 is a fantasy precedent). Cons: hiring and learning curve, and weaker sharing with a React Native mobile app.
- **Postgres vs SQLite.** Use Postgres locally too (Docker or native Windows installer). Draft pick and waiver concurrency rely on row locks (`SELECT ... FOR UPDATE`), advisory locks, `SKIP LOCKED` queues and LISTEN/NOTIFY, none of which exist in SQLite. SQLite or DuckDB is fine for the *read-only Cricsheet analytics cache*.
- **Real-time.** Use WebSockets (Socket.IO rooms keyed by `draft:{id}` and `league:{id}`) for the draft room, since it needs bidirectional messages: pick, queue update, chat. SSE is adequate for live scoring and matchup tickers. A single Socket.IO connection carrying both is simplest to start. To scale beyond one process later, add a Redis adapter, or use Postgres LISTEN/NOTIFY as the fan-out bus at prototype scale.
- **Scheduler.** Use pg-boss cron for "process waivers", "lock lineups at match start" and "finalize gameweek". In simulation mode these are driven by a **virtual clock**, not wall time (see section 6).
- **Mobile path.** Expo (React Native) app consuming the same REST and socket API. Keep the domain logic in a shared TS package so lineup validation is identical on the client.
- **Graduation path.** Managed Postgres (Supabase/Neon/RDS), API and worker containers on Fly.io/Render/ECS, Redis for socket fan-out, and a real live-data provider adapter that replaces the Cricsheet replay adapter behind the same `BallEvent` interface.

### Gaps
- No benchmark or primary source compares Socket.IO vs. raw WS vs. SSE for fantasy workloads.
- Procrastinate (the Python Postgres queue) was not covered by search results.
- Licensing of commercial live IPL data feeds for production was not researched; it is out of scope here but is a key production dependency.

---

## 4. Data model for cricket fantasy

### Takeaway
Model three layers. (1) **Reference/ingest**: Cricsheet people, teams, seasons, matches and deliveries. (2) **Derived stats**: a per-match player stat line computed from deliveries. (3) **Fantasy**: league, settings JSON, rosters with slot-ordered starters, draft, picks, transactions, waiver claims, matchups and standings. Fantasy points are a pure function of `(stat_line, league.scoring_settings)` and are recomputed on demand.

### Cited Findings
- **Cricsheet JSON** top-level keys are `meta` (`data_version`, `created`, `revision`), `info` and `innings`. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- **`info`** includes `dates[]`, `event` {`name`, `match_number`, `group`, `stage`}, `teams`, `players` (per-team squad list), `registry.people` (name → 8-char Cricsheet ID) and `registry.venues`, `toss` {`decision`, `winner`}, `outcome` {`winner`, `by` {runs|wickets|innings}, `method` (e.g. D/L), `result` (e.g. no result/tie), `eliminator`, `bowl_out`}, `venue`, `city`, `season`, `match_type`, `overs`, `balls_per_over`, `player_of_match`, `officials`, `gender`, `team_type`, `supersubs`, `missing`. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- **Each innings**: `team`, `overs[]` {`over`, `deliveries[]`}, `powerplays[]` {from, to, type}, `target` {overs, runs}, `super_over` (bool), `absent_hurt`, `penalty_runs`, `declared`, `forfeited`, `miscounted_overs`. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- **Each delivery**: `batter`, `bowler`, `non_striker`, `runs` {`batter`, `extras`, `total`, `non_boundary`}, `extras` {`wides`, `noballs`, `byes`, `legbyes`, `penalty`}, `wickets[]` {`kind`, `player_out`, `fielders[]` {`name`}}, `replacements` {`match`, `role`}, `review`. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- **Wicket kinds**: bowled, caught, caught and bowled, lbw, stumped, run out, retired hurt, hit wicket, obstructing the field, hit the ball twice, handled the ball, timed out. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- **IPL downloads**: `ipl_json.zip` and `ipl_male_json.zip` (plus YAML). The downloads page listed 1,243 IPL matches when fetched. — [Cricsheet downloads](https://cricsheet.org/downloads/)
- **Cricsheet Register**: `people.csv` (18,623 people; columns `identifier`, `name`, `unique_name`, and `key_*` cross-IDs incl. `key_cricinfo`, `key_bcci`, `key_cricbuzz`, etc.), `names.csv` (variant spellings), `venues.csv` and `venue_names.csv`. Licensed under the Open Data Commons Attribution License. — [Cricsheet Register](https://cricsheet.org/register/)
- **IPL Impact Player rule**: each team names an XI plus 4 substitutes; one sub may enter before the 14th over, in any role. The impact player may bowl at most 4 overs, and the replaced player takes no further part. — [Scroll.in](https://scroll.in/field/1046219/impact-player-at-ipl-2023-all-you-need-to-know-about-the-new-rule-in-indian-premier-league); [Wisden](https://www.wisden.com/series/indian-premier-league-2023/cricket-news/explained-ipl-impact-player-the-substitution-system-that-will-debut-in-ipl-2023)
- **Typical T20 fantasy scoring** (Dream11-style; sources conflict on details):
  - Batting: 1/run, +1 per four, +2 per six; milestones 30/50/100 = +4/+8/+16; duck −2 (some sources say −3).
  - Bowling: 25 per wicket excluding run-outs, +8 for LBW/bowled; 3/4/5-wicket hauls +4/+8/+16.
  - Fielding: catch 8, stumping or direct run-out 12, shared run-out 6 each.
  - Economy and strike-rate brackets with minimum overs/balls (the bracket thresholds conflict across sources).
  - Captain 2x, vice-captain 1.5x, playing XI +4.
  - — [Sportskeeda](https://www.sportskeeda.com/cricket/dream11-points-system); [possible11](https://possible11.com/blog/fantasy-cricket-points-math-captain-and-vice-captain-rules/). The ICC's Classic mode uses a different scale (wicket 12, catch 4). — [ICC](https://www.icc-cricket.com/news/handbook-for-classic-mode)

### Inferences: proposed schema (Postgres; ✱ = JSONB)

**Reference / ingest**
- `person(id PK = cricsheet identifier, name, unique_name, key_cricinfo, key_bcci, ...)`
- `ipl_team(id, name, short_code)`, plus `team_alias(name → team_id)` to handle franchise renames (e.g. Delhi Daredevils→Capitals, Kings XI→Punjab Kings).
- `season(id, year, label)`
- `match(id = cricsheet file id, season_id, match_number, stage, start_date, start_time_utc✱ (synthesize if missing), venue, team1_id, team2_id, toss_winner_id, toss_decision, winner_id, result, method, player_of_match_id, raw_info✱)`
- `match_squad(match_id, team_id, person_id, is_playing_xi, is_impact_sub)`. The XI is derived from `info.players` and `replacements`.
- `delivery(match_id, innings_no, over, ball_seq, legal_ball_no, batting_team_id, batter_id, bowler_id, non_striker_id, runs_batter, runs_extras, runs_total, wides, noballs, byes, legbyes, penalty, is_four, is_six, wicket_kind, player_out_id, fielder_ids[], is_super_over, PK(match_id, innings_no, over, ball_seq))`. There are about 250 rows per match, so a full IPL history is roughly 300k rows, which is trivially small.

**Derived**
- `player_match_stats(match_id, person_id, team_id, runs, balls_faced, fours, sixes, dismissed, dismissal_kind, overs_bowled_balls, runs_conceded, wickets, lbw_bowled_wkts, maidens, dots, catches, stumpings, runouts_direct, runouts_indirect, in_xi, is_impact_sub, updated_at_ball)`. It is updated incrementally during replay.
- `player_season(person_id, season_id, ipl_team_id, fantasy_positions text[] e.g. {'WK','BAT'}, primary_role, adp, projected_pts)`. Roles are not in Cricsheet: derive them heuristically (balls bowled per match, stumpings → WK) or hand-curate. This is a known gap.

**Calendar**
- `gameweek(id, season_id, number, starts_at, ends_at, lock_mode)`
- `gameweek_match(gameweek_id, match_id)`

**Fantasy**
- `app_user(id, username, display_name, is_bot, bot_strategy✱)`
- `league(id, name, season_id, status pre_draft|drafting|in_season|playoffs|complete, total_rosters, settings✱, scoring_settings✱, roster_positions text[], previous_league_id, sim_clock_id)`
- `league_member(league_id, user_id, is_commissioner, team_name)`
- `roster(id, league_id, roster_no smallint, owner_user_id, players text[], reserve text[], waiver_position, faab_budget_used, wins, losses, ties, fpts, fpts_against)`
- `lineup(roster_id, gameweek_id, slot_index, slot_code, player_id, locked_at, PK(roster_id, gameweek_id, slot_index))`. Lineups are per gameweek with per-slot lock timestamps; this is the cricket-specific change from Sleeper's flat `starters` array.
- `draft(id, league_id, type snake|linear|auction, status, rounds, pick_timer_sec, slot_to_roster✱, current_pick_no, current_pick_deadline, version int)`
- `draft_pick(draft_id, pick_no, round, draft_slot, roster_id, player_id NULL, picked_by_user_id, is_autopick, picked_at, UNIQUE(draft_id, player_id), PK(draft_id, pick_no))`
- `draft_queue(draft_id, roster_id, rank, player_id)`
- `transaction(id, league_id, type waiver|free_agent|trade|commissioner, status pending|complete|failed|vetoed, gameweek_id, roster_ids int[], adds✱, drops✱, faab_bid, waiver_budget✱, metadata✱, created_at, processed_at)`
- `waiver_claim(id, league_id, roster_id, add_player_id, drop_player_id, bid, user_rank, status, fail_reason, process_run_id)`
- `trade_offer(id, ..., status proposed|accepted|rejected|countered|vetoed, review_until)`
- `matchup(league_id, gameweek_id, roster_id, matchup_id, points numeric, custom_points, PK(league_id, gameweek_id, roster_id))`
- `player_points(league_id, match_id, person_id, points, breakdown✱)`. This is a cache that can be rebuilt from stats and scoring.

**Scoring settings JSON (example keys)**

```json
{
  "bat_run": 1, "bat_four": 1, "bat_six": 2,
  "bat_30": 4, "bat_50": 8, "bat_100": 16, "bat_duck": -2,
  "bowl_wkt": 25, "bowl_wkt_lbw_bowled": 8,
  "bowl_3w": 4, "bowl_4w": 8, "bowl_5w": 16, "bowl_maiden": 12,
  "field_catch": 8, "field_stump": 12, "field_ro_direct": 12, "field_ro_indirect": 6,
  "playing_xi": 4,
  "econ_brackets": [{"max": 5, "pts": 6}, "..."], "econ_min_balls": 12,
  "sr_brackets": ["..."], "sr_min_balls": 10,
  "captain_mult": 1
}
```

Keep the bracket rules as arrays so leagues can edit them. Version the scoring config, and make the scoring engine a pure function.

- **Roster positions**: `["WK","BAT","BAT","BAT","BAT","BOWL","BOWL","BOWL","BOWL","FLEX","FLEX","BN"×N, "IR"?]`. Eligibility: WK slot needs `WK ∈ fantasy_positions`; BAT accepts BAT or WK; BOWL accepts BOWL; FLEX accepts any role, including all-rounders. Decide whether an all-rounder gets {BAT, BOWL} eligibility.
- **Impact player handling**: count points only if the player actually participated (in the XI or entered as impact sub). Decide whether "playing XI +4" applies to impact subs.

### Gaps
- Cricsheet does not provide player roles (BAT/BOWL/WK/AR) or exact match start times. Some data only has dates; start time must be synthesized (e.g. 15:30/19:30 IST per IPL double-header convention — [iplt20.com via search](https://www.iplt20.com/news/article/bcci-announces-schedule-for-tata-ipl-2025)).
- The exact Cricsheet representation of impact-player substitutions (`replacements.match` content, and whether the impact sub appears in `info.players`) was not verified. Check it against a 2023+ IPL file.
- No single authoritative Dream11 or IPL-official scoring table was found; sources conflict on economy and strike-rate brackets and the duck penalty.

---

## 5. Live draft room implementation patterns

### Takeaway
Use a server-authoritative state machine in Postgres. The current pick number and deadline are stored on the `draft` row. Picks are validated in a transaction that locks the draft row (or an advisory lock per draft), with a UNIQUE(draft_id, player_id) safety net and an optimistic `version`. A durable delayed job enforces the pick timer and triggers autopick from the user's queue, then ADP. Every state change is broadcast to a socket room, and clients render the timer from the server's deadline timestamp.

### Cited Findings
- Sleeper's draft object exposes `type` (snake), `settings.pick_timer`, `draft_order`, `slot_to_roster_id`, `last_picked`, and picks with `pick_no`/`round`/`draft_slot`/`picked_by` (empty for some picks). — [Sleeper API docs](https://docs.sleeper.com/)
- phpdraft advertises customizable pick timers, a live board across devices, and in-draft trades. — [phpdraft](https://github.com/TheAceMan/phpdraft)
- fantasy-auction pushes nominations to all devices (broadcast pattern); DraftRes broadcasts serpentine picks in real time. — [fantasy-auction](https://github.com/anacronw/fantasy-auction); [DraftRes](https://github.com/swatisinghvi99/DraftRes)
- pg-boss supports deferred jobs and enqueueing inside a DB transaction, so a pick and its next-deadline job commit atomically. — [pg-boss npm](https://npmjs.com/package/pg-boss)

### Inferences (pattern; pseudo-code)

```
makePick(draftId, rosterId, playerId, actor, expectedPickNo):
  BEGIN
    d = SELECT * FROM draft WHERE id=draftId FOR UPDATE          -- serialize per draft
    assert d.status = 'drafting'
    assert d.current_pick_no = expectedPickNo                     -- reject stale/double clicks
    assert slotOwner(d, d.current_pick_no) = rosterId OR actor = 'system'
    assert player not drafted (UNIQUE constraint also guards)
    assert roster limits OK (e.g. max per position, if enforced)
    INSERT draft_pick(...)
    d.current_pick_no += 1; d.version += 1
    d.current_pick_deadline = now_virtual() + d.pick_timer_sec
    if d.current_pick_no > teams*rounds: d.status='complete'; materialize rosters
    UPDATE draft ...
    enqueue job 'draft.timeout' {draftId, pickNo: d.current_pick_no} startAfter=deadline  (same tx)
  COMMIT
  publish to room draft:{id}: {type:'pick', pick, next_pick_no, deadline, version}

on job 'draft.timeout'(draftId, pickNo):
  if draft.current_pick_no != pickNo: return          -- pick already made; idempotent no-op
  player = first available from draft_queue[roster] else best ADP that fits roster needs
  makePick(draftId, roster, player, actor='system', expectedPickNo=pickNo)
  optionally flag roster as "autodraft on" after N consecutive timeouts
```

- **Snake slot owner**: `round = ceil(pick_no/teams)`; `idx = (pick_no-1) % teams`; `slot = round odd ? idx+1 : teams-idx`; then `roster = slot_to_roster[slot]`.
- **Client sync**: on (re)connect, the client fetches a full snapshot (`draft` + all picks + version) and then applies socket deltas, discarding any delta whose version is ≤ the snapshot version. The timer is displayed as `deadline - serverNowOffset`.
- **Bots**: bot managers are rosters whose owner `is_bot`. The timeout handler, or an immediate job with a small simulated "think time", picks for them using their strategy.
- **Pause/resume**: store `paused_remaining_ms`. On resume, recompute the deadline and enqueue a new timeout. Old timeout jobs no-op through the pickNo check.
- **Single-process prototype**: Socket.IO in-process is enough. With multiple API instances, add the Redis adapter or Postgres LISTEN/NOTIFY.

### Gaps
- Found no public write-up of how Sleeper or ESPN implement draft concurrency or timers.

---

## 6. Simulation engine (Cricsheet replay, gameweeks, bots, determinism)

### Takeaway
Build a **virtual clock** service that owns "now" for the whole app. Map a historical IPL season's matches onto that clock with a configurable speed-up. Emit each delivery as a `BallEvent` at its scheduled virtual time, update `player_match_stats` and fantasy points incrementally, and broadcast deltas. Every scheduled behaviour (locks, waivers, draft timers, gameweek finalization) reads the virtual clock. With seeded bots and ordered event processing, the whole season is reproducible.

### Cited Findings
- Cricsheet provides complete ball-by-ball IPL JSON (1,243 matches at time of fetch), with `info.dates`, `event.match_number`, `event.stage`, `toss` and per-delivery detail. — [Cricsheet downloads](https://cricsheet.org/downloads/); [JSON format](https://cricsheet.org/format/json/)
- Cricsheet data covers completed matches only (about 1-day lag), so it is suited to replay, not live production. — [sports-skills listing](https://skillselion.com/skills/machina-sports/sports-skills/cricket-data)
- **IPL 2025 structure**: 74 matches, 10 teams, 13 venues, 12 double-headers (15:30 and 19:30 IST starts), originally 22 March–25 May. — [iplt20.com via search](https://www.iplt20.com/news/article/bcci-announces-schedule-for-tata-ipl-2025); [dtnext](https://www.dtnext.in/news/sports/ipl-2025-kkr-and-rcb-to-play-tournament-opener-at-eden-gardens-on-march-22-823245)
- IPL 2025 was suspended for about a week amid India–Pakistan tensions. It resumed 17 May, the league stage ended 27 May, and the final moved to 3 June in Ahmedabad (RCB beat PBKS by 6 runs). — [Cricket Pakistan](https://cricketpakistan.com.pk/en/news/detail/ipl-2025-rcb-end-18-year-wait-to-win-maiden-title-with-victory-over-pb); [Onmanorama](https://www.onmanorama.com/sports/cricket/2025/06/03/ipl-2025-final-punjab-kings-vs-rcb.amp.html)

### Inferences (design)
- **Virtual clock**: `sim_clock(id, real_anchor, virtual_anchor, speed, paused)`, with `virtualNow = virtual_anchor + (realNow - real_anchor) * speed`. Expose admin controls: play, pause, set speed (1x, 60x, 600x, "instant"), and jump to the next event. A replay of a ~3.5-hour T20 at 60x takes about 3.5 minutes. In "instant" mode, process events as fast as possible for regression tests.
- **Event schedule**: for each match, `match_start = date + synthetic start time` (15:30 or 19:30 IST for double-headers, else 19:30). Toss at T−30 min. Innings 1 balls are spread evenly over ~95 min, then a ~20-min break, then innings 2. There is no ball timestamp in Cricsheet, so use even spacing per legal ball plus small jitter from a seeded RNG.
- **Pipeline**: replayer emits `BallEvent{match_id, innings, over, ball_seq, payload}` → stat accumulator updates `player_match_stats` in one transaction per ball → points recalculated for affected players across leagues → matchup totals updated → `league:{id}` room receives `{player_id, delta, match_id, ball}`. At prototype scale this is cheap: ~240 balls × a few leagues.
- **Adapter interface**: define `LiveFeed` with `ReplayFeed` (Cricsheet) now and a `ProviderFeed` later. The rest of the system never knows which feed is active, which is the graduation path to real data.
- **Gameweek generation**: sort the season's matches by date and cut them into weekly windows (e.g. Mon–Sun virtual weeks, giving ~9–10 weeks for 70 league matches). Alternatively chunk by a target of ~7–8 matches per gameweek so most teams play about 1–2 times. Keep the IPL playoffs as fantasy-playoff weeks, or exclude them, since only 4 IPL teams play. Make this a configurable generator that writes `gameweek` and `gameweek_match`. A rescheduled season such as 2025 (suspension) shows why gameweeks should be generated from actual match dates, not an assumed calendar.
- **Bots**: `bot_strategy` JSON, for example:
  - `{draft: "adp_with_noise", noise_sd: 3, positional_needs: true}`
  - `{waiver: "best_available_by_recent_form", faab_aggressiveness: 0.15}`
  - `{lineup: "max_projected_with_fixture_count"}`

  ADP and projections come from the previous season's fantasy points per match (computed from Cricsheet). Each bot gets `rng = seeded(league_seed, roster_id, purpose)`.
- **Determinism**: (1) one global `league_seed`; (2) derive sub-seeds per subsystem; (3) process events in a total order (virtual_time, match_id, innings, over, ball_seq); (4) the waiver processor sorts with fully specified tiebreakers (no DB-order dependence); (5) snapshot and assert final standings in golden tests. Avoid `Math.random`/`random.random` without seeds, and avoid reading wall-clock time anywhere in the domain code.
- **Fast-forward / backfill**: support "simulate to gameweek N" by running instant mode with bots controlling all humans' rosters, so you can test mid-season UI states quickly.

### Gaps
- Cricsheet has no per-ball timestamps or exact start times, so timing is synthesized.
- How Cricsheet handles abandoned or no-result IPL matches in the 2025 season (several were washed out) was not checked; the replay must handle matches with zero deliveries.

---

## 7. Lineup lock for cricket and multi-match weeks

### Takeaway
Use **per-match (per-player) locking**: a player locks when his IPL team's match starts. Using "toss" as lock time is the cricket-native equivalent, and lineups announced at toss make it attractive. Leagues need an explicit rule for players with 0, 1, 2 or 3 matches in a gameweek. Recommended default: **sum all matches the starter plays in the gameweek**, with gameweeks constructed so match counts are fairly even. Offer "best single match" or "Lock-In"-style single-game alternatives as league settings.

### Cited Findings
- Sleeper NBA "Lock-In" mode counts one game per starter per week, chosen by the manager. A lock is permanent and pins the player to that lineup slot. Unlocked starters default to their **last** game of the week, even if it scored zero. — [FantasyPros](https://www.fantasypros.com/2023/10/sleeper-nba-lock-in-fantasy-basketball-what-is-lock-in-mode/amp/); [RotoWire](https://www.rotowire.com/basketball/article/nba-fantasy-how-to-play-sleepers-new-lock-in-mode-75705)
- DraftFantasy (soccer) locks players in a fixture at that fixture's start time, and locks lineup changes during waiver processing windows. — [DraftFantasy docs](https://docs.draftfantasy.com/essentials/waivers)
- IPL double-headers start at 15:30 and 19:30 IST, so two lock times can fall on the same day. — [iplt20.com via search](https://www.iplt20.com/news/article/bcci-announces-schedule-for-tata-ipl-2025)
- The playing XI and four substitutes are named before the first ball, and an impact sub can enter before the 14th over. — [Scroll.in](https://scroll.in/field/1046219/impact-player-at-ipl-2023-all-you-need-to-know-about-the-new-rule-in-indian-premier-league)

### Inferences (design options)
- **Lock modes** (`league.settings.lock_mode`):
  - (a) `per_match` (recommended): `lineup` slot rows lock when the occupying player's next match in that GW starts. Unlocked slots can still be changed, including swapping a bench player whose match hasn't started into a slot whose current occupant's match hasn't started. This mirrors NFL per-game locks.
  - (b) `gameweek`: the whole lineup locks at the first match of the GW. This is simplest and best for the first prototype milestone.
  - (c) `daily`: re-lockable between matches, with points counted per match the player was *started* for (NBA-daily style). This is more complex.
- **Multi-match counting** (`league.settings.multi_match_rule`):
  - (1) `sum_all`: rewards teams with 2–3 fixtures. Simple, but creates fixture-count inequity, which gameweek design can mitigate.
  - (2) `best_one`: max single-match score. Lowers variance and neutralizes fixture counts, but blanks are harsh.
  - (3) `average`: per-match mean. Neutralizes fixture count, but a single match gives the same weight as a three-match average.
  - (4) `lock_in`: Sleeper-NBA style; the manager picks which match counts, defaulting to the last.
  - Recommendation: default to `sum_all` with gameweek lock for MVP, then add `per_match` lock. Keep the rule pluggable in the scoring aggregator, since it only changes how `player_points` rows roll up into matchup totals.
- **Edge cases**:
  - Non-selected (not in XI) means 0 points. Optionally auto-sub from the bench if the starter is not in the XI at toss (a cricket analogue of FPL auto-subs, good for UX).
  - Impact sub that enters counts. Optionally give "XI bonus" points only to players named in the XI.
  - Abandoned match means 0, or points up to abandonment, by league setting.
  - Players with 0 fixtures in a GW should be flagged in the UI.
- **Waiver-lock interaction**: players whose match has started should be locked from add/drop until the next waiver run (common FAAB practice). This prevents adding a player after his big score.

### Gaps
- Found no documented examples from season-long cricket fantasy products (e.g. ESPNcricinfo or IPL official season-long games) on how they handle multi-match weeks. IPL Fantasy is per-match/transfer-based, not H2H redraft.

---

## 8. Waiver processing algorithm (FAAB with tiebreakers, rolling priority)

### Takeaway
The standard approach is a blind FAAB auction, settled in a batch at a scheduled time. Process the highest bid first and pay the full bid (not second price). Break ties by waiver priority, which is rolling (the winner drops to the bottom) or reset weekly by reverse standings. Failed claims cost nothing, budgets can't go negative, $0 bids are allowed, and a claim fails if its drop player is gone or the roster would be invalid.

### Cited Findings
- **DraftFantasy**: claims are processed highest bid first; each is accepted or rejected, then the next is processed. A claim is rejected if the budget is insufficient or the squad would become invalid. Ties go to the manager higher in the waiver queue. Under **Rolling**, the queue starts in reverse draft order, a successful claimant moves to the bottom, and the order never resets. Under **Weekly Reset**, the order resets before the first processing each gameweek to reverse standings (H2H: fewer table points, then fewer total fantasy points; ties keep the existing order). Only successful claims reduce the budget; it can't go below £0; £0 bids are allowed. Pending bids can be edited or cancelled until processing. Players in a fixture go on waivers at fixture start. — [DraftFantasy docs](https://docs.draftfantasy.com/essentials/waivers)
- **Sleeper** supports FAAB, rolling waivers and reverse standings. The commissioner picks the waiver type and claim priority. The default FAAB budget is $100. Under rolling, a successful claimer drops to the bottom and everyone else moves up one. Under reverse standings, priority resets every week. — [Sleeper support](https://support.sleeper.com/en/articles/1876041-what-types-of-waivers-do-you-support); [Sleeper support (alt)](https://support.sleeper.com/en/articles/9656662-what-types-of-waivers-do-you-support)
- Sleeper records FAAB bids as `settings.waiver_bid` on the transaction, uses `metadata` for failure notes, and stores per-roster `waiver_position` and `waiver_budget_used`. — [Sleeper API docs](https://docs.sleeper.com/)
- The winner pays the full bid (e.g. bidding $17 when the next-highest is $11 costs $17). Most FAAB leagues use waiver priority as the tiebreaker. — [RotoWire](https://www.rotowire.com/football/article/fantasy-football-waiver-wire-pickups-explained-95707)
- Yahoo lets commissioners choose the tiebreak order (continual rolling, reverse standings, weekly rolling based on standings) and recommends stacking conditional claims, where a claim is voided if its drop player is already gone. — [Yahoo help](https://help.yahoo.com/kb/SLN6427.html)
- Sleeper's own FAAB tie rule was not found in its help articles. That ties go to waiver priority is an inference from general practice. — [Sleeper support](https://support.sleeper.com/en/articles/1876041-what-types-of-waivers-do-you-support)

### Inferences: pseudo-code (deterministic)

```
processWaivers(leagueId, runId, virtualNow):
  BEGIN; SELECT pg_advisory_xact_lock(hash('waivers', leagueId))
  if settings.waiver_priority == 'reverse_standings_weekly' and isFirstRunOfGameweek:
      resetPriority(order by wins asc, fpts asc, current_position asc)
  claims = pending claims for league where created_at < cutoff
  budgetLeft[r] = settings.faab_budget - roster.faab_budget_used
  awarded = {}                      # player_id -> roster
  loop:
    # Re-evaluate every iteration: rosters and priority change after each award.
    candidates = [c in claims if c.status=='pending'
                  and c.add_player not in awarded and player still free agent/on waivers]
    if empty: break
    # Pick the single highest claim globally:
    sort candidates by (
        -c.bid,                              # 1. highest bid
        priority[c.roster],                  # 2. best (lowest) waiver position
        c.user_rank,                         # 3. owner's own preference order
        c.created_at, c.id)                  # 4. fully deterministic final tiebreak
    c = candidates[0]
    fail = validate(c):
        bid > budgetLeft[c.roster]          -> 'insufficient_budget'
        c.drop_player and not on roster     -> 'drop_player_gone'   (conditional claim voided)
        drop_player locked (match started)  -> 'drop_locked'
        roster size/slot limits violated    -> 'roster_full' / 'invalid_roster'
    if fail: c.status='failed'; c.fail_reason=fail; continue
    apply: add player (and drop), budgetLeft -= bid, faab_budget_used += bid
    create transaction(type='waiver', adds, drops, faab_bid=bid, status='complete')
    awarded[c.add_player] = c.roster
    if settings.waiver_priority in ('rolling','reverse_standings_weekly'):
        move c.roster to bottom of priority; others shift up
    mark other pending claims on same add_player as 'outbid' (fail_reason='lost_to_higher_bid' / 'lost_tiebreak')
  dropped players -> waiver status until next run (waiver_clear_at)
  remaining non-waived free agents -> free_agent status (FCFS until lock)
  COMMIT; publish 'waivers_processed' to league room
```

- **Non-FAAB (priority-only) mode**: same loop. Sort by (priority, user_rank) and ignore bids. The roster at the top of the priority list gets its highest-ranked valid claim; then reorder.
- Re-evaluating the global top claim each iteration (not processing per-roster lists in fixed order) reproduces "highest bid first" semantics and keeps conditional claims correct.
- **Optional "zero-dollar min bid tiebreaker" variants**, e.g. ties broken by lower standing instead of priority, belong in `settings.faab_tiebreak` (`priority` | `reverse_standings` | `random_seeded`).
- **Schedule**: in replay mode, run waivers at a virtual time such as "day after last match of GW, 10:00 IST", plus an optional mid-GW run. Use a pg-boss cron job keyed on the virtual clock (the sim clock emits "tick" jobs, and the scheduler compares against virtualNow).
- **Testing**: table-driven unit tests for ties, budget exhaustion, a drop player already used by an earlier award, and two claims on the same player by the same roster at different bids.

### Gaps
- Sleeper's exact FAAB tie behaviour and processing time are not documented in the sources found.
- Found no open-source production-grade FAAB processor code. yidinghou's PR is a simulator only. — [PR](https://github.com/yidinghou/sleeper_draft_tool/pull/6)

---

## 9. Testing and tooling on Windows (Docker Desktop vs native vs WSL)

### Takeaway
On Windows 11, use **WSL2 (Ubuntu) as the dev environment, with the repo cloned inside the Linux filesystem**. Run Postgres (and optionally Redis) through Docker Desktop's WSL2 backend or natively inside WSL, and run Node or Python inside WSL. Bind-mounting from `C:\` (`/mnt/c`) is much slower and breaks inotify-based hot reload.

### Cited Findings
- Docker docs: keep source code and other bind-mounted data **inside the WSL filesystem** (e.g. under the Linux home directory). Mounting from `/mnt/c` "performs much worse". — [Docker Docs: WSL best practices](https://docs.docker.com/desktop/features/wsl/best-practices/)
- Containers receive inotify file-change events only when files live on the Linux filesystem, and auto-reload web workflows depend on this. — [Docker Docs](https://docs.docker.com/desktop/features/wsl/best-practices/)
- Minimum WSL 2.1.5. WSL 2.6+ (kernel ≥ 6.3) is needed for Enhanced Container Isolation. Memory, CPU and swap for the WSL VM can be capped via the WSL config. — [Docker Docs](https://docs.docker.com/desktop/features/wsl/best-practices/)

### Inferences (tooling plan)
- **Setup**: WSL2 Ubuntu + VS Code Remote-WSL. Use `docker compose` with `postgres:16/17`, an optional `redis`, and an optional `adminer`/`pgweb`. Run the app processes natively in WSL (not in containers) for the fastest reload, and containerize them only for the "prod-like" compose profile. Docker Desktop licensing: check that the team qualifies for free use (not researched here). Alternatives are Podman, or Postgres installed directly in WSL with `apt`.
- **Fully native Windows** (Node + Postgres Windows installer) also works if the team avoids WSL. The costs are path and shell differences and slower file I/O for big `node_modules`.
- **Test pyramid**:
  1. Pure-domain unit tests: scoring engine with golden Cricsheet matches (hand-verified fantasy points for 3–5 known IPL matches), waiver processor tables, snake order and draft state machine. Use Vitest or pytest.
  2. Integration tests against a real Postgres via Testcontainers or a compose test DB, covering concurrent pick races (fire 2 picks for the same slot and assert one wins) and waiver-run idempotency.
  3. Full-season deterministic simulation: 10 bot rosters, instant speed, seed S, then assert standings, transaction counts and total FAAB spent against a snapshot. This doubles as a load and regression test.
  4. E2E with Playwright for the draft room and live matchup with 2–3 browser contexts.
- **Dev tooling**: seed scripts (`ingest:cricsheet --season 2025`, `league:create --bots 9 --seed 42`, `sim:run --speed 600`); a commissioner and sim admin panel (clock controls, force waiver run, rewind to snapshot via `pg_dump` per gameweek).

### Gaps
- Did not benchmark native Windows vs WSL2 performance for Node or Python builds. Docker Desktop licensing terms for small companies were not verified in this session.

---

### Appendix: Phased build plan (inference; no external citation)
This summarizes the recommended sequence for the report writer. It is derived from the analysis above.

- **Phase 0 (Week 1): Data foundation.** Ingest Cricsheet IPL JSON and the register into Postgres. Build `delivery` → `player_match_stats`. Hand-curate or derive player roles for one season (2025 or 2024). Write the scoring engine as a pure function with golden tests.
- **Phase 1 (Weeks 2–3): League core and sim clock.** Users (local auth stub), league create with settings JSON, rosters, the gameweek generator, virtual clock, and replay feed. Add a matchup scheduler (round-robin H2H) and a standings computation. Bots auto-set lineups. The first milestone is a full season simulated in instant mode with all-bot leagues.
- **Phase 2 (Weeks 3–5): Draft room.** Snake draft state machine, WebSocket room, pick timer jobs, autopick from queue/ADP, bot drafters, and a draft board UI.
- **Phase 3 (Weeks 5–7): In-season loop.** Lineup UI with slot eligibility and lock (gameweek lock first, then per-match). Live matchup view with replay at 60–600x, SSE/socket point deltas and a ball-by-ball ticker. FA adds/drops, FAAB waivers with a scheduled processor, and a transactions feed.
- **Phase 4 (Weeks 7–9): Trades and polish.** Trade offers, review period, commissioner tools, playoffs bracket (Sleeper-style `winners_bracket`), league chat, notifications.
- **Phase 5: Productionize.** Auth (OIDC), managed Postgres, Redis socket adapter, a live data provider adapter, Expo mobile app, observability, and rate limiting.
