// The week-by-week results grid on the standings pages (web and iPhone).
import { matchupsForWeek, REG_WEEKS, type League } from '../engine/league'

export type WeekCell =
  | { played: true; opp: number; score: number; outcome: 'win' | 'loss' | 'tie'; beatMedian: boolean }
  | { played: false; opp: number | null }

/** Each team's regular-season weeks (index = week − 1): score and outcome once played, else who it plays. */
export function weeklyResults(l: League): Map<number, WeekCell[]> {
  const out = new Map<number, WeekCell[]>(l.teams.map((t) => [t.id, []]))
  for (let w = 1; w <= REG_WEEKS; w++) {
    const res = l.results[w]
    const ms = matchupsForWeek(l, w)
    for (const t of l.teams) {
      const m = ms.find((x) => x.a === t.id || x.b === t.id)
      const opp = m ? (m.a === t.id ? m.b : m.a) : null
      const row = out.get(t.id)!
      if (!res || opp === null) {
        row.push({ played: false, opp })
        continue
      }
      const mine = res.scores[t.id]
      const theirs = res.scores[opp]
      row.push({
        played: true,
        opp,
        score: mine,
        outcome: mine > theirs ? 'win' : mine < theirs ? 'loss' : 'tie',
        beatMedian: res.median !== null && mine > res.median,
      })
    }
  }
  return out
}
