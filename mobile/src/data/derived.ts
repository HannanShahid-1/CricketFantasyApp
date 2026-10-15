import { rosteredBy, standings, type League } from '@shared/engine/league'

// League-derived data that many rows need. Each league object is immutable (the store replaces it on every change),
// so results are cached per league object and recomputed only after a change.

function cached<T>(fn: (l: League) => T): (l: League) => T {
  const cache = new WeakMap<League, T>()
  return (l) => {
    if (!cache.has(l)) cache.set(l, fn(l))
    return cache.get(l)!
  }
}

/** player idx -> fantasy team id that rosters him */
export const ownersOf = cached(rosteredBy)

/** standings table, best first */
export const standingsOf = cached(standings)

/** "W-L" (or "W-L-T") record including median games, e.g. "5-3" */
export function recordOf(l: League, teamId: number): string {
  const r = standingsOf(l).find((x) => x.teamId === teamId)
  if (!r) return '0-0'
  return `${r.w + r.mw}-${r.l + r.ml}${r.t ? `-${r.t}` : ''}`
}
