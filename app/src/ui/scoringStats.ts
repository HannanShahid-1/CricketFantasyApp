// How the scoring rules play out on real matches, for the Scoring pages (web and iPhone).
import type { Data } from '../engine/data'
import type { Role } from '../engine/types'

/** One player's points in one IPL match. */
export interface Appearance {
  p: number
  mi: number
  pts: number
}

export interface ScoringStats {
  /** every player-match, best first */
  apps: Appearance[]
  /** median single-match score */
  median: number
  /** average points per appearance, by role */
  byRole: Partial<Record<Role, { n: number; avg: number }>>
}

/** Single-match scores across the season (only matches before `played`, when given), best first. */
export function scoringStats(d: Data, played = Infinity): ScoringStats {
  const apps: Appearance[] = []
  for (const p of d.pool) for (const g of p.games.values()) if (g.mi < played) apps.push({ p: p.idx, mi: g.mi, pts: g.pts.total })
  apps.sort((a, b) => b.pts - a.pts)
  const sums: Partial<Record<Role, { n: number; sum: number }>> = {}
  for (const x of apps) {
    const r = (sums[d.players[x.p].role] ??= { n: 0, sum: 0 })
    r.n++
    r.sum += x.pts
  }
  const byRole: ScoringStats['byRole'] = {}
  for (const [role, { n, sum }] of Object.entries(sums) as [Role, { n: number; sum: number }][]) byRole[role] = { n, avg: sum / n }
  return { apps, median: apps[Math.floor(apps.length / 2)]?.pts ?? 0, byRole }
}
