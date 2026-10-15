# Seam for iPhone

Expo (React Native) version of the Seam web prototype in `../app`, sharing its engine and store.

## Run

First time: `npm install` in both `../app` and here (the shared code type-checks against `../app/node_modules`).

```
npm install
npm run ios        # syncs shared files, starts Expo and opens the iOS Simulator (needs a Mac with Xcode)
npm start          # same, then scan the QR code with Expo Go on a real iPhone (same Wi-Fi; works from Windows too)
npm run typecheck
```

Expo Go needs no Apple account and no setup beyond this. On Windows `npm run sync` can't make HEIC thumbnails
(macOS `sips`), so list rows fall back to the full photos; everything else works.

## Your own Apple IDs (private, never committed)

The bundle ID and Apple Team ID are personal: Apple ties each bundle ID to one account, so every developer signs
with their own. They live in `.env.local` (git-ignored), which `app.config.ts` reads on top of `app.json`:

```bash
cp .env.example .env.local   # then fill in SEAM_BUNDLE_ID and SEAM_APPLE_TEAM_ID
```

Only needed for installing with Xcode (below). Never put them in `app.json` or any other committed file. Without the
file the config falls back to `com.example.seam` and no team, which is fine for Expo Go and the Simulator.

## What is shared with the web app

- `@shared/*` imports `../app/src/*` directly: the engine (all game rules), `store.ts` (state and actions), `bots.ts`,
  `ui/helpers.ts`, `ui/format.ts`. Change a rule on the web and the iPhone app gets it. Shared code must stay free of
  DOM/Vite APIs (the web-only data fetch lives in `../app/src/loadData.ts`).
- `metro.config.js` makes shared files use this app's `react`/`zustand`, never `../app/node_modules`.
- `npm run sync` (runs before `start`/`ios`) generates `src/generated/`: theme tokens from `../app/src/themes/*.css`
  and the player-photo maps from `../app/public/data/player-media.json` (`PHOTOS` full size for the player card,
  `THUMBS` 144px HEIC thumbnails made with macOS `sips` for avatars). Never edit generated files.
- Storage: `setStorage(AsyncStorage)` + `useApp.persist.rehydrate()` in `src/data/boot.ts`.

## Layout

- `src/app/`: routes only (thin files that render a screen). Root `_layout.tsx` guards by league phase (setup → draft
  → season) and registers the sheets; `(tabs)/_layout.tsx` is the native tab bar; each tab folder is a native stack.
- `src/screens/<Name>Screen.tsx`: one screen each (named export). `src/components/`: pieces shared by screens.
- `src/ui/` (import from `@/ui`): the design system. `src/theme/theme.ts`: tokens → React Native.
- `src/nav.ts`: every route the app opens. `src/data/boot.ts`: start-up. `src/data/derived.ts`: per-league caches.

## Conventions (read before building a screen)

**Native iOS first.** The web app is the feature checklist, not the visual reference. Build what an iOS user
expects: large-title stacks, inset grouped `Section`s of `Row`s (like Settings), native header menus
(`unstable_headerRightItems`), sheets for detail/edit flows (routes in `src/app/`, opened via `nav`; a sheet with a
title bar is a folder whose `_layout` is `SheetStack`), `confirm()` alerts for destructive actions, `SwitchRow` for
on/off settings, `Segmented` for 2–4 options, `Pill`s for longer filter rows (`RolePills` for roles), the header search bar (`headerSearchBarOptions`) for search, and `PlayerLink` for every player row (tap
opens his card, press-and-hold shows a native menu). Keep the bottom tab bar as is.

**Design system.** Use `@/ui` components and theme tokens: `useTheme()` (`t.c.*`, `t.r.*`, `t.font.*`), `alpha()`
and `mix()` for tints, `t.team(color)` for team colours. Never literal colours (the player-card hero is the one
team-branded exception). Text is always `Txt` (`display` for titles/names, `num` for scores and stats). Icons are SF
Symbols via `Icon`. Spacing: 16pt screen margins, ~24pt between sections, rows ≥ 50pt tall.

