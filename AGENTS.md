# Seam: notes for coding agents (Codex and others)

**Read `CLAUDE.md` first.** It is the project brief (written for Claude Code, but every rule in it applies to you),
and it points to `docs/DEVELOPER_GUIDE.md`. This file adds what you need to know for working alongside another
developer and for the iPhone app.

## Layout

- `app/`: the web prototype (React + Vite). `app/src/engine/` holds every game rule.
- `mobile/`: the iPhone app (Expo). It imports `app/src` directly (`@shared/*`), so a change to the engine or store
  changes both apps. Conventions: `mobile/README.md` and `mobile/AGENTS.md`.

## Setup after cloning

```bash
cd app && npm install && npm test
cd ../mobile && npm install && npm run typecheck
```

Run the iPhone app with `npm start` in `mobile/` and the Expo Go app on an iPhone (same Wi-Fi). Installing it as a
standalone app with Xcode needs a Mac and the developer's own Apple IDs: see "Your own Apple IDs" in
`mobile/README.md`.

## Rules for working with another developer

- Two people push to this repo. Pull before starting work, and keep commits focused so merges stay easy.
- **Never commit anything personal:** Apple bundle IDs or Team IDs, device UDIDs, emails, API keys, tokens, `.env`
  files, absolute paths from your machine (`/Users/...`, `C:\Users\...`), or league saves. Signing IDs go only in
  `mobile/.env.local`, which is git-ignored. Don't change `mobile/app.config.ts` to hard-code them.
- Never commit `mobile/ios/`, `mobile/android/` or `mobile/src/generated/`: they are generated (`npx expo prebuild`,
  `npm run sync`) and ignored.
- Keep each file's line endings: several files are CRLF (see `CLAUDE.md`). Don't reformat files you didn't change.
- Shared code in `app/src` (engine, store, bots, `ui/helpers`, `ui/format` and the other plain modules) must stay free
  of DOM, Vite and React Native APIs, because both apps run it.

## Done means

- In `app/`: `npm test`, `npm run build` and `npm run lint` pass.
- In `mobile/` (when you touched it or shared code): `npm run typecheck` passes.
