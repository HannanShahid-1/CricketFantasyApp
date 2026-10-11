# IPL Fantasy App: Scoring Systems, Competitive Landscape, and Legal/Market Environment (as of 2026-10-11)

Research note: several official sources (dream11.com/fantasy-cricket/point-system, fantasy.iplt20.com rules/T&C pages) returned HTTP 502 to automated fetches; Dream11's "How to Play" page loaded and is the primary source for the Dream11 table. My11Circle's points page URL returned 404. Many search results for scoring tables are low-quality SEO/affiliate blogs with conflicting values; these are flagged where used.

## 1. Reference scoring systems (Dream11, official IPL Fantasy, My11Circle, season-long products)

### Takeaway
Dream11's current T20 table (wicket +30, boundary +4, six +6, dot ball +1, 25/50/75/100 milestones, SR and economy bands, C 2x / VC 1.5x, +4 for announced lineup and +4 for impact/substitute appearance) is the only fully verified, primary-sourced table and is the de facto industry template. The official IPL Fantasy game for 2026 is a free season-long salary-cap game hosted by My11Circle (11 players, C 2x / VC 1.5x, 160 transfers in league stage, six boosters, no impact-player rule), but its full points table could not be retrieved from a primary source. Season-long draft products (Pitch Rival, CricBattle) use simplified Dream11-style values (run 1, wicket 25, fifty +10).

### Cited Findings

