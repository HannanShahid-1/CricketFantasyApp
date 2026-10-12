# Roadmap

Where the prototype is and what comes next. Phases follow the plan in [the research report](research/IPL%20fantasy%20cricket%20app%20research.md).

## Done: local prototype (`app/`)

- Snake draft room with AI managers, queue, autopick and auto-draft
- 1 WK / 4 BAT / 4 BOWL / 2 FLEX + 4 bench, with primary-role + FLEX eligibility for all-rounders
- 8 Mon–Sun gameweeks: 6 regular-season weeks (head-to-head + league median), semis, final
- One match per player counts each week (his first, or one you lock in before his first match); lineup lock at the counting match; auto-subs; optional auto-set lineup
- Ball-by-ball live replay with fantasy tracker
- FAAB waivers (AI bids too), free agency, trades with AI, trade deadline
- Standings, playoff bracket (projected before seeding), fixtures/scorecards, activity feed, player cards
- Scoring: Option 1 "Standard" (see [Scoring options](research/Scoring%20options.md))
- League chat + direct messages: reactions, typing, read receipts, league events (adds/drops, waivers, weekly results, playoffs)
- Trade offers in DMs (accept, decline, withdraw, expire) with commissioner review (approve/veto, or auto-approve when the next match starts); AI managers send offers and trade with each other. See [CHAT.md](CHAT.md)
- Home screen: swipeable matchup carousel with the league chat pinned beside it
- Engine test suite (`npm test`) that plays whole seasons and checks every rule; player photos as WebP (~6 MB instead of ~25 MB)
- Developer guide for long-term work: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)

## Next: tune the rules with real data

- [ ] Compare scoring options by replaying full seasons (batters currently out-score bowlers; try wicket = 7)
- [ ] Better role tagging (hand-checked all-rounder list; currently only ~14 ARs are detected)
- [ ] Full player names instead of scorecard names
- [ ] Test 10-team leagues
- [ ] Smarter AI match lock-ins (they always take a player's first match today)
- [ ] Replay IPL 2025 (suspension + washouts) to harden gameweek handling

## Later: multiplayer

- [ ] Backend (Postgres, websockets for the draft room) and real accounts
- [ ] Multiple humans per league; move chat and trades to the server (plan in [CHAT.md](CHAT.md))
- [ ] Commissioner tools: settings screen (review period, deadline), league-vote vetoes, roster fixes, transfer commissioner
- [ ] Push notifications for DMs, trade offers and trades awaiting review
- [ ] Live data feed (SportMonks or similar) replacing the Cricsheet replay
- [ ] Real AI-written weekly recaps (the current recap is a template placeholder)
- [ ] Mobile (Expo) sharing the engine package

## Constraints to remember

- Free-to-play only in India (2025 Online Gaming Act); no entry fees, prizes or purchasable currency that affects results
- No IPL/franchise logos or official photos; "IPL" used only descriptively
- Attribute Cricsheet wherever data is shown
