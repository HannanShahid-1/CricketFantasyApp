import type { Data, Player } from '../engine/data'
import { computeLines, score } from '../engine/scoring'
import type { Role } from '../engine/types'

export interface DraftRating {
  points25: number; points26: number; games26: number; ppg: number; projection: number; value: number; rank: number
}
const cache = new WeakMap<Data, Map<number, DraftRating>>()
/** Retrospective draft model, explicitly using the completed simulated season at the owner's request.
 * Includes every supplied 2026 match, not just the fantasy schedule. Forecast PPG shrinks small samples
 * toward the playing-role average; ranking also discounts players with limited playing time. No fake ADP. */
export function draftRatings(d: Data): Map<number, DraftRating> {
  const saved = cache.get(d)
  if (saved) return saved
  const ratings = new Map(d.pool.map((p) => [p.idx, { points25: p.s25.pts, points26: 0, games26: 0, ppg: 0, projection: 0, value: 0, rank: 0 }]))
  for (const m of d.raw.seasons[d.raw.simSeason] ?? []) {
    for (const [pid, line] of computeLines(m)) {
      const row = ratings.get(pid)
      if (!row || !line.played) continue
      row.games26++
      row.points26 += score(line, d.players[pid].role).total
    }
  }
  const baseline = new Map<Role, number>()
  for (const role of ['WK', 'BAT', 'ARB', 'ARW', 'BOWL'] as Role[]) {
    const rows = d.pool.filter((p) => p.role === role).map((p) => ratings.get(p.idx)!).filter((r) => r.games26 >= 5)
    baseline.set(role, rows.length ? rows.reduce((sum, r) => sum + r.points26 / r.games26, 0) / rows.length : 8)
  }
  for (const p of d.pool) {
    const row = ratings.get(p.idx)!
    row.ppg = row.games26 ? row.points26 / row.games26 : 0
    row.projection = (row.points26 + 3 * baseline.get(p.role)!) / (row.games26 + 3)
    const availability = row.games26 ? Math.min(1, Math.max(0.3, row.games26 / 14)) : 0.3
    row.value = row.projection * availability
  }
  [...d.pool].sort((a, b) => ratings.get(b.idx)!.value - ratings.get(a.idx)!.value || ratings.get(b.idx)!.points26 - ratings.get(a.idx)!.points26 || a.idx - b.idx).forEach((p, i) => { ratings.get(p.idx)!.rank = i + 1 })
  cache.set(d, ratings)
  return ratings
}
export const estimatedRound = (rank: number, teams: number) => Math.ceil(rank / teams)
export const draftRating = (d: Data, p: Player) => draftRatings(d).get(p.idx)!
