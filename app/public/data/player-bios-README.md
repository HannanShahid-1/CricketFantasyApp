# Player biographies

All 262 identities were matched against official franchise squad lists for IPL
2026 (Sports Interactive series 13469) and 2025 (8307), official franchise player
registries/profiles, and ICC player profiles. Provider IDs differ from IPL IDs;
`scripts/player_bio_ids.json` preserves the explicit mapping and expected names.
No initial/surname fuzzy matching is used when refreshing biographies.

The factual biography fields come from the public Sports Interactive feed served
by the official Kolkata Knight Riders website:
`https://www.kkr.in/cricket/static/json/{providerId}_json_profile.json`.
This shared cricket feed also covers players from other franchises. Each record
in `player-bios.json` retains its source URL, source player name, provider ID,
source update value and retrieval date. Cards link to that source.

Run `python3 scripts/sync_player_bios.py` from the repository root to refresh.
The importer validates every ID, expected name and required field before replacing
the biography file. This public website feed is not a guaranteed commercial API.

Birth dates are stored as ISO dates; the UI calculates age using today's local
date, independently of the app's simulated IPL week. Nationality follows the
provider's cricket nationality, including "West Indies". Playing styles retain
the source's terminology; only batting-style capitalization is normalized.
28 profiles omit bowling style (a dash); these remain null and display "Not
listed", rather than asserting the player never bowls. No weights, heights or
jersey numbers are inferred. Roles, IPL teams, league state and scoring remain
defined by the existing cricket dataset.
