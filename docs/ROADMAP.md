# Roadmap

Where the prototype is and what comes next. Phases follow the plan in [the research report](research/IPL%20fantasy%20cricket%20app%20research.md).

## Done: local prototype (`app/`)

- Snake draft room with AI managers, queue, autopick and auto-draft
- 1 WK / 4 BAT / 4 BOWL / 2 FLEX + 4 bench, with primary-role + FLEX eligibility for all-rounders
- 8 Mon–Sun gameweeks: 6 regular-season weeks (head-to-head + league median), semis, final
- Per-player lock at first match of the week, auto-subs, optional auto-set lineup
- Ball-by-ball live replay with fantasy tracker
- FAAB waivers (AI bids too), free agency, trades with AI, trade deadline
- Standings, playoff bracket (projected before seeding), fixtures/scorecards, activity feed, player cards
- Scoring: Option 1 "Standard" (see [Scoring options](research/Scoring%20options.md))

## Next: tune the rules with real data

- [ ] Compare scoring options by replaying full seasons (batters currently out-score bowlers; try wicket = 7)
- [ ] Better role tagging (hand-checked all-rounder list; currently only ~14 ARs are detected)
- [ ] Full player names instead of scorecard names
- [ ] Test 10-team leagues and "best N matches" / per-match-average scoring modes
- [ ] Replay IPL 2025 (suspension + washouts) to harden gameweek handling

## Later: multiplayer

- [ ] Backend (Postgres, websockets for the draft room) and real accounts
- [ ] Multiple humans per league, commissioner tools, league chat
- [ ] Live data feed (SportMonks or similar) replacing the Cricsheet replay
- [ ] Real AI-written weekly recaps (the current recap is a template placeholder)
- [ ] Mobile (Expo) sharing the engine package

## Constraints to remember

- Free-to-play only in India (2025 Online Gaming Act); no entry fees, prizes or purchasable currency that affects results
- No IPL/franchise logos or official photos; "IPL" used only descriptively
- Attribute Cricsheet wherever data is shown
