import { describe, expect, it } from 'vitest'
import type { League } from '../src/engine/league'
import { rememberLeague, restoreLibrary, withoutLeague } from '../../mobile/src/data/leagueLibrary'

// Library migration must preserve the only copy of a user's saved league, including in a switch interrupted by app closure.
const league = (createdAt: number, played = 0) => ({ createdAt, played, name: 'Same league name' }) as League

describe('mobile league saves', () => {
  it('migrates an existing save and keeps later active progress on restart', () => {
    const old = league(1, 2)
    const migrated = restoreLibrary(null, old)
    const fresh = league(1, 7)
    expect(restoreLibrary(migrated, fresh).leagues[0].played).toBe(7)
    expect(migrated.leagues[0].played).toBe(2)
  })
  it('restores the selected league if a switch finished saving before the active store flushed', () => {
    const a = league(1, 7), b = league(2, 3)
    const saved = { activeId: 2, leagues: [a, b] }
    expect(restoreLibrary(saved, a).activeId).toBe(2)
    expect(restoreLibrary(saved, a).leagues).toEqual([a, b])
  })
  it('keeps separate leagues with the same name and does not resurrect a deleted active save', () => {
    const a = league(1), b = league(2)
    const both = rememberLeague({ activeId: 1, leagues: [a] }, b)
    expect(both.leagues).toHaveLength(2)
    const removed = withoutLeague(both, 1)
    expect(restoreLibrary(removed, a)).toEqual({ activeId: null, leagues: [b] })
  })
})
