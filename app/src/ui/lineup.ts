// Lineup editor moves (tap a player, then tap where he goes), shared by the web and iPhone screens.
import type { Data } from '../engine/data'
import { SLOTS } from '../engine/league'

/** A tapped place in the lineup: a starting slot by index, or a bench player. */
export type LineupSpot = { kind: 'slot'; i: number } | { kind: 'bench'; p: number }

export const sameSpot = (a: LineupSpot, b: LineupSpot) =>
  a.kind === 'slot' ? b.kind === 'slot' && a.i === b.i : b.kind === 'bench' && a.p === b.p

/** The player at a spot (null for an empty slot). */
export const spotPlayer = (starters: (number | null)[], s: LineupSpot) => (s.kind === 'slot' ? starters[s.i] : s.p)

/**
 * Can the selection move to `to`? Slot to slot swaps (both players must fit the other's slot), bench to slot or slot
 * to bench replaces. `locked(p)` is true when the match that counts for p has started, so he can't move.
 */
export function canMove(d: Data, starters: (number | null)[], from: LineupSpot, to: LineupSpot, locked: (p: number) => boolean): boolean {
  if (from.kind === 'slot') {
    const p = starters[from.i]
    if (to.kind === 'bench') return !locked(to.p) && d.players[to.p].elig.includes(SLOTS[from.i])
    if (to.i === from.i) return false
    const q = starters[to.i]
    if (q !== null && locked(q)) return false
    const okP = p === null || d.players[p].elig.includes(SLOTS[to.i])
    const okQ = q === null || d.players[q].elig.includes(SLOTS[from.i])
    return okP && okQ && (p !== null || q !== null)
  }
  if (to.kind === 'slot') {
    const q = starters[to.i]
    return !(q !== null && locked(q)) && d.players[from.p].elig.includes(SLOTS[to.i])
  }
  return false
}

/** Starters after the move (check the result with `lineupProblem` before saving). */
export function applyMove(starters: (number | null)[], from: LineupSpot, to: LineupSpot): (number | null)[] {
  const next = [...starters]
  if (from.kind === 'slot' && to.kind === 'bench') next[from.i] = to.p
  else if (from.kind === 'bench' && to.kind === 'slot') next[to.i] = from.p
  else if (from.kind === 'slot' && to.kind === 'slot') [next[from.i], next[to.i]] = [next[to.i], next[from.i]]
  return next
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
