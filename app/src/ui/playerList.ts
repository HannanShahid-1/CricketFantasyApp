// The Players list: filter, per-row numbers and sort, shared by the web and iPhone screens. Every number a row shows
// is computed once here, and the same values drive sorting and rendering.
import { matchProjection, restOfSeason, seasonToDate, type Data, type Player } from '../engine/data'
import { addMode, currentWeek, playerWeek, rosteredBy, type AddMode, type League } from '../engine/league'
import type { Role } from '../engine/types'

export type PlayerStatus = 'avail' | 'all' | 'rostered' | 'mine'
export type RoleFilter = 'ALL' | Role | 'AR'
export type SortKey = 'season' | 'avg' | 'week' | 'ros' | 'last' | 'prev' | 'next'

export interface PlayerFilter {
  status: PlayerStatus
  role: RoleFilter
  /** IPL team code or 'ALL' */
  team: string
  q: string
}

export const STATUS_LABEL: Record<PlayerStatus, string> = { avail: 'Available', all: 'All', rostered: 'Rostered', mine: 'Mine' }
export const ROLE_FILTERS: RoleFilter[] = ['ALL', 'WK', 'BAT', 'AR', 'BOWL']

export interface PlayerRow {
  p: Player
  /** fantasy team that rosters him, if any */
  owner: number | undefined
  /** points in his most recent match, null if he hasn't played */
  last: number | null
  week: ReturnType<typeof playerWeek>
  season: ReturnType<typeof seasonToDate>
  ros: number
  /** The next scheduled fixture, independent of this week's counting-match choice. */
  next: { mi: number; total: number } | null
  mode: AddMode
}

export function playerRows(d: Data, league: League, f: PlayerFilter, sort: SortKey): PlayerRow[] {
  const owned = rosteredBy(league)
  const week = currentWeek(d, league)
  const needle = f.q.trim().toLowerCase()
  const rows: PlayerRow[] = []
  for (const p of d.pool) {
    const owner = owned.get(p.idx)
    if (f.status === 'avail' && owner !== undefined) continue
    if (f.status === 'mine' && owner !== 0) continue
    if (f.status === 'rostered' && owner === undefined) continue
    if (f.role === 'AR' ? !(p.role === 'ARB' || p.role === 'ARW') : f.role !== 'ALL' && p.role !== f.role) continue
    if (f.team !== 'ALL' && p.team !== f.team) continue
    if (needle && !`${p.name} ${p.fullName} ${p.rawName}`.toLowerCase().includes(needle)) continue
    let last: number | null = null
    let lastMi = -1
    for (const g of p.games.values()) {
      if (g.mi < league.played && g.mi > lastMi) {
        lastMi = g.mi
        last = g.pts.total
      }
    }
    const nextMi = d.teamMis[p.team]?.find((mi) => mi >= league.played)
    rows.push({
      p, owner, last,
      next: nextMi === undefined ? null : { mi: nextMi, total: matchProjection(d, p, nextMi, league.played).total },
      week: playerWeek(d, league, owner ?? null, p.idx, week),
      season: seasonToDate(p, league.played),
      ros: restOfSeason(d, p, league.played),
      mode: owner === undefined ? addMode(d, league, p.idx, owned) : 'none',
    })
  }
  const key: Record<SortKey, (r: PlayerRow) => number> = {
    season: (r) => r.season.pts,
    avg: (r) => r.season.avg,
    week: (r) => r.week.total,
    ros: (r) => r.ros,
    next: (r) => r.next?.total ?? -Infinity,
    last: (r) => r.last ?? -99,
    prev: (r) => r.p.s25.avg,
  }
  return rows.sort((a, b) => key[sort](b) - key[sort](a))
}
