# IPL Ball-by-Ball Data Sources for a Cricket Fantasy App (historical + live)

Research date: 2026-10-11. Most commercial pricing below came from vendor pages fetched today where possible. Where only aggregators were available, this is flagged. Several vendor pricing pages could not be reached (Entity Sport: 404; Roanuz: timeout; CricketData pricing: behind login).

## 1. Cricsheet: free historical ball-by-ball data (what it provides, schema, downloads, license)

### Takeaway
Cricsheet is the best free source for a local prototype. It offers an IPL-only JSON zip (1,243 matches as of today) with full delivery-level data, including wicket kind, the dismissed player and fielders. It also has a people register that maps its player IDs to ESPNcricinfo, BCCI and other IDs. Most data is under ODC-BY (attribution required), and the license summaries show no restriction on commercial use.

### Cited Findings
**Downloads / coverage**
- IPL section: **1,243 matches**. JSON at `https://cricsheet.org/downloads/ipl_json.zip`, YAML at `/downloads/ipl.zip`, men's-only JSON at `/downloads/ipl_male_json.zip`, men's-only YAML at `/downloads/ipl_male.zip` — [Cricsheet downloads](https://cricsheet.org/downloads/)
- The main format is JSON. YAML is legacy, and there are "experimental CSV, and XML files" — [Cricsheet downloads](https://cricsheet.org/downloads/)
- Incremental zips: "added in previous 2/7/30 days" and "played in previous 2/7/30 days", e.g. `/downloads/recently_added_2_json.zip` and `/downloads/recently_played_7_json.zip`. Some matches are "withheld" (5 in the last-30-days zip). Full dataset: `/downloads/all_json.zip` (23,080 matches, 379 withheld) — [Cricsheet downloads](https://cricsheet.org/downloads/)

**JSON schema**
- Top-level keys are `meta`, `info` and `innings`. `meta` holds `data_version` (page states current version 1.3.0), `created` and `revision` — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- `info` required fields: `balls_per_over`, `dates`, `gender`, `match_type`, `outcome`, `players` (team → list of player names), `registry` (`people` and `venues` mapping names → 8-character IDs), `season`, `team_type`, `teams`, `toss`. Optional fields: `event` (name, match_number, group, stage), `city`, `venue`, `officials`, `player_of_match`, `overs`, etc. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- `innings` is an array in batting order. Each innings has `team` and `overs`, plus optional `powerplays`, `target`, `penalty_runs`, `super_over`, `absent_hurt`, etc. — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Each over has `over` (number) and a `deliveries` array. Each delivery has `batter`, `bowler`, `non_striker`, and `runs` {`batter`, `extras`, `total`, optional `non_boundary`}. It can also have `extras` {`byes`, `legbyes`, `noballs`, `penalty`, `wides`}, `wickets` [ {`kind`, `player_out`, optional `fielders` [{`name`}]} ], `review` and `replacements` (match/role substitutions, relevant to the Impact Player) — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Wicket kinds: bowled, caught, caught and bowled, lbw, stumped, run out, retired hurt, hit wicket, obstructing the field, hit the ball twice, handled the ball, timed out — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Version history: 1.0.0 initial, 1.1.0 added `toss.uncontested` and `innings.forfeited`, 1.2.0 made `actual_delivery` required on deliveries, 1.3.0 added `venues` to `registry` — [Cricsheet JSON format](https://cricsheet.org/format/json/) (the `actual_delivery` detail came from a summarizing fetch and should be checked against a real file before relying on it)

**People register**
- Two CSVs. `people.csv` has `identifier` (the Cricsheet ID used in match data), `name`, `unique_name` and `key_*` columns for external IDs. `names.csv` holds name variants linked to `identifier`. The register covers 18,623 people, 28,528 identifiers from 12 sources and 8,818 name variations — [Cricsheet register](https://cricsheet.org/register/)
- External ID counts: ESPNcricinfo 18,760, CricketArchive 4,509, Pulse 2,023, BCCI 1,329, NV Play 1,178, Big Bash 296, Cricingif 130, Cricketworld 127, CricHeroes 111, Opta 68, **Cricbuzz only 50**, CricHQ 24. Only IDs needed by Cricsheet or the Cricket Scorecard Accuracy Project are included — [Cricsheet register](https://cricsheet.org/register/)

**License**
- "Most of the data is covered by the Open Data Commons Attribution License" (ODC-BY). XML match data is under CC BY 4.0. Public use must be attributed, the license made clear and notices kept. The summaries show no commercial-use restriction, but no warranty is given and publicity/privacy rights may still apply — [Cricsheet licensing](https://cricsheet.org/licensing/)

### Inferences
- An IPL prototype only needs `ipl_male_json.zip`. To refresh, poll `recently_played_2_json.zip` and filter on `info.event.name == "Indian Premier League"`.
- Cricsheet is not a live feed. Matches appear in the "recently added" zips after they are played, typically within a day or a few days based on how the zips are structured, but no SLA is published. A few matches are withheld.
- Join players on `info.registry.people` IDs, not names (names collide). Use `people.csv` → `key_cricinfo` / `key_bcci` to link to other sources.
- Because Cricbuzz coverage in the register is tiny (50 IDs), mapping to a commercial API's player IDs (SportMonks, Entity Sport, Roanuz) will need a custom crosswalk built by name, DOB and team, seeded by cricinfo IDs where the vendor exposes them.

### Gaps
- No official statement on how soon after a match it appears on Cricsheet.
- I did not verify the "Ashwin" CSV format (per-match CSV plus `_info.csv`) on the page fetched today; only "experimental CSV" was confirmed.
- I did not confirm whether the Impact Player substitution appears in `replacements.match` for every IPL match since 2023.

## 2. Live/paid cricket APIs: comparison (ball-by-ball, latency, fantasy endpoints, pricing, IPL, licensing)

### Takeaway
SportMonks is the cheapest transparent, self-serve option with IPL and ball-by-ball on every plan (€29/mo Major). Entity Sport and Roanuz are fantasy-industry specialists with fantasy-points/credits endpoints, but their pricing is unclear or not public. CricketData/CricAPI is very cheap (free 100 hits/day, $5.99/mo) but lower depth and speed. Sportradar and Stats Perform are sales-only enterprise feeds. No vendor publishes a hard latency SLA. Only Goalserve claims about one second, and that is the vendor's own claim.

### Cited Findings
**SportMonks Cricket API** (vendor page, fetched 2026-10-11)
- Plans: **Major €29/mo** (20+ leagues, IPL named explicitly), **World €75/mo** (60+ leagues), **Enterprise from €129/mo** (100+ leagues, via sales). Rate limit: "2,000 API calls per hour, per endpoint". Prices are EUR only, exclude VAT, have no contract and can be cancelled monthly. Yearly billing is cheaper, but figures were not shown — [SportMonks pricing](https://www.sportmonks.com/cricket-api/plans-pricing/)
- No free plan, but a **14-day free trial** with self-serve signup. Ball-by-ball and live scores are on all plans, "no data feature is reserved for a higher tier". Live scores update "minute to minute". 99.99% uptime is claimed, with no latency figure — [SportMonks pricing](https://www.sportmonks.com/cricket-api/plans-pricing/)
- SportMonks publishes IPL 2026 coverage and demo material — [SportMonks IPL 2026 blog](https://www.sportmonks.com/blogs/ipl-2026-season-opener-live-score-coverage-api-demo/)
- Redistribution and display rights are not on the pricing page (see ToS) — [SportMonks pricing](https://www.sportmonks.com/cricket-api/plans-pricing/)

**Entity Sport (Entity Cricket API v2)** (aggregator-sourced; official pricing URL returned 404)
- Listed prices: Starter $150/mo ($1,500/yr), Pro $250/mo ($2,500/yr), Elite $450/mo ($4,500/yr), Starter Commentary $250/mo, Pro Commentary $500/mo ($5,000/yr), plus custom Enterprise and a free dev/trial tier. Ball-by-ball commentary is in the "Commentary" variants — [APIs.io Entity Sport plans](https://apis.io/plans/entitysport/entitysport-plans-pricing/)
- Fantasy API: `/matches/{mid}/point` (Entity Sport fantasy points per match) and `/matches/{mid}/squads` (pre-match squad with roles and fantasy credits). Auth: POST access_key/secret_key to `/auth`, then pass the `token` query parameter — [APIs.io Entity Sport Fantasy API](https://apis.io/apis/entitysport/entitysport-fantasy-api/); a different squads path (`v2/match/squad/`) appears at [dltHub](https://dlthub.com/context/source/entity-sports-cricket-api-v2), so check against doc.entitysport.com

**Roanuz Cricket API (cricketapi.com)**
- Higher-tier pricing is not public; contact sales — [Highlightly 2026 roundup](https://highlightly.net/blogs/best-cricket-apis-in-2026)
- Offers ball-by-ball live scores and an ML-based Fantasy API with player credit values and fantasy points, plus a "Credit Variation API". IPL is listed among covered competitions — [Highlightly 2026 roundup](https://highlightly.net/blogs/best-cricket-apis-in-2026); [Roanuz fantasy API page (mirror)](https://backiee.wasmer.app/https_www_cricketapi_com/fantasy-api)
- Roanuz supplied IPL 2019 data (toss, player runs, playing XI, points table, schedule) for Zomato's prediction contest — [The News Minute](https://www.thenewsminute.com/atom/chennai-startup-powering-cricket-fantasy-leagues-its-ai-based-tech-107115)

**CricketData.org / CricAPI**
- Paid plans are advertised as "Starting $5.99". The free plan claims "Unlimited Cricket API Data", but the homepage hit count was a placeholder. Ball-by-ball and over-by-over are listed. Fantasy scorecard use cases are mentioned, with no explicit points endpoint. No latency figure — [CricketData.org](https://cricketdata.org/)
- Third-party listings: free tier of **100 hits/day** (resets daily); $5.99/mo gives **2,000 hits/day**. Includes a "fantasy cricket scorecard" API — [freeapihub](https://freeapihub.com/apis/cricketdata-api); [api.market roundup](https://api.market/blog/veer-hanuman-1/sports/best-cricket-api-2026)
- Its "update speed and data depth lag behind premium options" (qualitative) — [Highlightly 2026 roundup](https://highlightly.net/blogs/best-cricket-apis-in-2026)

**Sportradar Cricket**
- Real-time scoring, with additional feeds for "detailed ball-by-ball data and live pitch and field coordinates". Cricket v2 is official for ICC, ECB and CPL; IPL was not listed as official — [Sportradar developer docs](https://developer.sportradar.com/cricket/reference); [Sportradar Cricket v2 changelog](https://developer.sportradar.com/sportradar-updates/changelog/cricket-v2-1)
- No public pricing and no self-serve signup; custom contracts through sales — [Highlightly 2026 roundup](https://highlightly.net/blogs/best-cricket-apis-in-2026)

**Goalserve** (additional option found)
- Cricket Live Score: **$125 for 1 month / $550 for 6 months / $1,000 for 12 months**. Includes live scores, scorecards, ball-by-ball, lineups and standings. IPL is listed under India. Claims "ultra-low latency", ball-by-ball within about 1s (vendor claim). "Live fantasy stats data" is mentioned. A free trial is available on request. The page wording conflicts on whether the 6- and 12-month figures are totals or monthly rates — [Goalserve prices](https://www.goalserve.com/en/sport-data-feeds/cricket-api/prices)

**Others**
- Data Sports Group: ball-by-ball commentary, IPL listed, pricing not public. Highlightly: free 100 req/day, paid from $9.49/mo, scorecards, ball-by-ball not explicit — [Highlightly 2026 roundup](https://highlightly.net/blogs/best-cricket-apis-in-2026)
- Cricbuzz-derived unofficial APIs: Apify "Cricbuzz" actor from $1.00 per 1,000 requests; Apify "Cricbuzz Scraper" from $2.50 per 1,000 records. RapidAPI's "Cricket Live Scores" (not stated to be Cricbuzz-sourced) is freemium with 2,500 free requests/day. Cricbuzz has no official public price list — [Apify Cricbuzz](https://apify.com/superapis/cricbuzz); [Apify Cricbuzz Scraper](https://apify.com/solidcode/cricbuzz-scraper.md); [RapidAPI blog](https://rapidapi.com/blog/cricket-api/)

### Inferences
Comparison summary (all prices are list prices; the right-hand flags note how reliable each figure is):

| Source | Ball-by-ball | Live latency | Fantasy points endpoint | IPL | Entry price | Free option | Pricing confidence |
|---|---|---|---|---|---|---|---|
| Cricsheet | Yes (historical) | Not live (post-match) | No (compute yourself) | Yes, 2008 onward, 1,243 matches | Free (ODC-BY) | Yes | High |
| SportMonks | Yes, all plans | "minute to minute"; no SLA | Not confirmed | Yes (Major plan) | €29/mo | 14-day trial | High (vendor page) |
| Entity Sport | Yes (Commentary tiers) | Not published | Yes (`/point`, `/squads` with credits) | Implied (fantasy-industry focus); unverified | ~$150–500/mo | Dev/trial tier | Low (aggregator; official page 404) |
| Roanuz | Yes | Not published | Yes (points and ML credits) | Yes | Not public | Unknown | Not public |
| CricketData/CricAPI | Yes | Not published; slower | Fantasy scorecard (not points) | Not stated explicitly | $5.99/mo | 100 hits/day | Medium (third-party) |
| Goalserve | Yes | Claims about 1s | "fantasy stats" mentioned | Yes | $125/mo | Trial on request | Medium (vendor page, ambiguous) |
| Sportradar | Yes (+ coordinates) | Not published | No | Not official for IPL | Sales only | No | Not public |
| Stats Perform/Opta | Not researched | — | — | — | Sales only (presumed) | — | Gap |
| Cricbuzz via Apify/RapidAPI | Scraped | Depends on scraper | No | Yes (scraped) | ~$1–2.50 per 1k | Some free tiers | Medium; legal risk |

- For production, SportMonks Major (€29/mo) is the lowest-risk first paid step. Entity Sport or Roanuz are the "fantasy-native" upgrade if vendor-computed points and credits are wanted.
- A 2,000 calls/hour/endpoint limit (SportMonks) is about 33/min, enough for polling a live match every 2–5 s on one endpoint only when serving a handful of concurrent matches. A backend should poll once and fan out to users, never per client.

### Gaps
- No official pricing found for Entity Sport (page 404), Roanuz (sales-led), Sportradar or Stats Perform/Opta. I found no information on Stats Perform/Opta cricket ball-by-ball or pricing.
- No vendor publishes a measured ball-to-API latency except Goalserve's self-claim.
- I did not confirm whether SportMonks has a fantasy-points endpoint, or whether any vendor's ToS bars use in paid-entry fantasy contests. Each vendor's ToS and redistribution terms need direct review.
- INR pricing was not found for any vendor.

## 3. Legality/ToS of scraping ESPNcricinfo/Cricbuzz/iplt20.com, and IPL/BCCI data rights

### Takeaway
I could not retrieve ESPNcricinfo's, Cricbuzz's or iplt20.com's own ToS text. Disney (ESPN's parent) terms elsewhere expressly prohibit automated scraping and text and data mining, so scraping should be treated as not permitted for a commercial app. The IPL's official fantasy partner (My11Circle since 2024) is a commercial-rights deal. I found no public record of an exclusive "official IPL data" licence that bars third-party fantasy apps.

### Cited Findings
- Disney+ terms prohibit copying or extracting the service "using a robot, spider, script or other automated means" — [ConductAtlas: Disney ToU provision](https://conductatlas.com/platform/disney/disney-terms-of-use/provision/CA-P-022520/prohibition-on-automated-access-and-ai-scraping/). A Disney UK page bars text and data mining of Disney products — [Disney UK AI opt-out](https://www.thelionking.co.uk/ai-opt-out). These are Disney-wide documents, not cricinfo-specific.
- Third-party ESPNcricinfo scrapers exist (e.g. PyPI `espncricket`, Apify Statsguru scraper), which says nothing about whether scraping is permitted — [PyPI espncricket](https://pypi.org/project/espncricket/0.0.9/); [Apify Statsguru scraper](https://apify.com/getascraper/espncricinfo-statsguru-scraper/api)
- Unofficial Cricbuzz data "is owned by Cricbuzz and unofficial access can be restricted or cut off" (search-summary caution); no official Cricbuzz API pricing exists — [Apify Cricbuzz](https://apify.com/superapis/cricbuzz)
- BCCI named Dream11 the IPL's official partner and "Official Fantasy Game" provider from 2019 — [iplt20.com](https://www.iplt20.com/news/152120/bcci-announces-dream11-as-official-partner-of-vivo-ipl)
- My11Circle became the IPL's official fantasy sports partner from IPL 2024 on a 5-year deal (Rs 625 crore vs Dream11's Rs 515 crore bid, per media reports) — [Storyboard18](https://www.storyboard18.com/amp/quantum-brief/my11circle-to-become-official-fantasy-sports-partner-of-tata-ipl-2024-24087.htm); [Medianews4u](https://www.medianews4u.com/my11circle-dethrones-dream11-dominance-to-become-ipls-official-partner-for-fantasy-sports/)

### Inferences
- Many fantasy apps (Dream11 competitors) operate during IPL without being the official partner. This suggests that factual match data (scores, ball outcomes) obtained from a licensed data vendor is usable, while IPL/team logos, official player images and the "IPL" mark are IP that needs a licence. This is an inference; get legal advice.
- Prefer a licensed vendor feed over scraping. Scraping also carries operational risk (layout changes, IP blocking) on top of ToS risk.
- Separate from data rights: Indian law on real-money online gaming (e.g. the 2025 Promotion and Regulation of Online Gaming Act) may affect paid-entry fantasy. Not researched here; flag to the legal/regulatory researcher.

### Gaps
- ESPNcricinfo, Cricbuzz and iplt20.com ToS and robots.txt text were not retrieved.
- I could not confirm whether BCCI has an official IPL data partner for 2026, or whether that partner's deal restricts other vendors' IPL feeds.
- I could not confirm that the My11Circle deal is still active in 2026.

## 4. Player identity mapping across sources

### Takeaway
Cricsheet's `people.csv` is the de facto crosswalk. It maps the Cricsheet 8-character ID to ESPNcricinfo (near-complete coverage), BCCI (1,329) and others. Cricbuzz coverage is negligible (50), so a live-vendor crosswalk must be built.

### Cited Findings
- `people.csv` columns: `identifier`, `name`, `unique_name` and `key_cricinfo`, `key_bcci`, `key_cricbuzz`, `key_opta`, `key_pulse`, `key_nvplay`, `key_cricketarchive`, etc. `names.csv` holds name variants — [Cricsheet register](https://cricsheet.org/register/)
- Counts: cricinfo 18,760, BCCI 1,329, Pulse 2,023, Opta 68, Cricbuzz 50 — [Cricsheet register](https://cricsheet.org/register/)
- Match files embed `info.registry.people` (name → ID) for every player in the match — [Cricsheet JSON format](https://cricsheet.org/format/json/)

### Inferences
- `key_bcci` likely corresponds to iplt20.com/BCCI player IDs, which is useful for IPL. `key_pulse` likely corresponds to the Pulselive platform used by some cricket boards. Both are unverified.
- Build an internal `player` table keyed by your own UUID, with columns for cricsheet_id, cricinfo_id, bcci_id and vendor_id. Match vendor IDs by name, DOB and current team, then review manually.

### Gaps
- I did not check whether SportMonks, Entity Sport or Roanuz expose cricinfo IDs in their player objects. Player image licensing from each vendor was not confirmed.

## 5. Python/R tooling for Cricsheet and the APIs

### Takeaway
No dominant, well-maintained Python package for Cricsheet JSON was confirmed. The JSON is simple enough that a short `json` + `pandas` flattener is the norm. Scraper packages exist for Cricsheet YAML and ESPNcricinfo.

### Cited Findings
- `python-cricket-scraper` (PyPI) reads Cricsheet (YAML examples) and ESPNcricinfo and outputs per-ball CSV (inning, delivery, over, batsman, ...) — [PyPI python-cricket-scraper](https://pypi.org/project/python-cricket-scraper)
- Example community project parsing Cricsheet with Python — [GitHub Cricsheet-Match-Analysis](https://github.com/GowthamAnbazhagan/Cricsheet-Match-Analysis); cricinfo ball-wise scraper — [GitHub cricinfo-ballwise-scraper](https://github.com/mudassirkhan19/cricinfo-ballwise-scraper)
- `espncricket` PyPI scraper for ESPNcricinfo — [PyPI espncricket](https://pypi.org/project/espncricket/0.0.9/)
- Paid hosted Cricsheet-to-rows actors on Apify — [Apify Cricsheet scraper](https://apify.com/parseforge/cricsheet-scraper)
- Roanuz has had a Python SDK, `py-cricket`, on PyPI — [PyPI py-cricket](https://pypi.python.org/project/py-cricket/1.0.7/) (old version; maintenance status unknown)

### Inferences
- Recommended: write your own roughly 100-line loader that flattens `innings → overs → deliveries` to one row per delivery (match_id, innings, over, ball_idx, batter_id, bowler_id, non_striker_id, runs_batter, runs_extras, extras types, wicket_kind, player_out, fielders) and store it in DuckDB/Parquet or Postgres.

### Gaps
- I could not verify the PyPI package "cricketstats", R `yorkr` (Tinniam V Ganesh) or `pycricbuzz` in this session. yorkr is widely known to analyse Cricsheet data, but its current JSON support was not confirmed. pycricbuzz is understood to be an unofficial Cricbuzz scraper of uncertain maintenance. Treat all three as unverified.

## 6. Fields needed for fantasy points, and which sources include fielding detail

### Takeaway
Cricsheet carries everything needed for typical Dream11-style T20 scoring. That covers runs, boundaries, balls faced (derivable), dot balls, maidens, wicket kind (bowled/LBW bonus), catches, stumpings and run-outs with fielder names. Direct versus indirect run-out has to be inferred from the number of fielders listed.

### Cited Findings
- Per-delivery fields are `runs.batter`, `runs.extras`, `runs.total`, the `extras` breakdown (wides, noballs, byes, legbyes, penalty), and `wickets[].kind`, `player_out` and `fielders[].name`. Kinds include bowled, lbw, caught, caught and bowled, stumped, run out and hit wicket — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- `info.players` gives the playing XI per team, and `replacements` gives substitutions (e.g. impact player) — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Entity Sport and Roanuz provide vendor-computed fantasy points; Roanuz adds credits — [APIs.io Entity Sport Fantasy API](https://apis.io/apis/entitysport/entitysport-fantasy-api/); [Highlightly](https://highlightly.net/blogs/best-cricket-apis-in-2026)

### Inferences
Derivation rules from Cricsheet:
- **Runs / 4s / 6s:** `runs.batter`. Count a boundary when `runs.batter` is 4 or 6 and `non_boundary` is absent.
- **Balls faced:** count deliveries with no `wides` (no-balls count as faced).
- **Duck:** batter dismissed with 0 runs.
- **Strike rate / economy:** from balls faced; economy = (runs.total − byes − legbyes) per legal over.
- **Dot ball (bowling):** `runs.total == 0`. Wides and no-balls are never dots.
- **Maiden:** an over by one bowler with 0 runs conceded (byes and leg-byes don't count against the bowler) and 6 legal balls.
- **Bowler wicket:** kind is not run out, retired hurt or obstructing the field.
- **LBW/bowled bonus:** kind is `lbw` or `bowled`.
- **Catch:** kind is `caught` → `fielders[0]`; `caught and bowled` → the bowler.
- **Stumping:** kind is `stumped` → `fielders[0]` (keeper).
- **Run-out:** kind is `run out`. One fielder listed ⇒ treat as "direct hit"; two or more ⇒ thrower and catcher split. This is an approximation: Cricsheet doesn't flag direct hits explicitly.
- **Substitute fielders:** may appear with a substitute marker in `fielders` (verify).
- **Playing XI / announced lineup points:** `info.players`.

### Gaps
- I did not confirm whether paid APIs mark direct versus indirect run-outs explicitly. I also did not confirm whether Cricsheet flags substitute fielders.

## 7. Simulating live matches locally by replaying Cricsheet deliveries

### Takeaway
Cricsheet has no per-ball timestamps; only match `dates` are given. A local live simulator must synthesize timing and replay deliveries in order. Emitting payloads that mimic the target paid API lets the production switch be a swap of data sources.

### Cited Findings
- Cricsheet's `info.dates` is an array of dates, and no per-delivery timestamp field is listed in the delivery schema — [Cricsheet JSON format](https://cricsheet.org/format/json/)
- Deliveries are ordered within `overs[].deliveries[]` and innings are in batting order — [Cricsheet JSON format](https://cricsheet.org/format/json/)

### Inferences
Proposed approach:
1. Load the match JSON and flatten it to an ordered event list (innings, over, ball_seq).
2. Assign synthetic timestamps starting from a chosen match start:
   - about 35–45 s per delivery, plus extra time after boundaries and wickets (about 60–90 s);
   - about 60 s between overs;
   - about 2.5 min for strategic time-outs;
   - about 10–20 min innings break.
   A speed multiplier (1x, 10x, 60x) lets you test quickly.
3. Publish each event via a simple asyncio loop to WebSocket/SSE or a message queue (Redis pub/sub). Alternatively, expose a mock REST endpoint shaped like SportMonks/Entity Sport "livescore" so polling clients behave identically.
4. Have the fantasy scoring engine consume the event stream and update points incrementally. Validate it by replaying a whole match and comparing against a batch computation over the same file.
5. Inject faults (late corrections, a reversed decision via `review`, delayed or duplicated events, feed outages) to test the robustness that real live feeds require.

### Gaps
- I found no existing open-source "Cricsheet live replayer" project in this session's searches.

## Recommendation path (synthesis for the report writer)
- **Now (prototype, $0):** Cricsheet `ipl_male_json.zip` (ODC-BY, attribute "Data from Cricsheet.org"), a custom Python flattener, the `people.csv` crosswalk and a local replay simulator.
- **Pre-launch testing (about $0–30):** CricketData.org free tier (100 hits/day) or SportMonks' 14-day trial, to build the live-ingestion adapter against a real feed.
- **Production v1 (about €29–75/mo):** SportMonks Major or World. This is transparent, self-serve, has IPL and ball-by-ball on all plans, and no contract.
- **Production v2 / scale:** Entity Sport (about $150–500/mo; aggregator figures) or Roanuz (quote), for vendor-computed fantasy points and credits and fantasy-industry support. Consider Goalserve ($125/mo, claimed about 1s latency) as a speed alternative.
- **Avoid:** scraping ESPNcricinfo, Cricbuzz or iplt20.com for a commercial product. Before launch, verify vendor ToS for fantasy use, image rights and IPL trademarks.
