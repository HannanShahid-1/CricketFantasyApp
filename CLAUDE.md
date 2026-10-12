# Seam (IPL fantasy league prototype)

Sleeper-style season-long IPL fantasy league: React + TypeScript (Vite) in `app/`, Python data scripts in `scripts/`.
Single player vs AI managers, replaying IPL 2026 from Cricsheet. Goal: an iPhone app (Expo) for a few friends, then
multiplayer. **Read `docs/DEVELOPER_GUIDE.md` before non-trivial work**; `docs/CHAT.md` covers chat, trades and the
commissioner.

## Commands (run in `app/`)

- `npm run dev -- --port 5174`: dev server (or the `seam` config in `.claude/launch.json`)
- `npm test`: Vitest engine suite (plays whole seasons; ~0.2s)
- `npm run build`: `tsc` + production build
- `npm run lint`: oxlint, expected to be warning-free

A change is done when tests, build and lint pass and the affected screens were checked in the browser.

## Rules of the codebase

- `app/src/engine/` is pure TypeScript (no React/DOM). All game rules live there and get a test in
  `app/tests/engine.test.ts`. Engine functions mutate a `League` copy; the store (`app/src/store.ts`) clones,
  calls them via `mutate`/`mutateChat`, and persists.
- **Only one match per player counts each week**: his first unless the manager locks in another *before his first
  match starts*. Use `playerWeek()` / `countedMatch()` for anything "this week". Never sum a player's matches.
  Never allow a choice made with hindsight (core design principle).
- New `League` fields need a default in `upgradeLeague()`.
- Components: select from the store (`useApp((s) => s.x)` or `useShallow`); never a bare `useApp()`.
- Use constants (`SLOTS`, `ROSTER_SIZE`, `REG_WEEKS`, `LAST_WEEK`, `TRADE_DEADLINE_WEEK`, `FAAB_BUDGET`), not literals.
- `app/src/bots.ts` simulates other managers and is prototype-only; don't put game rules in it.
- Preserve each file's line endings: several files are CRLF (`git ls-files | xargs grep -l $'\r$'`).
- When testing in the browser, the user's league is in `localStorage` key `cricket-fantasy-league`. Restore it after
  destructive tests and don't leave backup keys behind.
- Player photos are official IPL images: OK for private testing, need a licence before any public release.
