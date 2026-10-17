import type { League } from '@shared/engine/league'

/** The active league still uses the existing save; the library keeps the others on this phone. */
export interface LeagueLibrary { activeId: number | null; leagues: League[] }
export const emptyLibrary = (): LeagueLibrary => ({ activeId: null, leagues: [] })
export function rememberLeague(library: LeagueLibrary, league: League): LeagueLibrary {
  const found = library.leagues.some((l) => l.createdAt === league.createdAt)
  return { ...library, leagues: found ? library.leagues.map((l) => l.createdAt === league.createdAt ? league : l) : [...library.leagues, league] }
}
/** On first run migrate the existing save. On later runs its active copy is the most recent one. */
export function restoreLibrary(saved: LeagueLibrary | null, current: League | null): LeagueLibrary {
  if (!saved) return current ? { activeId: current.createdAt, leagues: [current] } : emptyLibrary()
  return current && saved.activeId === current.createdAt ? rememberLeague(saved, current) : saved
}
export function withoutLeague(library: LeagueLibrary, id: number): LeagueLibrary {
  return { activeId: library.activeId === id ? null : library.activeId, leagues: library.leagues.filter((l) => l.createdAt !== id) }
}