**Stitch (the default look).** The cricket ball: coral and cream, with a dark and a light look (Settings: Automatic /
Light / Dark; `useThemeStore`, and the native UI follows via `Appearance`). Its signature is the seam: `Seam` divides the
two innings on a scorecard (not the matchup scoreboard: the user didn't like it there), and `Meter` draws any share or progress bar
(stitches in Stitch, a plain bar elsewhere). Featured cards (scoreboards) use `t.c.feature`. Don't branch on the theme
in screens: `Seam` draws nothing and `Meter` is a plain bar in the other themes, and `t.stitched` stays inside
`@/ui`. Good/bad pairs (added/dropped players, points won/lost, big/low games) are `win`/`loss`, never accent/`loss`:
the accent is for emphasis and actions, and in Stitch it is red-ish.

**Feedback.** `Button` already taps a haptic. Use `haptic.select()` for choices, and `report(err, okMessage)` after
every store action that can fail (store actions return an error string or null): it plays the right haptic and
shows the toast.

**Data and state.** Read with narrow selectors, `useShallow` for several actions; never a bare `useApp()`. Screens
that don't show chat read the league with `useGameLeague()` (`@/data/gameLeague`), so chat traffic doesn't re-render
them; only the chat screens select `s.league` directly. Long lists set `windowSize` (rows are heavy). The league is immutable; change it only through store actions. Game data: `getData()`. Use
`ownersOf`/`standingsOf`/`recordOf` from `@/data/derived` instead of recomputing per row. Only one match per player
counts each week: use `playerWeek()`/`countedMatch()`, never sum a player's matches.

**Shared logic.** Reuse `@shared/*` (engine, `ui/helpers`, `ui/format`, `ui/lineup`, `ui/matchPick`,
`ui/playerList`, `ui/chat/*`). If a web view has pure logic inline that you need, move it into a shared module
under `../app/src/ui/` (plain TS, no React/DOM), switch the web view to it, and keep the web green. Don't change
game rules in the engine.

**Efficiency.** Lists longer than ~30 rows use `FlatList` (`contentInsetAdjustmentBehavior="automatic"`, stable
keys, memoised row components). Derive arrays in `useMemo` keyed on the league. Static styles via
`useStyles((t) => ({...}))` declared at the bottom of the file; small one-off inline styles are fine.

**Navigation.** Only through `nav` (`@/nav`). Set a screen's title with `<Stack.Screen options={{ title }} />`.

**Checks.** `npm run typecheck` must pass. If you touched `../app`: `npx tsc -p tsconfig.app.json --noEmit`,
`npx vitest run` and `npx oxlint` there must pass, and keep each file's line endings (several web files are CRLF).

## Installing on an iPhone (Xcode, free Apple ID)

One-time: CocoaPods (`brew install cocoapods`), Apple ID in Xcode → Settings → Accounts, iPhone trusted and in
Developer Mode, on the phone Settings → General → VPN & Device Management → trust the developer, and your own
`.env.local` (see above). Then, from `mobile/`:

```bash
npm run sync && npx expo prebuild --platform ios && (cd ios && LANG=en_US.UTF-8 pod install)
cd ios && xcodebuild -workspace Seam.xcworkspace -scheme Seam -configuration Release -destination "id=<iPhone UDID>" -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
xcrun devicectl device install app --device <iPhone UDID> ~/Library/Developer/Xcode/DerivedData/Seam-*/Build/Products/Release-iphoneos/Seam.app
```

`xcrun devicectl list devices` shows the UDID. With a free Apple ID the install stops opening after 7 days:
rebuild and reinstall (the league is kept). The app icon comes from `scripts/make-icon.swift`
(`swift scripts/make-icon.swift` redraws `assets/icon*.png`).
