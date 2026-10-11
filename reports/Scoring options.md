# Scoring options: keeping scores small and balanced

Goal: fantasy-football-sized numbers.

- **Typical player:** 5–15 points a match
- **Great game:** 20–30
- **Once-a-season performance:** about 45–50 at most
- **Balance:** a good batter and a good bowler score about the same

**Why Dream11 numbers are huge.** A wicket is worth 30, a six is worth 6 *plus* the run itself, and the milestone bonuses stack. A century scores about 220 and a 5-wicket haul about 200.

**The fix:**

- Cut every value by roughly 5x.
- Make a wicket worth about 24 runs.
- Drop the captain and vice-captain multipliers.

---

## Option 1: Standard, football-style decimals (recommended default)

### Batting

| Stat | Points |
|---|---|
| Each run | 0.25 (4 runs = 1 pt, like 0.1/yard in football) |
| Four | +0.5 bonus |
| Six | +1 bonus |
| Reaching 30 / 50 / 100 | +2 / +3 more / +5 more (a century gets all three, +10 total) |
| Strike rate (min 10 balls) | 200+: +3 · 170–199: +2 · 150–169: +1 · 120–149: 0 · 100–119: −1 · under 100: −2 |
| Duck (BAT/WK/AR only) | −2 |

### Bowling

| Stat | Points |
|---|---|
| Wicket | 6 (the cricket version of a touchdown) |
| Bowled / LBW | +1 bonus |
| Dot ball | 0.25 |
| Maiden | +3 |
| 3 / 4 / 5+ wickets in a match | +2 / +4 / +6 (only the highest applies) |
| Economy (min 2 overs) | under 6: +3 · 6–7.49: +2 · 7.5–8.99: +1 · 9–10.49: 0 · 10.5–11.99: −1 · 12+: −2 |

### Fielding and other

| Stat | Points |
|---|---|
| Catch | +2 |
| Stumping | +3 |
| Run-out, direct hit | +3 |
| Run-out, assisted | +1.5 per fielder |
| Played (in the XI or used as the Impact sub) | +1 |

### Example scores

Each total includes the +1 for playing.

| Performance | Points |
|---|---|
| Average batter: 22 off 17 (2 fours, 1 six) | 8.5 |
| Average bowler: 4-0-36-1, 8 dots | 9 |
| Good batter: 40 off 28 (4 fours, 2 sixes) | 17 |
| Good bowler: 4-0-30-2 (one bowled), 9 dots | 17.25 |
| Expensive bowler: 4-0-52-0, 5 dots | 0.25 |
| Duck | −1 |
| Century: 100 off 55 (8 fours, 7 sixes) | 49 |
| 5-wicket haul: 4-0-20-5 (2 bowled or LBW), 12 dots | 45 |
| Big all-rounder day: 35 off 22, plus 4-0-28-2, plus a catch | 34.5 |

A team's weekly total lands around 120–170, depending on how many two-match weeks its players have. This is a rough estimate.

---

## Option 2: Lite, whole numbers only

| Stat | Points |
|---|---|
| Every 5 runs | 1 (rounded down) |
| Six | +1 |
| Reaching 50 / 100 | +3 / +5 more |
| Duck | −2 |
| Wicket | 5 |
| Maiden | +2 |
| 3 / 5 wickets in a match | +2 / +5 |
| Catch, stumping or run-out | +2 |

### Example scores

- 40 off 28: 10
- 4-0-30-2: 10
- Century: 35
- 5-wicket haul: 30
- Weekly team totals: around 70–110

### Weakness

There is no reward for strike rate or economy.

Optional modifiers that fix this:

- Strike rate over 175: +2. Under 110: −2.
- Economy under 7: +2. Over 11: −2.

---

## Option 3: Par scoring, two formulas with no bonus bands

- **Batting** = runs ÷ 4 + (runs − balls faced) ÷ 8
- **Bowling** = wickets × 6 + (1.5 × balls bowled − runs conceded) ÷ 8. This sets a par economy of 9 an over.
- **Fielding** is the same as Option 1.

### Example scores

- 40 off 28: 11.5
- 4-0-30-2: 12.75
- 4-0-52-0: −2
- Century: 30.6
- 5-wicket haul: 32

### Strengths and weakness

- It is the most compressed and balanced of the four options.
- There are no cliff edges at band boundaries.
- If scoring rates change across the league, you only change the par number.
- It is harder for casual users to check by hand.

---

## Option 4: Head-to-head categories, like fantasy basketball 9-cat

Each week you win or lose individual categories against your opponent, so a result looks like 5–3.

Suggested categories:

- **Batting:** Runs, Sixes, Strike Rate, 30+ scores
- **Bowling:** Wickets, Dot Balls, Economy
- **Fielding:** Fielding dismissals

### Pros

- Outliers can't swing a week.
- There is deep strategy, such as deliberately giving up a category.
- Basketball players already know the format.

### Cons

- There is no single live points number to watch.
- It is less intuitive for new players.
- Strike Rate and Economy need weekly minimums, for example 30 balls faced or 6 overs bowled.

Best offered as an alternative league type, not the default.

---

## The same performances under each system

| Performance | Dream11 | Opt 1 Standard | Opt 2 Lite | Opt 3 Par |
|---|---|---|---|---|
| 40 off 28 | ~78 | 17 | 10 | 11.5 |
| 4-0-30-2 | ~81 | 17.25 | 10 | 12.75 |
| Century (100 off 55) | ~224 | 49 | 35 | 30.6 |
| 5-wicket haul | ~200 | 45 | 30 | 32 |

## Guardrails that work with any option

- **No captain or vice-captain multipliers.** They exist only to create variance in daily games.
- **Soft cap.** Points beyond 35 in a single match count half.
- **Floor.** No player can score below −5 in a match.
- **Multi-match weeks.** Offer "best match" or "average per match" settings if summing feels too swingy.

## Recommendation and next step

**Recommendation:**

- Option 1 is the default.
- Option 2 is a "Lite" preset.
- Option 4 is an alternative league type.
- Option 3 is for leagues that prefer formulas to bonus bands.

**Caveat:** these values were set by hand from typical IPL innings and spells. They have not been checked against real data.

**Next step:** score a full real season (2024, from Cricsheet) under each option. Then check per-role averages, the spread of scores, and the highest scores before locking in a system.
