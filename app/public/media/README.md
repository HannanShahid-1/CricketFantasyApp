# Player portraits

Snapshot retrieved 12 October 2026. Covers all 262 players in `data/ipl.json`
and all 10 IPL logos. `data/player-media.json` records each stable Cricsheet
ID, official player name, IPL ID, source page, original image URL, local asset,
and roster team. This supplements the cricket dataset without changing it.

240 portraits come from IPL's public squad data, preferring 2026 over 2025.
21 use official IPL franchise profile images where IPL returns placeholders.
Mujeeb Ur Rahman uses Afghanistan Cricket Board's official national-team photo:
Mumbai's image host was unavailable and alternative IPL franchise images were
blank or missing. Some fallback images show an older franchise kit; their photo
season is recorded as null because the source does not confirm it. Card colors
and logos follow the app's roster team; historical-only players use their last
IPL squad team as profile context, without making them draftable.

Refresh from the repository root with `python3 scripts/sync_player_media.py`.
The source list currently targets IPL 2026 and 2025. The public IPL endpoint is
not a guaranteed, supported commercial API. Review explicit aliases and fallback
sources if squad names or the website's response format change. `--reuse` keeps
already downloaded images and their recorded provenance for a quick local run;
omit it to check the latest images. Blank, invalid and duplicate portraits cause
the sync to fail before it publishes metadata. The app retains initials if an
individual image cannot load. Image and logo rights remain with their owners.
