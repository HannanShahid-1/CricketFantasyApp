# Season-Long Redraft Fantasy Football Mechanics (Sleeper, ESPN, Yahoo, NFL Fantasy): A Replication Spec for an IPL Fantasy App

Research note: the sources are mostly the platforms' own help pages: Sleeper support, ESPN's settings guide, and Yahoo Help. NFL.com's support pages returned HTTP 403, so NFL Fantasy defaults below come only from search-result summaries and are weaker evidence. Today's date is 2026-10-11. Help-center articles are generally current, but most are undated.

## 1. League lifecycle: creation, settings, invites, sizes, commissioner tools, redraft vs keeper vs dynasty

### Takeaway
Every platform follows the same lifecycle: a commissioner creates a league, invites members by link, configures settings (some of which lock at the draft), runs the draft, plays a head-to-head regular season, then playoffs. The defaults cluster around 10 teams with even sizes preferred. Sleeper adds league formats (dynasty, best ball, "chopped") and many commissioner tools, including history import.

### Cited Findings
- **League size.** ESPN says even team counts are ideal for head-to-head play, because an odd count creates bye weeks. ESPN calls 10 teams "traditional", 12 or 14 the harder option, and 8 or fewer star-heavy. — [ESPN settings guide](https://www.espn.com/nfl/story/_/id/19540805)
- Yahoo's default league is 10 teams, head-to-head points. — [Yahoo default settings](https://help.yahoo.com/kb/SLN6489.html)
- Sleeper has a help article on running a league with an odd number of teams. Other Sleeper articles cover decreasing league size, adding co-owners, transferring a team to another owner, preventing a user from joining, and joining public leagues. — [Sleeper Fantasy Football collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **Invites and matchmaking.** Sleeper supports invite links ("How do I invite friends to join my league?") and has public leagues and "Matchmaking on Sleeper" for players without a group. — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **League name and visibility.** ESPN league names are limited to 32 characters. A league can be set to "Public" so that non-members can view its pages. — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- **Settings access.** On ESPN, the League Manager (LM) goes to League, then Settings. ESPN's waiver acquisition system "is locked at start of draft." — [ESPN Waivers Overview (search summary)](https://support.espn.com/hc/en-us/articles/360000041152-Waivers-Overview)
- On Yahoo, whether undrafted players go to waivers or become free agents after the draft can only be changed before the draft. — [Yahoo waivers](https://help.yahoo.com/kb/SLN6427.html)
- **League types (Sleeper definitions):**
  - **Redraft** is the "simplest format". Teams start each season with empty rosters and a full set of draft picks. Picks can be traded before and during the draft, but future-season picks cannot be traded until the league is renewed.
  - **Keeper**: managers keep a set number of players each season, usually at a keeper cost. Kept players are slotted into draft positions before the draft, and future picks can be traded.
  - **Dynasty**: "Teams keep their entire roster every season," with rookie drafts and taxi squads.
  - Sleeper also offers Auction and Best Ball (a lineup type that sets optimal lineups automatically).
  - Customizable dimensions: draft type (Snake, Linear, 3RR, Auction), lineup type (Classic, Best Ball), waiver type (Rolling, Reverse, FAAB), roster positions including IDP, scoring, and a weekly median game.
  - — [Sleeper League Types & Formats](https://support.sleeper.com/en/articles/3537396-league-types-formats)
- **Chopped (guillotine) leagues on Sleeper.**
  - Each week the lowest-scoring team is "chopped", and its whole roster goes to waivers for the remaining teams to bid on with FAAB.
  - There are no playoffs; the last team standing wins.
  - Sleeper recommends a $1,000 FAAB budget and 18 teams, so the league spans the full NFL season.
  - The tiebreaker is total season points. In Week 1, draft position breaks ties.
  - — [Sleeper Chopped Leagues](https://support.sleeper.com/en/articles/12005468-introduction-to-chopped-leagues)
- **Commissioner tools (Sleeper article titles):**
  - force add/drop
  - randomize the schedule
  - customize playoff seeding
  - adjust weekly lineups and scores
  - commish without owning a team
  - keeper round costs and keeper deadlines
  - force a trade through
  - edit FAAB and waiver priority
  - recalculate matchup records
  - a process for an inactive commissioner
  - a list of which commish actions post a league chat message (transparency)
  - — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **Platform migration.** Sleeper has articles on moving dynasty or keeper leagues to Sleeper, switching mid-season, and importing league history. Supporting league history and weekly reports is part of the platform. — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **Player universe.** ESPN lets leagues restrict the player pool to all NFL, AFC-only, or NFC-only. — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- **Market scale.**
  - The FSGA's July 2025 study, conducted by Angus Reid, estimates about 57M fantasy sports players in the US and Canada (53M US, 4.2M Canada). That figure covers all fantasy sports.
  - The same study counts 84M adults who played fantasy or bet on sports in the past 12 months, up from 81M in 2024.
  - — [FSGA July 2025 release](https://thefsga.org/new-fsga-research-highlights-industry-stability-and-next-generation-growth-in-fantasy-sports-and-sports-betting)
  - A widely circulated figure of 86M fantasy football players could not be verified against the FSGA release. — [sportssurge (unreliable)](https://sportssurge.alibaba.com/football/how-many-people-play-fantasy-football)
- **ESPN scale.**
  - More than 13M people played ESPN Fantasy Football in 2024.
  - The ESPN Fantasy App had 9.3M unique visitors in August 2024, 3.7M more than No. 2 Yahoo (Comscore data).
  - — [ESPN Press Room](http://espnpressroom.com/press-release/another-all-time-record-13-million-fans-playing-espn-fantasy-football-in-2024/)

### Inferences
- An MVP needs these settings objects: league (size, type, visibility), roster config, scoring config, draft config, waiver config, trade config, playoff config, and schedule. Some settings must lock at draft start: the waiver system, and whether undrafted players start on waivers or as free agents.
- For IPL, an 8 or 10-team default fits better than 12. The IPL has only 10 franchises and a small player pool (about 25 per squad, with a smaller set who actually play), so deep leagues starve the waiver wire. This is an inference, not sourced.
- A Chopped/guillotine mode fits a short IPL season of roughly 74 matches over about 8-10 weeks. The format needs no playoffs and creates high-engagement FAAB weeks.

### Gaps
- Sleeper's maximum league size and its default roster were not found on the pages fetched.
- NFL.com's league settings page returned 403, so its sizes and options could not be verified directly.

## 2. Rosters: lineup slots, bench, IR, FLEX, lineup lock

### Takeaway
The de facto standard lineup is QB, 2RB, 2WR, TE, FLEX (RB/WR/TE), K, and DEF, with a 6-7 player bench and 1-2 IR slots. Per-player lock at each player's own kickoff is the dominant setting. A weekly first-game lock is an option. Sleeper adds AutoSubs, which swap in a bench player when a starter is inactive.

### Cited Findings
- **ESPN standard lineup:**
  - Starters: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE), 1 D/ST, 1 K, with 7 bench spots.
  - Optional slots: a second QB or OP (Offensive Player: QB/RB/WR/TE), extra flex spots, IDP positions, Head Coach, Punter, and IR. IR lets you stash injured players without using a bench spot.
  - — [ESPN settings](https://www.espn.com/nfl/story/_/id/19540805)
- **Yahoo defaults:**
  - Starters: 1 QB, 2 WR, 2 RB, 1 TE, 1 Flex, 1 K, 1 DEF, with 6 bench spots, 2 IR spots, and a 15-player maximum roster.
  - Injured players can be added straight into an IR slot from waivers or free agency.
  - Public leagues enforce draft position limits (QB 4, RB 6, WR 8, TE 4, K 4, DEF 4). Private leagues do not by default.
  - — [Yahoo defaults](https://help.yahoo.com/kb/SLN6489.html)
- **Sleeper IR:**
  - The commissioner sets up to 10 IR slots.
  - Eligible statuses: Out, Suspended, PUP, NA, DNR, Doubtful, or an official real-life IR placement. Some of these must be enabled by the commissioner.
  - If an IR-slotted player loses eligibility, the team's roster locks: no adds, claims, or roster moves until the team fixes it.
  - — [Sleeper IR](https://support.sleeper.com/en/articles/1983643-how-does-injured-reserve-ir-work)
- **Taxi squads and positional limits.** Sleeper offers taxi squads (a dynasty development stash), positional limits, and dual-eligible players. Travis Hunter, for example, has dual-position eligibility. — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **Lineup lock (ESPN):**
  - Leagues choose between locking at the first game of the week (typically Thursday) and locking each player at their own kickoff. Most leagues use per-player lock.
  - Under first-game lock, roster moves are allowed only Tuesday, Wednesday, and Thursday before kickoff.
  - — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- **Lineup lock (NFL.com).** Each player locks at their individual kickoff by default. The options are a first-game lock or never lock. — [NFL.com Setting Your Lineup (via search summary)](https://support.nfl.com/hc/en-us/articles/35869679382420-Setting-Your-Lineup)
- **Sleeper AutoSubs:**
  - When enabled, a manager can pair a bench player with a starter. If the starter is inactive, the bench player moves into the lineup automatically.
  - The commissioner sets how many AutoSubs each team gets per week.
  - The sub must be eligible for the starter's slot, and the pair can only be set before either player's game starts. Both players lock when either game kicks off.
  - Optional rule: the sub's game must start at the same time as or later than the starter's.
  - Each sub can cover only one starter, and AutoSubs can only be set in the mobile app.
  - — [Sleeper AutoSubs](https://support.sleeper.com/en/articles/9731991-how-does-player-autosubs-work)
- **Dropping after a game.** Sleeper has an FAQ titled "Why was someone able to drop their starter after they have played?", which implies a starter's points stay locked in after the player is dropped. — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football) (title only; body not read)

### Inferences
- **How FLEX works.** It is a starting slot that accepts any of several positions. The ESPN FLEX accepts RB, WR, or TE, and the "OP" or superflex variant also accepts QB.
- **Cricket analog.** Slots would be BAT (top order), BAT, WK, AR (all-rounder), BOWL, BOWL, plus a FLEX (BAT/AR/BOWL/WK). An "impact player" slot could double as a flex.
- **Lock rule for IPL.** Per-player lock at their match's toss or start is the direct analog. IPL double-header days (an afternoon and an evening match) map neatly onto NFL Sunday early and late windows.
- **AutoSubs for IPL.** They map to "not in playing XI," known at the toss, about 30 minutes before the start. This is very high-value for cricket because the playing XI is announced late.

### Gaps
- Sleeper's default starting lineup and bench count were not confirmed from the pages fetched.

## 3. Drafts: snake, auction, linear, 3RR, order, timers, autopick, queues, mock drafts, ADP

### Takeaway
Snake is the universal default. Auction (a salary-cap draft) is the main alternative. Linear (non-snake) and 3rd Round Reversal are Sleeper options. When the pick timer expires, autopick takes from the manager's queue first, then from rankings adjusted for roster needs.

### Cited Findings
- **Sleeper draft types:**
  - Snake is the default.
  - Non-snake (linear) is an option.
  - 3rd Round Reversal is a snake that reverses again at round 3, so the team picking last in round 2 also picks last in round 3. This offsets the 1.01 advantage.
  - Auction: owners bid from a budget and can bid at any time while they have money.
  - Startup drafts and supplemental drafts are also supported. Supplemental drafts are dynasty-only, capped at 10 rounds, and unlimited in number.
  - The commissioner can manually edit the draft board.
  - — [Sleeper Draft Types](https://support.sleeper.com/en/articles/1876072-what-draft-types-are-supported)
- **ESPN draft modes:**
  - Offline (in person, rosters entered afterward).
  - Live online snake: in a 10-team league, pick 1 is followed by pick 20.
  - Autopick: ESPN drafts for every team.
  - Salary Cap (auction).
  - Absent managers are autodrafted during live online drafts.
  - — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- **Sleeper autopick:**
  - The CPU picks from the owner's queue first. If the queue is empty, it picks a higher-ranked available player, considering positional needs.
  - When the pick timer expires, the system auto-picks.
  - The commissioner can "Force CPU Auto Pick," and only the commissioner can set other teams to autopick.
  - — [Sleeper CPU auto-pick](https://support.sleeper.com/en/articles/4038850-where-does-the-cpu-auto-pick-from)
- **Other Sleeper draft features (article titles):**
  - mock drafts
  - pre-draft rankings
  - a Watch List vs. Draft Queue distinction
  - casting the draft to a big screen
  - offline drafts
  - trading during a draft
  - skipping picks
  - compensatory picks
  - dispersal drafts
  - a draft timer article
  - changing the draft date and time
  - — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **Platform ADP.** Sleeper's default rankings and ADP differ from other platforms' and are exploitable. Industry sites publish cross-platform ADP comparisons. — [RotoWire on Sleeper ADP](https://www.rotowire.com/football/article/2025-fantasy-football-adp-exploiting-default-rankings-and-adp-on-sleeper-app-94834); [Fantasy Footballers ADP comparison](https://www.thefantasyfootballers.com/analysis/comparing-adp-across-platforms-to-find-value-fantasy-football)
- **Initial waiver order.** Yahoo seeds initial waiver priority from the draft: in live and autopick drafts, the last pick gets first priority. — [Yahoo waivers](https://help.yahoo.com/kb/SLN6427.html)
- Sleeper also bases initial priority on draft order, with later picks getting better priority. — [Sleeper FAAB](https://support.sleeper.com/en/articles/1876040-how-does-faab-bidding-work)

### Inferences
- **Draft MVP:** snake plus auction, a randomize-order button, configurable per-pick timers (from seconds for live drafts to hours for slow drafts), a queue, platform rankings or ADP, autopick fallback (queue, then rankings filtered by need), mock drafts against CPUs, and an offline-entry mode.
- **ADP needs a ranking source.** A new cricket app must seed rankings from projections, because no ADP exists before users draft.

### Gaps
- Specific timer lengths (Sleeper, ESPN, Yahoo defaults) were not retrieved. The Sleeper timer article was not fetched.
- How draft order is randomized (timing, commissioner-triggered or automatic) was not documented in the pages fetched.

## 4. Matchups, schedule, standings, median, playoffs, consolation

### Takeaway
Head-to-head points is the default everywhere. Standings tiebreakers default to points for, then points against (Sleeper) or head-to-head and division (common elsewhere). Playoffs are typically 4 or 6 teams over NFL Weeks 15-17, with byes for the top 2 seeds in 6-team brackets. Sleeper offers an optional weekly median game, plus a consolation bracket or a "Toilet Bowl" for non-playoff teams.

### Cited Findings
- **Scoring format.** ESPN's format is head-to-head points with one opponent per week. — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- Yahoo's default is head-to-head points. — [Yahoo defaults](https://help.yahoo.com/kb/SLN6489.html)
- **Schedule.** Sleeper commissioners can randomize the league schedule. — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **League median (Sleeper):**
  - Each team plays its normal head-to-head matchup and also gets a win, loss, or tie against the league median. The median is the average of the two middle scores; a 10-team example gives (178.54 + 170.48)/2 = 174.51.
  - It applies in the regular season only, not in playoffs or consolation games.
  - It is Sleeper's only way to give a team a second weekly game; doubleheaders are not supported.
  - — [Sleeper median](https://support.sleeper.com/en/articles/3971690-extra-game-each-week-against-league-median)
  - The effect is that the top half of scorers each week get an extra win. In 2023, only Sleeper and ESPN offered a median option among the majors. — [RotoStreetJournal](https://www.rotostreetjournal.com/2023/08/04/fantasy-football-league-settings-what-is-league-median-and-why-your-league-should-implement-it/)
  - Yahoo also has a league median option, which works only in the regular season. Yahoo cites it in its Commissioner Plus offering. — [Yahoo Commissioner Plus (search summary)](https://help.yahoo.com/kb/SLN36403.html)
- **Sleeper standings tiebreakers:**
  - Order: record, then Points For, then Points Against (higher wins), then a coin flip unless the commissioner sets custom seeding. Head-to-head can only be applied by manual seeding.
  - Regular-season matchup ties stand as ties, though the commissioner can edit scores.
  - A tie in a playoff matchup goes to the higher seed.
  - — [Sleeper tiebreakers](https://support.sleeper.com/en/articles/4238872-can-i-set-tiebreakers)
- **Common tiebreaker convention.** Most platforms break ties by total points first, then head-to-head, then division record. — [RotoStreetJournal 2025](https://www.rotostreetjournal.com/2025/12/02/preparing-for-your-fantasy-football-playoffs-run/) (secondary source)
- **Sleeper playoff seeding:**
  - Without divisions, seeds are ranked by record, then PF, then PA, then a coin toss.
  - With divisions, division winners make the playoffs first. In 6-team playoffs, the 2 best division winners get byes.
  - The commissioner can change the playoff team count any time before the playoffs start.
  - — [Sleeper playoffs](https://support.sleeper.com/en/articles/2203518-how-do-playoff-teams-get-determined)
- **Sleeper reseeding and championship length.** There is a reseeding toggle, so the highest remaining seed plays the lowest. Sleeper supports a two-week championship. — [Sleeper playoff seeding (search summary)](https://support.sleeper.com/en/articles/2528718-can-i-customize-my-league-s-playoff-seeding)
- **Consolation (Sleeper).** Up to 8 non-playoff teams go into either a Consolation Bracket (winners advance) or a Toilet Bowl (losers advance, and the last team standing is the "💩 King"). — [Sleeper Consolation vs Toilet Bowl (search summary)](https://support.sleeper.com/en/articles/2203534-consolation-bracket-vs-toilet-bowl)
- **ESPN playoff templates:**
  - 4 teams over Weeks 16-17.
  - 4 teams over Weeks 15-18, with two-week rounds.
  - 6 teams over Weeks 15-17: the top 2 seeds get a Week 15 bye.
  - ESPN advises against Week 18 as the only championship week, because NFL starters rest.
  - Divisions: with 2 divisions, the division winners get the top 2 seeds. With 3 divisions (12+ teams), the 3 division winners get the top seeds.
  - — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
  - In ESPN's baseball documentation, reseeding, variable matchup lengths, and restricting transactions for eliminated teams appear as playoff options. — [ESPN baseball playoff settings (search summary)](https://africa.espn.com/flb/story/_/id/39739042/fantasy-baseball-custom-league-playoff-settings)
- **Yahoo default.** Playoffs in Weeks 16-17 with 4 teams, plus a 4-team consolation bracket. — [Yahoo defaults](https://help.yahoo.com/kb/SLN6489.html)
- **NFL.com default.** 4-team playoffs in Weeks 15-16. — [NFL.com League Types (via search summary)](https://support.nfl.com/hc/en-us/articles/35869678503060-League-Types-Settings) (unverified: the page returned 403 on fetch)
- **Common 6-team format.** Weeks 15-17, with byes for the top 2. — [RotoWire FAQ](https://www.rotowire.com/faq/how-many-weeks-are-the-fantasy-football-playoffs-538d1fc0)

### Inferences
- **IPL timing.** The IPL league stage runs about 10 weeks, followed by its own playoffs (Qualifier 1, Eliminator, Qualifier 2, and the Final).
  - A fantasy regular season of about 7-8 "rounds" plus 2 fantasy playoff weeks fits.
  - The IPL's own playoff week has only 4 matches and 4 teams, which is analogous to the NFL "Week 18 rest" problem: the fantasy championship should not rely on the IPL playoff week, or must use a deeper roster or best-ball.
- **Median scoring** is more valuable in short seasons (fewer H2H games, more schedule luck), so a 10-week IPL season is a strong case for enabling it by default.

### Gaps
- How each platform generates the round-robin schedule algorithmically was not documented. This is standard round-robin, but unverified per platform.
- Whether Sleeper median wins feed into seeding and tiebreakers was not stated. The implication is that they count toward record.

## 5. Waivers: timing, priority types, FAAB, free agency, limits

### Takeaway
After a player's game locks, they go on waivers until a weekly processing time, typically Tuesday night or Wednesday early morning for the NFL. Claims resolve by one of three methods:
- **Rolling priority** (successful claimer goes to the bottom). This is the default on Sleeper and Yahoo.
- **Reverse standings** (resets weekly).
- **FAAB blind bidding** (default $100, $0 bids often allowed, ties broken by rolling priority).

Unclaimed players then become first-come-first-served free agents.

### Cited Findings
- **Sleeper waiver types.** FAAB, Rolling (the default: continuous, and a successful claimer moves to the bottom), and Reverse Standings (resets weekly by standings). The FAAB default is $100, and the commissioner can edit budgets anytime. — [Sleeper waiver types](https://support.sleeper.com/en/articles/9656662-what-types-of-waivers-do-you-support)
- **Sleeper FAAB details:**
  - Bids are blind and default minimum is $0, so teams with no budget left can still claim. The commissioner can raise the minimum.
  - Claims rank by bid amount, and managers can reorder only equal bids.
  - Ties are broken by rolling waiver priority, initially set by draft order (later picks get higher priority). Free agent pickups don't change priority.
  - FAAB is tradable, and the league budget is the cap.
  - Budgets don't auto-reset between seasons.
  - Claims can be marked "(Invalid)", for example when a roster limit isn't met.
  - — [Sleeper FAAB](https://support.sleeper.com/en/articles/1876040-how-does-faab-bidding-work)
- **Sleeper "Suggested FAAB Bids".** This feature exists (title only). — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **Sleeper After Game Waivers and Custom Daily Waivers:**
  - After a player's game, they are held out of free agency until the chosen clear day. Claims are accepted meanwhile.
  - Custom Daily Waivers set a processing time per day. Each day gets one of four modes: FA, Waivers, Locked, or Waivers→FA.
  - Default processing is about 3 AM. The page also cites 2 AM, so it is inconsistent.
  - A separate setting controls the post-drop waiver period.
  - If neither option is on, all players are free agents.
  - Undrafted players become free agents right after the draft unless Custom Daily Waivers keeps them on waivers.
  - — [Sleeper After Game/Custom Daily Waivers](https://support.sleeper.com/en/articles/3242468-after-game-waivers-custom-daily-waivers)
  - Example: a "Tue After Day" setting processes at 12:05 a.m. PT Wednesday. — [Sleeper waivers (search summary)](https://support.sleeper.com/en/articles/1876041-what-types-of-waivers-do-you-support)
- **Yahoo waivers:**
  - Weekly waivers end after 11:59 p.m. PT Tuesday.
  - Default start is "Game Time - Tuesday": a player goes on waivers when their game starts. Players without a game that week go on waivers at 5:30 p.m. PT Monday.
  - Continuous waivers default to 2 days, configurable from none to 7 days.
  - Priority types:
    - Continual Rolling List (never resets)
    - Reverse Order of Standings (resets weekly, freezes at the playoffs)
    - Weekly Rolling List Based on Standings
  - FAB:
    - The default budget is $100, configurable from $1 to $999 per the help page.
    - Bids are blind, from $0 to the remaining budget.
    - Ties are broken by the commissioner's chosen priority type.
    - Budgets don't replenish.
  - Managers can't reclaim a player they dropped until that player's waiver period ends.
  - Yahoo encourages multiple "conditional" claims.
  - — [Yahoo waivers](https://help.yahoo.com/kb/SLN6427.html)
  - **Conflict:** another Yahoo help page cites a FAB budget range up to $999,999,999. — [Yahoo waivers overview (search summary)](https://help.yahoo.com/kb/SLN8367.html)
- **Yahoo default waiver settings.** A 2-day waiver period, continual rolling list, weekly waivers at Tuesday game time, no maximum on acquisitions or trades. — [Yahoo defaults](https://help.yahoo.com/kb/SLN6489.html)
- **ESPN acquisition systems.** Standard Waivers, FAB (Continuous), FAB, and No Waivers. The system is locked at draft start. A winning standard claim moves the team to the end of the order. — [ESPN Waivers Overview (search summary)](https://support.espn.com/hc/en-us/articles/360000041152-Waivers-Overview)
- **ESPN waiver details.** Dropped players sit on waivers "a day or two". The season acquisition limit is unlimited by default and can be capped. An "Undroppable Players" list (ESPN-managed) prevents collusive or tanking drops. — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- **NFL.com waivers.** Default waiver priority resets every Tuesday to inverse order of standings. Free agents lock at game time by default. Teams can claim with a 0-point offer once their budget is spent. — [NFL.com (via search summary)](https://support.nfl.com/hc/en-us/articles/35869720023060-League-Settings) (unverified: 403 on direct fetch)
- **Restricting eliminated teams.** ESPN can prevent eliminated teams from claiming free agents during the playoffs. This is documented for fantasy baseball. — [ESPN baseball (search summary)](https://africa.espn.com/flb/story/_/id/39739042/fantasy-baseball-custom-league-playoff-settings)

### Inferences
- **Cricket waiver cycle.** IPL plays nearly every day, often two matches a day, so a single weekly Tuesday clear doesn't map cleanly.
  - Sleeper's "Custom Daily Waivers", with per-day mode (FA, Waivers, Locked, Waivers→FA), is the most directly reusable model.
  - Example: hold a FAAB waiver run once or twice a week at a fixed time and run free agency in between, with players who have played locked until the next clear.
- **Data model for a waiver claim.** It needs: add player, optional drop player, bid (FAAB), manager-set rank, status (pending, success, failed, invalid), and a reason. A deterministic processing order is required: highest bid, then priority tiebreak, then roster-validity check.

### Gaps
- ESPN's exact processing time and default type weren't retrieved.
- Each platform's default acquisition and transaction caps beyond "unlimited" weren't detailed.
- Sleeper's default post-drop waiver duration was not stated.

## 6. Trades: proposal/accept, review, veto, deadline

### Takeaway
A trade flows: propose, then counterparty accepts, then an optional review period (commissioner review or league vote), then it processes. Defaults lean toward no review, or league veto voting over 1-2 days. Commissioners can always force or veto. A trade deadline is standard in redraft leagues.

### Cited Findings
- **Sleeper review and veto.** After all parties accept, a vote prompt appears showing the time remaining, who voted, and how many votes are needed to veto. The commissioner can veto or pass any trade at any time. — [Sleeper veto](https://support.sleeper.com/en/articles/3200544-can-i-veto-a-trade)
- **Other Sleeper trade features (article titles).** Exploding trades, trade block, trading during the draft, trading draft picks, disabling trading, the trade deadline, a weekend-trade impact explainer, a "new trading experience", and commissioner force-trade. — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **Tradable FAAB.** Sleeper FAAB can be included in trades. — [Sleeper FAAB](https://support.sleeper.com/en/articles/1876040-how-does-faab-bidding-work)
- **ESPN trades:**
  - Unlimited by default, with an optional trade deadline. A deadline is "generally a good idea" in redraft; many keeper leagues have none.
  - Optional trade review gives managers "a day or two" to vote to veto.
  - ESPN advises reserving vetoes for collusion or tanking, not for lopsided trades.
  - — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- **Yahoo trades.** The default trade rejection time is 2 days, with no maximum number of trades. The trade deadline varies by season. — [Yahoo defaults](https://help.yahoo.com/kb/SLN6489.html)

### Inferences
- **Trade state machine:** proposed, then countered, accepted, rejected, expired ("exploding" with a time-to-live), or withdrawn. Accepted trades go to review (none, commissioner, or league vote with an N-vote threshold), then processed or vetoed. Roster validity is checked at processing, and players already locked for the current period stay with the original team for that period.
- **IPL deadline.** A trade deadline for IPL would sit around the end of the league stage's second-to-last fantasy week.

### Gaps
- Sleeper's veto vote threshold, review duration, and default deadline week weren't stated in the article fetched.
- ESPN's default trade review setting wasn't confirmed.

## 7. Scoring: standard vs PPR vs half-PPR, live scoring, projections, stat corrections, decimals

### Takeaway
The main scoring presets are Standard (no points per reception), Half-PPR (0.5), and Full PPR (1.0). ESPN defaults to PPR with fractional points, and Yahoo defaults to 0.5 PPR with fractional yardage. Stats update live from a data provider and are corrected over the following days, with Sleeper's last correction expected by Thursday. Matchups aren't truly final until then.

### Cited Findings
- **ESPN presets.** PPR Fractional (the default and recommended), PPR Standard, Standard, Fractional, and Custom.
  - Custom examples: 1 point per 15 rushing yards, 0.5 per reception, 100-yard and 300-yard bonuses, sack penalties for QBs.
  - — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- **Yahoo default scoring:**
  - Receptions: 0.5 points.
  - Passing: 1 point per 25 yards, 4 per TD, -1 per interception.
  - Rushing and receiving: 1 point per 10 yards, 6 per TD.
  - Fumble lost: -2.
  - Field goals: 3-5 points by distance. Extra point: 1.
  - Defense: 2 per interception or fumble recovery, 6 per TD, 1 per sack, and points-allowed tiers from +10 (shutout) to -4 (35+ allowed).
  - Fractional points and negative points: yes.
  - — [Yahoo defaults](https://help.yahoo.com/kb/SLN6489.html)
- **Sleeper scoring articles.** Scoring options, reception bonuses, special-teams scoring, Points Allowed and Yards Allowed calculation, a player points breakdown view, and "Stacks." — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football)
- **Sleeper stat corrections:**
  - The data provider updates live and then corrects over the next couple of days. Corrections can arrive through Thursday, though most come by Monday or Tuesday.
  - The weekly report doesn't mark a matchup as final, and scores can change.
  - Sleeper makes its own corrections to match official NFL stats if the provider misses something.
  - The "Stat Corrections" view shows only starters in your league, by week.
  - — [Sleeper stat corrections](https://support.sleeper.com/en/articles/2441282-stat-corrections)

### Inferences
- **Cricket scoring presets.** Cricket needs presets analogous to PPR and standard: for example, "Standard" (runs, wickets, catches), a "Strike-rate/Economy" variant (bonuses and penalties like PPR's reception weighting), and Custom.
- **Fractional scoring** suits cricket naturally, for example 0.5 per run with boundary bonuses.
- **Stat correction window.** Cricket scorecards are corrected less often but do get amended. A "provisional until T+48h" model mirrors Sleeper's.

### Gaps
- How projections are generated (in-house or vendor) on each platform was not found.
- Live-scoring latency specifics were not found.

## 8. Bye weeks and uneven schedules

### Takeaway
NFL bye weeks are the closest analog to uneven IPL schedules. Platforms handle them through:
- bench depth;
- the waiver wire;
- per-player lock, so managers can react late;
- Sleeper's AutoSubs, for inactive starters;
- best-ball lineup types, which pick automatically.

IPL's variable 1-3 matches per team per fantasy week is a bigger structural issue than NFL byes, and it calls for an explicit design choice.

### Cited Findings
- A fantasy team-count bye (an odd number of teams) is distinct from NFL player byes. ESPN notes that odd-sized leagues force fantasy byes. — [ESPN](https://www.espn.com/nfl/story/_/id/19540805)
- Yahoo's default settings list "Bye weeks: None", meaning no fantasy-team byes. — [Yahoo defaults](https://help.yahoo.com/kb/SLN6489.html)
- **AutoSubs.** Sleeper AutoSubs replace inactive starters with a same-position bench player whose game hasn't started. An optional rule requires the sub's game to start at the same time or later. — [Sleeper AutoSubs](https://support.sleeper.com/en/articles/9731991-how-does-player-autosubs-work)
- **Best Ball.** Sleeper offers Best Ball as a lineup type, an alternative to Classic manual lineups. — [Sleeper League Types](https://support.sleeper.com/en/articles/3537396-league-types-formats)
- **Yahoo add deadline.** With waivers off, a player must be added by 11:59 p.m. PT Sunday to count for that game week. — [Yahoo waivers](https://help.yahoo.com/kb/SLN6427.html)

### Inferences
- **Design options for IPL uneven games** (inferences; no platform documents cricket):
  1. **Weekly H2H with summed points across all matches a player plays that week (NFL-style).** This rewards picking players from teams with more fixtures, a "schedule streaming" skill similar to fantasy basketball games-played strategy.
  2. **Per-match lineup locks and a weekly matchup** (per-player lock, so managers can change non-started players between matches).
  3. **Cap on counted matches per slot** (for example, a player's best 2 matches count), which normalizes the variance.
  4. **Best-ball weekly**, where the optimal XI is computed after the week.
  5. **Short fantasy "rounds"** aligned to blocks of about 7-8 IPL matches, where most teams play about once or twice.
- Showing "matches this week" per player in the lineup UI is essential. This is the analog of the NFL bye-week indicator.

### Gaps
- No documentation was found on how fantasy basketball and hockey on these platforms handle variable games per week. That is the closest analog, and a worthwhile follow-up: ESPN, Yahoo, and Sleeper all run daily or weekly NBA leagues, and Sleeper has a Fantasy Basketball collection.

## 9. Sleeper differentiators: chat, live scoring UX, notifications, trending, news, side games, mobile-first

### Takeaway
Sleeper's edge is social: league chat embedded on nearly every screen, with transactions posted into chat. Engagement is high, with a company-claimed 50 minutes a day in season. The product is mobile-first and largely ad-free, with deep customization (dynasty, best ball, chopped, IDP, AutoSubs, Custom Daily Waivers), polished commissioner tools, and a broad set of side games.

### Cited Findings
- **Social design.** Sleeper built fantasy around social features, with chat a swipe away on almost every screen and in-season actions surfacing inside chat. The CEO cited about 50 minutes a day of in-season usage. That figure is a company claim. — [TechCrunch](https://techcrunch.com/?p=1868752); [CNBC 2019](https://www.cnbc.com/2019/08/25/sleeper-casual-fantasy-football-start-up-battling-yahoo-and-espn.html)
- **Audience.** Sleeper targeted casual fans, first-time players, and women. — [CNBC 2019](https://www.cnbc.com/2019/08/25/sleeper-casual-fantasy-football-start-up-battling-yahoo-and-espn.html)
- **User counts (company-sourced, conflicting).** Sleeper announced over 10M active users in October 2023, while a 2024 profile said over 5M MAU. — [search summary: Sleeper blog / profiles](https://www.highperformr.ai/company/sleeperhq) (weak; unverified)
- **Chat-integrated tools:**
  - The commissioner action list shows which commish actions trigger a league chat message.
  - The Dues Tracker posts payment reminders to league chat every Tuesday at 12:00 PM.
  - Sleeper has direct messages ("Can I delete direct messages?").
  - — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football); [Sleeper Dues Tracker](https://support.sleeper.com/en/articles/11862228-fantasy-league-dues-tracker)
- **Other UX features (article titles):**
  - custom player notes
  - player nicknames
  - cross-league ownership view
  - league history and weekly reports
  - "League Legend"
  - casting the draft to a TV
  - an iPad app
  - league organization and archiving
  - Suggested FAAB Bids
  - Account and Notification Settings collection
  - — [Sleeper collection](https://support.sleeper.com/en/collections/410900-fantasy-football); [Sleeper support home](https://support.sleeper.com/en/)
- **Side products.** Sleeper's help center lists:
  - DFS: Sleeper Picks (61 articles)
  - Sleeper Team Picks
  - Pick'em and Survivor
  - Bracket Mania
  - Sleeper Mini Games
  - Fantasy Basketball and Fantasy FC (soccer)
  - "Sleeper Safe"
  - — [Sleeper support home](https://support.sleeper.com/en/)
- **Reviewer comparisons.** Sleeper is seen as stronger for dynasty and keeper customization, while ESPN is seen as simpler for casual redraft. Some users find Sleeper cluttered. — [Parse AI aggregation (weak)](https://www.parse.gl/prompts/p/sleeper-vs-espn-for-a-season-long-fantasy-league-which-one-is-better--dfaff32e-d25b-421a-8f3a-b6b2af89c550); [unstar.app 2026 comparison](https://unstar.app/blog/sleeper-espn-yahoo-nfl-cbs-fantasy-sports-apps-ranked-2026)
- **Game-day complaints.** A 2026 review of 1-star reviews across Sleeper, ESPN, and Yahoo found game-day freezing and delayed alerts across the whole category. — [unstar.app](https://unstar.app/blog/sleeper-espn-yahoo-nfl-cbs-fantasy-sports-apps-ranked-2026)

### Inferences
- **What to replicate for an IPL app:**
  1. League chat as the home screen, with system posts for trades, waivers, and commish actions.
  2. A live matchup screen with per-player live points and "yet to bat or bowl" indicators.
  3. Push notifications for playing XI announced, player not in XI, waiver results, trade offers, and close matchups.
  4. Trending adds and drops.
  5. Player news.
  6. Pick'em as a cheap side game.
  7. Rich commissioner tools.

### Gaps
- Sleeper's "trending adds/drops", live-scoring UX details, and player news sourcing were not documented in the sources fetched. They are known product features, but no citation was retrieved.
- No reliable 2025-2026 Sleeper user count was found.

## 10. Monetization of free season-long leagues

### Takeaway
ESPN and Yahoo monetize season-long leagues mainly through ads, with optional premium tiers; Yahoo has "Commissioner Plus". Sleeper keeps season-long leagues free and largely ad-free, and monetizes through paid contests (Sleeper Picks DFS) and adjacent products. League dues are tracked in-app but settled off-platform; services like LeagueSafe are not cited here.

### Cited Findings
- **Sleeper's model.** Free to play; it does not rely on ads and earns from paid contests and premium features. — [search summary of TechCrunch/profiles](https://techcrunch.com/?p=1868752) (secondary; verify)
- **Sleeper side products.** Sleeper runs Sleeper Picks (DFS), Sleeper Team Picks, and "Responsible Risk Management" pages, indicating real-money products. — [Sleeper support home](https://support.sleeper.com/en/)
- **Sleeper dues.** The Dues Tracker only tracks who has paid; "money exchanges should be handled outside Sleeper." — [Sleeper Dues Tracker](https://support.sleeper.com/en/articles/11862228-fantasy-league-dues-tracker)
- **Yahoo premium.** Yahoo offers a paid "Commissioner Plus" upgrade, which includes options like league median. — [Yahoo Commissioner Plus (search summary)](https://help.yahoo.com/kb/SLN36403.html)

### Inferences
- **For an Indian IPL app,** real-money fantasy is governed by Indian law. A 2025 national ban on real-money online gaming would be highly relevant but is out of scope for this note; verify separately.
- **Free-to-play season-long leagues** monetize via ads, premium commissioner tools, and cosmetics.

### Gaps
- LeagueSafe, and ESPN and Yahoo ad and premium details, were not researched with citable sources.

## 11. Data and stat providers

### Takeaway
None of Sleeper, ESPN, or Yahoo publicly names its NFL fantasy stats vendor in the sources found. Sportradar is the documented provider for major DFS operators (FanDuel, DraftKings) and was the NFL's official data distributor from 2015. Sleeper's help page refers only to "your data provider".

### Cited Findings
- In 2015, FanDuel partnered with Sportradar for the official NFL data feed. The NFL had named Sportradar its exclusive statistics distributor that year. — [FSGA / FanDuel–Sportradar](https://thefsga.org/fanduel-teams-with-sportradar-to-bring-daily-fantasy-players-the-fastest-nfl-scores-and-stats)
- DraftKings extended its long-term partnership with Sportradar. — [SportBusiness](https://sportbusiness.com/news/sportradar-to-continue-to-fuel-draftkings-offering)
- Sleeper's stat correction page references an unnamed "data provider." Sleeper applies its own corrections to match official NFL stats when the provider misses something. — [Sleeper stat corrections](https://support.sleeper.com/en/articles/2441282-stat-corrections)
- Yahoo has a Fantasy Sports API (OAuth 2.0) for league data, without naming its stats vendor. — [Yahoo developer](https://sports.yahoo.com/developer/)

### Inferences
- For IPL, the candidate vendors are Sportradar, Stats Perform (Opta), Roanuz/Cricket API, and EntitySport. They are listed here for follow-up only; none was researched in this note.

### Gaps
- No confirmed vendor was found for Sleeper, ESPN, Yahoo, or NFL.com.
- Current (2025-2026) NFL official data rights holders were not verified. Genius Sports reportedly holds NFL official data rights since 2021, but this is not cited here.
