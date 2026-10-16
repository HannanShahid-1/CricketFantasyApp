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
- Storage: `src/data/boot.ts` plugs in AsyncStorage (`setStorage`), batching writes to at most one every half second
  and flushing as soon as the app leaves the foreground, then `useApp.persist.rehydrate()`. It also sets the store's
  cloner to a JSON round-trip (`setCloner`), much faster on Hermes than its `structuredClone` polyfill.

## Layout

- `src/app/`: routes only (thin files that render a screen). Root `_layout.tsx` guards by league phase (setup → draft
  → season) and registers the sheets; `(tabs)/_layout.tsx` is the native tab bar; each tab folder is a native stack.
- `src/screens/<Name>Screen.tsx`: one screen each (named export). `src/components/`: pieces shared by screens, and a
  folder per big screen's parts (`player/`, `match/`, `trade/`, `draft/`, `chat/`).
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

**Glass matchup (experiment).** Settings → Experiments → Glass matchup (off by default) puts the Matchup tab on
clear glass, with no frosting: see-through panes whose edges catch the light. Lineup rows let each player's IPL colour
come in from his own side under the glass (`sideWash`), the scoreboard is washed in both teams' colours, and slots
are lit capsules. Everything glass is in `src/ui/glass.tsx`; the screen swaps `Section`/`SlotBadge` for the glass
versions when `usePrefs().glassMatchup` is on, and off is the original look. With it, **Liquid swipe** (iOS 26+, on by
default, `usePrefs().liquidSwipe`) swaps the scoreboard pager for `LiquidPager`: system glass cards in a `GlassContainer` that
slide towards each other with the swipe, melt into one and stretch apart as the next page settles. Keep it to the
Matchup tab until it's decided.

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
keys, memoised row components). Derive arrays in `useMemo` keyed on the league. Anything that changes many times a
second (the in-place simulation) passes rows plain values and memoised rows re-render only when theirs change (see
`Cell` on Matchup); give `<Stack.Screen options>` a memoised object, since a new one re-sets the native header. Static styles via
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

## Updating an installed iPhone app over Wi-Fi with Codex

On your own Mac, you can ask Codex:

> Pull the latest mobile changes from feat/seam-prototype and update the existing Seam app on my paired iPhone over Wi-Fi. Preserve my league and local Apple signing settings. Build and check it before installing.

The iPhone must already be paired with this Mac in Xcode, trusted, and have Developer Mode enabled. Connect it by
cable for the initial setup if necessary; enable network connection in Xcode's device tools where offered. For later
updates, keep the Mac and phone on the same Wi-Fi and unlock the phone. Network discovery must show the phone before
attempting a wireless install. A first install still needs the setup described above.

For Codex or another coding agent:

1. Work in this repository's `mobile/` app. Check the current branch and local changes, fetch origin, and update
   `feat/seam-prototype` without overwriting anyone's uncommitted work. Do not substitute a separate web preview
   checkout or push changes as part of an install request.
2. Use the developer's own git-ignored `.env.local` for signing. Never copy another developer's signing settings or
   commit Apple IDs, device identifiers, credentials or league saves.
3. If dependencies changed, install the locked dependencies in `app/` and `mobile/`. Run the repository's required
   tests, build, lint and mobile type check. Run `npm run sync`, regenerate iOS with Expo prebuild as needed, and
   install pods when the native dependencies change. Never hand-edit generated iOS project files.
4. Discover the connected physical iPhone with `xcrun devicectl list devices` and Xcode's device tools. Confirm the
   selected device is available over the local network; do not assume a simulator or another person's device is the
   target. If several phones are available and the intended one is unclear, ask which one to use.
5. Build the `Seam` scheme in Release from `mobile/ios/Seam.xcworkspace` for that discovered physical device using
   `xcodebuild`, with the developer's existing provisioning setup. Use a temporary derived-data directory and check
   that the build succeeded before installing.
6. Use `xcrun devicectl device install app` to install the resulting `Seam.app` on the same device. Keep the existing
   bundle identifier and install in place: do not uninstall the app, erase it, reset storage or delete its league.
   Launch with `xcrun devicectl device process launch` using the built app's bundle identifier. If the phone is locked
   or asks for trust, ask the developer to unlock or approve it and report installation separately from launch.
7. Verify the installed update and report the commit used. If Wi-Fi discovery fails, explain the blocker and use a
   cable only when the developer chooses to connect one. Do not claim a wireless update succeeded without checking
   the install result.

Each developer signs and installs on their own Mac and phone. Pushing to GitHub alone does not update an installed
app; Codex needs access to that developer's local Xcode setup to build and install it. Free Apple signing expires, so
an expired installation needs a new signed build and reinstall in place.

## In-place fantasy simulation

On Matchup, **Simulate live** replays the next IPL fixture while keeping both fantasy lineups visible. Controls offer
pause/resume, 1×/4×/20× speeds and Finish. Only the selected counting match contributes to the weekly total; bench
points remain separate. Actual player scores always use the normal theme text colour. The smaller projection below turns green/red
against the pre-match expectation while its estimated finish updates. After the fixture ends, that smaller number
returns to the original pre-match projection in the regular colour. Red/green pace colours apply only while
the fixture is being simulated; an on-pace estimate also uses the regular colour.

The replay uses `data/simulation.ts` and the shared `ui/matchupSimulation.ts` helpers. Estimates use revealed
innings progress, dismissals and bowling workload, not future results. These are rough estimates. The existing
scoring engine supplies all actual points. Starting a simulation persists `League.replayMatch`, settles pre-match
actions and locks the relevant players and match selections. Finishing records the match once through `playNext`.
The ball cursor is local to the screen: after restarting the app, an unfinished match is paused and can be replayed
from its beginning with its player locks intact. Watch live remains the separate commentary replay.

## Live Activity (Dynamic Island)

Settings → Live Activity → **Show your matchup** (off by default) puts this week's matchup on the Lock Screen and in
the Dynamic Island. Compact: both scores, the leader bright. Press and hold: each badge and score beside the camera,
the team names, your win chance as a bar on a quiet track and one status line (a live dot, then the simulated match
and over, or the week and matches played). Every expanded region shares one left and right edge; the centre region
stays empty because iOS puts it below the camera, out of line with the sides. The Lock Screen adds projections.
Minimal (beside another app's activity): your win chance as a ring.

- `targets/matchup-activity/`: the SwiftUI widget extension, linked by `@bacons/apple-targets` at `expo prebuild`
  (edit it in Xcode under `expo:targets`; the files stay here, outside the generated `ios/`).
- `modules/seam-live-activity/`: a local Expo module the app calls to start, update and end the activity.
  `MatchupAttributes.swift` is in both folders and must stay identical: ActivityKit pairs them by the type's name.
- `src/data/liveActivity.ts`: builds the content from the shared engine (`matchupOdds`, the simulation feed
  `useLiveSim`) and sends it at most once a second. Colours are theme tokens sent as hex.

There is no push server, so the activity only changes while Seam is open (playing or simulating a match, lineup
changes); it doesn't move on its own in the background. Multiplayer with a server could push updates later. It needs
an Xcode build (not Expo Go) and iOS Settings → Seam → Live Activities on; the Simulator shows it too. A new week or
opponent replaces the activity; swiping it away hides it until the matchup changes or Seam restarts.