**Dream11 T20 (current; primary source — Dream11 "How to Play" page)** — [Dream11 How to Play](https://www.dream11.com/games/fantasy-cricket/how-to-play)
- Batting: Run +1; Boundary bonus +4; Six bonus +6; 25-run bonus +4; 50-run bonus +8; 75-run bonus +12; 100-run bonus +16 (century earns only the century bonus, not the 25/50/75 bonuses); Duck -2 (batter, wicket-keeper, all-rounder only).
- Bowling: Dot ball +1 (dot-ball points also awarded on byes/leg-byes); Wicket (excl. run out) +30 (marked "New" — previously +25); LBW/Bowled bonus +8; 3-wicket bonus +4; 4-wicket bonus +8; 5-wicket bonus +12; Maiden over +12.
- Fielding: Catch +8; 3-catch bonus +4; Stumping +12; Run out (direct hit) +12; Run out (not direct hit) +6.
- Other: Captain 2x; Vice-captain 1.5x; In announced lineup +4; Playing substitute (Concussion, X-Factor, or Impact Player) +4.
- Strike-rate bonus/penalty (min 10 balls, excludes bowlers): >170 +6; 150.01–170 +4; 130–150 +2; [70–130: 0]; 60–70 -2; 50–59.99 -4; <50 -6.
- Economy bonus/penalty (min 2 overs): <5 +6; 5–5.99 +4; 6–7 +2; [7–10: 0]; 10–11 -2; 11.01–12 -4; >12 -6.
- Conflict: one version of the Dream11 page reportedly listed "Dot Ball (every 3 dot balls) +1" while another shows "Dot Ball +1" per dot — [WebSearch summary of Dream11 pages](https://www.dream11.com/games/fantasy-cricket/how-to-play). The fetched page showed +1 per dot ball. Treat as needing in-app verification.
- Older (c. 2021) Dream11 values commonly still repeated on third-party sites: wicket +25, boundary +1, six +2, 30-run bonus +4, half-century +8, century +16 — [Sportskeeda](https://www.sportskeeda.com/cricket/dream11-points-system). These are outdated.
- A 2026 blog claims Dream11 added a "Velocity Bonus" (170+ SR) and "Utility Synergy" all-rounder bonus, with no amounts given — [possible11.com](https://possible11.com/blog/dream11-points-system-2026-all-rounders-are-more-valuable/). Unverified; not reflected on Dream11's own page — treat as unreliable.

**Official IPL Fantasy (fantasy.iplt20.com), 2026 season**
- The official T&C page is titled "Official TATA IPL Season Long Fantasy 2026 hosted by My11Circle" — [fantasy.iplt20.com T&C (search snippet)](https://fantasy.iplt20.com/classic/more/tnc). (Page itself returned 502 to fetch.)
- Six boosters; all except Wildcard and Free Hit can be used twice; "Triple Captain" named — [fantasy.iplt20.com T&C (search snippet)](https://fantasy.iplt20.com/classic/more/tnc). Third-party guides name "Double Points" (whole team 2x for one match), "Indian Warrior" (Indian players 2x), and "Triple Impact" boosters — [Sportsdunia](https://www.sportsdunia.com/ipl-news/how-to-play-ipl-fantasy-league) / [timesofsports](https://www.timesofsports.com/cricket/ipl/play-ipl-fantasy-league-new-rules-and-tips/) (secondary, unverified).
- Format: 11-player team; no Impact Player rule in the fantasy game; C 2x / VC 1.5x; unlimited changes before Match 1; 160 transfers through the league stage (provisionally Match 80); unlimited between league stage and Qualifier 1; up to 10 transfers between Qualifier 1 and Final; C/VC changeable any time; free contests; launched for a season starting 28 March 2026 (84 matches) — [CricketWinner, 21 Mar 2026](https://www.cricketwinner.com/cricket-news/ipl-introduces-official-fantasy-league-ahead-of-2026-season/).
- Points values cited by third parties for IPL Fantasy: run +1, wicket +25, catch +8, stumping/direct run-out +12, assisted run-out +6, duck -2 — [cricthugs](https://cricthugs.com/ipl-2026-fantasy-league-points-system/) / [comecomdream11.dev](https://comecomdream11.dev/ipl/points-system/). Sources conflict on six bonus (+2 vs +6) and maiden (+4, +8, +12). Low-quality sources; full official table unverified.

**My11Circle**
- App Store listing: captain 2x, vice-captain 1.5x; teams built with 100 credits — [My11Circle App Store](https://apps.apple.com/in/app/id1503278907). Full points table not found (official URL 404).

**Season-long / draft products**
- Pitch Rival (free): 15-man squad, start 11 per gameweek; snake or auction draft; weekly H2H; 6 regular-season gameweeks + 2 playoff gameweeks (10-team, 4 playoff spots); 48-hour waivers, worst team first; scoring: run 1, six +1 bonus, fifty +10, wicket 25, C 2x / VC 1.5x — [Pitch Rival guide (May 2026)](https://pitchrival.com/guide).
- CricBattle: 50+ customizable scoring variables, bonus scoring, "exclude X lowest-scoring match" option; no default values published on homepage — [CricBattle](https://www.cricbattle.com/).
- Open-source IPL-Fantasy (GitHub): 15-round snake draft, weekly H2H, weekly blind FAAB waivers — [GitHub smitpatel316/IPL-Fantasy](https://github.com/smitpatel316/IPL-Fantasy).

**Role balance / per-role averages**
- No published analysis of average Dream11 points per match by role for IPL was found. A Kaggle dataset provides IPL per-player Dream11-style fantasy points for all seasons, which could be grouped by role — [Kaggle](https://www.kaggle.com/datasets/sukhdayaldhanday/dream-11-fantasy-points-data-of-ipl-all-seasons). An ACM paper converts predicted performance into Dream11 points but publishes no role averages — [ACM DL](https://dl.acm.org/doi/10.1145/3698062.3698091).
- A strategy claim that all-rounders get "twice the scoring opportunities" — [cricjosh / possible11 (opinion)](https://possible11.com/blog/dream11-points-system-2026-all-rounders-are-more-valuable/); a betting-tips claim that >60% of top single-match Dream11 scorers are top-3 batters or death bowlers has no methodology (unreliable).

### Inferences
- Worked examples under the current Dream11 table (my arithmetic, not sourced): a bowler with 4-0-30-2 (econ 7.5, ~8 dots, one bowled) = 4 (lineup) + 60 + 8 + 8 = ~80; a batter with 40 off 28 (4x4, 2x6, SR 143) = 4 + 40 + 16 + 12 + 4 (25 bonus) + 2 = 78. So the 2025+ table (wicket +30, dot +1, boundary +4) roughly balances a good bowling spell with a good batting knock, while the older +25 wicket / +1 boundary table favoured bowlers per event but batters via milestones.
- Role imbalance risks for a season-long draft: (a) all-rounders who bat top-6 and bowl 4 overs collect from both pools and will be over-drafted unless roster slots constrain them; (b) wicket-keepers get stumpings/catches bonus; (c) per-dot points heavily reward economical powerplay/death bowlers; (d) the +4 "announced lineup" and +4 impact-sub points matter in season-long formats where bench/non-selection is common — consider whether to keep them; (e) high-variance milestone bonuses make H2H weekly outcomes noisier. Founder should compute role means/medians from Cricsheet ball-by-ball data with the chosen table before finalizing roster slot requirements (e.g., min 3 bowlers, max 2–3 all-rounders).
- Because IPL teams play ~2 matches per week, weekly H2H in a season-long draft naturally sums ~1–3 matches per player; scheduling imbalance (one franchise playing 3 vs 1 in a week) is a key fairness issue to design around (e.g., cap matches counted, or per-match average).

### Gaps
- Full official IPL Fantasy 2026 points table (fantasy.iplt20.com pages returned 502); full My11Circle table (404).
- ESPNcricinfo fantasy and Fantrax cricket scoring — not researched/no sources found.
- No published per-role average fantasy points for IPL; needs own computation.

## 2. Competitive landscape and the gap for a season-long draft app

### Takeaway
Match-by-match daily fantasy (Dream11, My11Circle, MPL) dominated Indian cricket fantasy until the August 2025 real-money ban; the official IPL Fantasy is a free season-long salary-cap game (hosted by My11Circle), not a draft. Season-long draft/auction private leagues already exist as niche products (CricBattle since 2011, Pitch Rival, CricFantasy, CricketDream, fantasycricketdraft.com, Drafty, open-source projects), but none appears to have Sleeper-level polish or scale; Sleeper does not offer cricket.

### Cited Findings
- Dream11 halted paid contests on 22 Aug 2025 and pivoted to free-to-play social games funded by ads/sponsorships ("Dream11 3.0"); CEO Harsh Jain said ~95% of group revenue and 100% of profit vanished; promised no layoffs; redirected ~500 engineers to AI/new products — [Business Standard](https://www.business-standard.com/companies/news/dream11-rmg-ban-new-strategy-revenue-loss-layoffs-125082600219_1.html); [People Matters](https://www.peoplematters.in/news/leadership/dream11-vows-no-layoffs-after-real-money-gaming-ban-wipes-95percent-revenue-43138).
- Dream Sports restructured into eight separate units in Dec 2025 — [LatestLY, 5 Oct 2026](https://www.latestly.com/gaming/dream11-pauses-paid-contests-mpl-cuts-60-of-india-staff-five-months-under-the-new-online-gaming-rules-2-7632746.html). >100 staff (~15% of 700 reassigned) left after the split (reported Mar 2026) — [CB Insights (via search summary)](https://www.cbinsights.com/company/dream11).
- MPL suspended real-money games, stopped taking deposits, told staff it would make zero India revenue, and cut ~60% of India workforce (~300 of 500) — [TechCrunch, 21 Aug 2025](https://techcrunch.com/2025/08/21/as-india-bans-real-money-games-dream-sports-mpl-start-pulling-the-plug); [LatestLY](https://www.latestly.com/gaming/dream11-pauses-paid-contests-mpl-cuts-60-of-india-staff-five-months-under-the-new-online-gaming-rules-2-7632746.html).
- Sector-wide restructuring/pivots at WinZO, MPL, Games24x7 (My11Circle parent) — [YourStory, Sep 2025](https://yourstory.com/2025/09/online-real-money-gaming-companies-dream11-zupee-winzo-mpl).
- Official IPL Fantasy 2026 is "hosted by My11Circle", season-long, free — [fantasy.iplt20.com T&C](https://fantasy.iplt20.com/classic/more/tnc); [CricketWinner](https://www.cricketwinner.com/cricket-news/ipl-introduces-official-fantasy-league-ahead-of-2026-season/).
- Pre-ban My11Circle had a ₹625 crore, 5-year IPL central sponsorship — [Exchange4media](https://www.exchange4media.com/digital-news/gaming-crackdown-not-just-rummy-poker-dream11-mpl-my11-circle-also-stare-at-ban-146667.html).
- CricBattle: private season-long leagues since 2011; Draft/Auction (exclusive ownership), Salary Cap, Prediction formats; snake/continuous/random draft order; free to create/join with paid premium customization; claims 1.5M users (IPL fantasy), 175k app ratings averaging 4.5, 200+ corporate customers, 500+ auctions, 1,000+ local leagues — [CricBattle](https://www.cricbattle.com/) (self-reported).
- Pitch Rival: free private IPL league platform with snake/auction drafts, weekly H2H, waivers, trades, playoffs, IPL 2026 stat sync — [Pitch Rival](https://pitchrival.com/guide).
- CricFantasy markets "NFL-style snake & auction drafts, weekly head-to-head matchups, real-time scoring, in-season trades" — [CricFantasy](https://cricfantasy.app/).
- CricketDream (free) offers a snake-draft mode and "Season Fantasy" mode — [CricketDream](https://www.cricketdream.in/); fantasycricketdraft.com: real-time snake draft with timer, up to 10 friends per league — [Fantasy IPL](https://www.fantasycricketdraft.com/); Drafty: general-purpose draft tool supporting IPL snake/slow drafts — [Drafty](https://draftysports.com/ipl/draft-setup).
- Sleeper's US listing names NFL, NBA, MLB, WNBA, soccer, golf, CS2, tennis, MMA — no cricket; its season-long leagues cover NFL, NBA, soccer — [Sleeper App Store](https://apps.apple.com/us/app/sleeper-fantasy-sports/id987367543); [Sleeper company page](https://sleeper.com/company). Sleeper strategy is social/"super app" — [Sportico, 2023](https://www.sportico.com/business/tech/2023/sleeper-fantasy-app-social-media-sports-feed-1234746513/).
- US diaspora-focused cricket DFS: GullyCricket brands itself "USA's Fantasy Cricket App" serving US, Canada, UK; "The Dream11 of the US" — [GullyCricket App Store](https://apps.apple.com/us/app/gullycricket-fantasy-cricket/id1490300794); [gullycricket.us](https://gullycricket.us/).

### Inferences
- The gap: no one offers a Sleeper-grade (polished mobile UX, chat/social, slow drafts, trades, waivers, push notifications, dynasty/keeper) season-long draft experience for IPL. Existing draft products are web-first, small, or spreadsheet-like. The official IPL game and the post-ban Dream11 are free salary-cap games where everyone can own the same stars — the draft format's exclusivity ("you have Bumrah, I don't") is the differentiator and is the core of the friends-league social dynamic.
- Post-ban, India's big fantasy players lost their monetization and are shrinking/pivoting, which lowers competitive intensity in free-to-play and frees up talent; but Dream11 (free, ad-funded) and official IPL Fantasy now compete directly for free-to-play attention.
- CricBattle's 15-year existence with only modest scale suggests demand for draft cricket is real but niche; a winner would need distribution (WhatsApp groups, office leagues) rather than just features.

### Gaps
- No evidence found of a well-funded startup that attempted and failed at season-long draft cricket; no post-mortems located.
- Howzat, Fan2Play, CricHQ, ESPNcricinfo fantasy, Fantrax cricket, "Cricket Draft League" — not verified in this research; status unknown.
- No reliable usage numbers for Pitch Rival, CricFantasy, CricketDream.
- No data on prevalence of spreadsheet "IPL auction leagues" (anecdotally common; no source found).

## 3. Legal environment — India (Promotion and Regulation of Online Gaming Act, 2025) and other markets

### Takeaway
India's PROGA 2025 (passed 21 Aug 2025, assent 22 Aug 2025) bans online money games, including paid fantasy, regardless of skill; the Act and the Promotion and Regulation of Online Gaming Rules, 2026 came into force on 1 May 2026. Online social games and e-sports are permitted/promoted; free-to-play fantasy with no fee/deposit and no monetary-return expectation appears to fall outside the ban, but no MeitY FAQ explicitly confirms free fantasy. The Supreme Court constitutional challenge (Head Digital Works v. Union of India) is pending with no interim relief; status after the 5 Aug 2026 hearing is unconfirmed. Outside India, free-to-play (no entry fee) fantasy is low-risk in the US/UK; risk arises with entry fees, prizes funded by entrants, or virtual currency.

### Cited Findings

**Act and rules**
- Act passed 21 Aug 2025; Presidential assent 22 Aug 2025; Act and Rules came into force 1 May 2026 (announced 22 Apr 2026) — [Supreme Court Observer](https://www.scobserver.in/cases/challenge-to-the-promotion-and-regulation-of-online-gaming-act-2025/).
- Rules notified 22 Apr 2026 by MeitY, effective 1 May 2026; create the Online Gaming Authority of India which determines (within 90 days, game- and provider-specific, non-precedential) whether a game is an online money game, handles complaints (30 days), can act suo motu, impose monetary penalties, suspend/cancel registration, or prohibit a game; operators must display determination/registration status and may not claim approval not granted; banks/payment intermediaries must verify determination/registration before facilitating transactions; games involving entry fees, deposits, bets or monetisable in-game assets must seek a determination; social game operators have data retention obligations — [Licentium (law-firm secondary summary)](https://www.licentium.io/post/india-notifies-promotion-and-regulation-of-online-gaming-rules-2026-effective-1-may-2026).
- Rules classify games into online money games (prohibited), e-sports and online social games (may operate, subject to registration/regulatory requirements) — [search summary of Licentium/IMGL](https://www.imgl.org/publications/imgl-magazine-volume-3-no-1/what-indias-new-regulations-mean-for-online-gaming/).
- Online money game = user pays fees or deposits money/stakes expecting monetary or equivalent returns; "other stakes" contested to include coins, tokens, credits, virtual objects purchased in-game; online social games are effectively games that are neither e-sports nor money games, for entertainment/learning/social interaction; registration (at draft stage) described as voluntary for most games, with obligations applying to registered games — [Storyboard18](https://www.storyboard18.com/gaming-news/meity-consults-gaming-industry-stakeholders-raise-red-flags-over-stakes-definition-82458.htm); [Cyril Amarchand Mangaldas blog](https://corporate.cyrilamarchandblogs.com/2025/10/online-gaming-gets-played-but-ready-to-play-ball/); [PIB document, Apr 2026](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/apr/doc2026430859401.pdf).
- Penalty for offering/facilitating an online money game: up to 3 years' imprisonment and/or fine up to ₹1 crore; Act bars banks/payment systems from processing money-game transactions; government had blocked >7,800 illegal betting sites cumulatively by early 2026 — [LatestLY, 5 Oct 2026](https://www.latestly.com/gaming/dream11-pauses-paid-contests-mpl-cuts-60-of-india-staff-five-months-under-the-new-online-gaming-rules-2-7632746.html).
- Conflicting/unreliable sources: Wikipedia's PROGA page (flagged with an AI-generated-content banner) describes fantasy sports as "permissible" skill games and a "National Online Gaming Commission" — this contradicts the Act's actual money-game ban and the Online Gaming Authority described by law-firm sources — [Wikipedia](https://en.wikipedia.org/wiki/Promotion_and_Regulation_of_Online_Gaming_Act,_2025). A founderpin.com profile similarly claims fantasy was "distinguished from gambling" under the Act — unreliable.

**Court challenges**
- Head Digital Works v. Union of India (T.C.(C) No. 133/2025): on 8 Sep 2025, SC (Pardiwala & Viswanathan JJ) allowed Union's transfer petitions, moving Delhi, MP and Karnataka HC challenges to SC; petitioners include Head Digital Works (A23), Clubboom 11 Sports, Bagheera Carrom OPC and others; bench listed as CJI Surya Kant, Bagchi J, Pancholi J; status "Pending"; next hearing 5 Aug 2026 — [Supreme Court Observer](https://www.scobserver.in/cases/challenge-to-the-promotion-and-regulation-of-online-gaming-act-2025/).
- No interim relief granted; referred to a three-judge bench; hearing deferred to January 2026 — [Storyboard18](https://www.storyboard18.com/gaming-news/breaking-sc-flags-need-for-three-judge-bench-pushes-online-gaming-law-challenge-to-january-85676.htm); [Exchange4media](https://www.exchange4media.com/digital-news/sc-moves-online-gaming-sector-case-to-three-judge-bench-150149.html).
- A report of ~6 Aug 2026 says SC agreed to take up the batch for final hearing and that the government had still not filed its reply despite two orders (from search summary; primary not fetched) — [search summary].
- Separate June 2026 SC ruling on state laws (Tamil Nadu / Karnataka; State of TN v. Junglee Games): once money is staked on an uncertain game outcome it is betting/gambling whether skill or chance; HC judgments striking down state amendments set aside — [TaxTMI](https://www.taxtmi.com/article/detailed?id=16658); [Supreme Court Observer](https://www.scobserver.in/cases/challenge-to-the-promotion-and-regulation-of-online-gaming-act-2025/). This substantially weakens the "skill game" defence for paid fantasy.

**US / UK**
- UIGEA carve-out exempts fantasy contests where outcomes reflect skill, are determined predominantly by accumulated stats of multiple athletes across multiple real events, and prizes are fixed in advance (not influenced by fees/number of entrants); no team based solely on one real team's roster; states can still prohibit; Montana bans paid online fantasy; risk rises when entry fees fund the prize pool — [LexisNexis](https://www.lexisnexis.com/community/insights/legal/practical-guidance-journal/b/pa/posts/10-legal-issues-with-fantasy-sports); [Klein Moynihan](https://kleinmoynihan.com/fantasy-sports-the-rapidly-developing-legal-framework/).
- UK Gambling Commission: fantasy contests where prize values depend on number of paying entrants may need a pool betting licence; privately run leagues among friends generally outside guidance — [Legal Sports Report](https://www.legalsportsreport.com/14653/uk-gaming-commission-fantasy-sports/). UKGC pursued Sorare (2021–22), with free-to-play status at issue — [iGaming Business](https://igamingbusiness.com/legal-compliance/sorare-uk-gambling-commission).

### Inferences
- A truly free (no entry fee, no deposits, no purchasable coins that can affect outcomes, no cash prizes) season-long draft app should qualify as an "online social game" in India and be lawful; the safest monetization is ads, sponsorships, and cosmetic/feature subscriptions that do not convert into stakes or prizes. Paid "league dues" collected through the app, prize pools, or purchasable in-game currency would likely trigger money-game classification.
- Even friends' side-pots handled off-app could create reputational/payment-partner friction; avoid facilitating them in India.
- Consider obtaining a voluntary determination/registration from the Online Gaming Authority once operating at scale, to reassure payment/app-store partners (banks must verify status for any transactions).
- The SC challenge is unlikely to restore paid fantasy soon given the June 2026 state-law ruling's reasoning; plan for free-to-play as the long-term India model.
- Outside India: free-to-play needs only standard consumer/sweepstakes compliance; adding paid leagues in the US would require state-by-state DFS licensing analysis.

### Gaps
- Final Rules text on whether social-game registration is mandatory vs voluntary not confirmed from the Gazette (secondary sources differ by draft vs final).
- No MeitY FAQ explicitly addressing free fantasy.
- Outcome of the 5 Aug 2026 SC hearing and any later listings unknown.
- Australia: no sources gathered (free fantasy generally not gambling, but unverified here).
- US sweepstakes-model rules not researched.
- My11Circle/Games24x7 detailed post-ban layoffs not found.

## 4. Audience size and diaspora demand

### Takeaway
Indian fantasy sports was a mass-market category (Dream11 claimed 220–250M registered users, industry estimates 225–300M users) before the ban; reliable 2026 MAU figures for free-to-play are unavailable. Diaspora demand evidence is indirect (GullyCricket targeting US/Canada/UK; CricBattle 1.5M claimed IPL users); no survey quantifies diaspora cricket fans who play Sleeper-style fantasy.

### Cited Findings
- Dream11 >220M registered users (~55% share) per 2026 profile; >250M registered users in 2025 per another; industry ~300M fantasy users in 2025 vs 225M in 2024 — secondary/blog sources with weak sourcing — [Founderpin](https://founderpin.com/?p=4303); [psainath.org](https://psainath.org/?p=2715).
- 2019 IPL final: >1 crore Dream11 teams created by 43,77,610 unique users — [Medianews4u](https://www.medianews4u.com/dream11-achieves-another-milestone-hits-5-crore-user-mark/).
- Pre-ban market share among fantasy players: My11Circle 7%, Dream11 5% (as cited in Exchange4media coverage; metric unclear) — [Exchange4media](https://www.exchange4media.com/digital-news/gaming-crackdown-not-just-rummy-poker-dream11-mpl-my11-circle-also-stare-at-ban-146667.html).
- CricBattle claims 1.5M IPL fantasy users — [CricBattle](https://www.cricbattle.com/).
- GullyCricket explicitly targets US, Canada, UK cricket communities — [GullyCricket App Store](https://apps.apple.com/us/app/gullycricket-fantasy-cricket/id1490300794).

### Inferences
- Post-ban, a large pool of Indian users habituated to fantasy cricket now has only free options — an opening for a social/friends-league product, but monetization per user will be ad-level (low ARPU).
- Diaspora (US/UK/Canada/Australia) users are the higher-ARPU segment and already accustomed to Sleeper/ESPN-style season-long football leagues; this segment justifies a premium-subscription model where legal.

### Gaps
- No reliable 2026 MAU for Dream11 free-to-play or official IPL Fantasy user counts.
- No data on diaspora cricket fans' fantasy behavior or Sleeper overlap; no Reddit evidence gathered.

## 5. IP / branding risks (IPL team names, logos, player images)

### Takeaway
Using player names and public match statistics is broadly lawful in India (Delhi HC, Digital Collectibles v. Galactus Funware, 2023, interim), but implying endorsement is risky; IPL/BCCI and franchise names and logos are trademarks and should not be used without a licence (use descriptive text/abbreviations carefully, no logos, no official photos).

### Cited Findings
- Delhi HC (Amit Bansal J, CS(COMM) 108/2023) refused an interim injunction against MPL's "Striker" using cricketers' names/likeness on in-platform player cards; held player names and performance data are publicly available and usable by anyone, a player cannot exclusively license such public info, the right of publicity is not absolute, and Striker did not suggest endorsement — [Columbia Global Freedom of Expression](https://globalfreedomofexpression.columbia.edu/cases/digital-collectibles-v-galactus/); [IPRMENTLAW](https://iprmentlaw.com/2023/05/09/delhi-hc-shapes-contours-of-the-right-to-publicity-digital-collectibles-v-galactus-funware/). Interim decision only; final outcome not found.
- The official IPL fantasy is branded "TATA IPL" and hosted by licensed partner My11Circle, indicating the league commercially licenses its marks for fantasy — [fantasy.iplt20.com T&C](https://fantasy.iplt20.com/classic/more/tnc).

### Inferences
- Safe-ish: player names, public stats, team abbreviations used descriptively for scheduling (nominative use). Risky: IPL/TATA IPL logo, franchise logos, official kit images, player photos (photo copyright belongs to photographers/agencies like BCCI/Getty), and any copy implying "official" status. Use generic avatars or licensed photo feeds.
- App stores frequently remove apps on trademark complaints; brand the app around "T20 league fantasy" rather than "IPL" in the app name, and use "IPL" only descriptively in descriptions.
- Licensed data providers (e.g., Cricsheet for historical data; commercial live feeds) avoid scraping-related disputes.

### Gaps
- No case found specifically on IPL franchise trademark enforcement against fantasy apps.
- Personality-rights trend in Indian courts post-2023 (several celebrity orders) not researched; could tighten use of player images.
