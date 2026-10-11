# CricketFantasyApp

Research for a season-long IPL fantasy cricket app modelled on Sleeper-style fantasy football leagues: friends draft teams, then play weekly head-to-head matchups.

## What's here

| File | What it covers |
|---|---|
| [IPL fantasy cricket app research](reports/IPL%20fantasy%20cricket%20app%20research.md) | The main report: how the fantasy football season loop maps onto the IPL, weekly gameweeks, roster slots, data sources, and the market and legal situation |
| [Scoring options](reports/Scoring%20options.md) | Points-system options that keep scores small and balance batters against bowlers |

## Key decisions so far

- **Format:** redraft league with a snake draft, weekly head-to-head matchups, FAAB waivers and trades
- **Season:** 8 Monday-to-Sunday gameweeks across the 70-match league stage (6 regular-season weeks, then a 4-team playoff)
- **Lineup:** 4 BAT / 4 BOWL / 2 FLEX / 1 WK
- **Data:** [Cricsheet](https://cricsheet.org) ball-by-ball data (free, attribution licence) for building and replaying past seasons
- **Market:** free-to-play only, because of India's 2025 ban on real-money gaming
