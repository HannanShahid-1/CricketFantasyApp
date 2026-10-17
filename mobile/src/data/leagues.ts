import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { LEAGUE_CHANNEL } from '@shared/engine/chat'
import { upgradeLeague, type League } from '@shared/engine/league'
import { getData, useApp } from '@shared/store'
import { emptyLibrary, rememberLeague, restoreLibrary, withoutLeague, type LeagueLibrary } from './leagueLibrary'
import { useLiveSim } from './simulation'

const KEY = 'seam-league-library-v1'
export const useLeagues = create<LeagueLibrary & { busy: boolean; ready: boolean }>(() => ({ ...emptyLibrary(), busy: false, ready: false }))
const snapshot = (): LeagueLibrary => {
  const { activeId, leagues } = useLeagues.getState()
  const current = useApp.getState().league
  return current && current.createdAt === activeId ? rememberLeague({ activeId, leagues }, current) : { activeId, leagues }
}
const write = (value: LeagueLibrary) => AsyncStorage.setItem(KEY, JSON.stringify(value))

export async function loadLeagues(legacy: League | null = useApp.getState().league) {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    let saved: LeagueLibrary | null = null
    if (raw) {
      const parsed = JSON.parse(raw) as LeagueLibrary
      if (!Array.isArray(parsed.leagues) || !('activeId' in parsed)) throw new Error('League library could not be read')
      saved = parsed
    }
    const library = restoreLibrary(saved, legacy)
    library.leagues = library.leagues.map((l) => l.dataVersion === getData().version ? upgradeLeague(l) : l)
    // Save migration before changing the existing active save.
    await write(library)
    useLeagues.setState({ ...library, ready: true })
    const active = library.leagues.find((l) => l.createdAt === library.activeId)
    useApp.setState({ league: active?.dataVersion === getData().version ? active : null })
    useApp.subscribe((s, prev) => {
      if (s.league && s.league !== prev.league && s.league.createdAt === useLeagues.getState().activeId) {
        useLeagues.setState(rememberLeague(useLeagues.getState(), s.league))
      }
    })
  } catch {
    useLeagues.setState(restoreLibrary(null, useApp.getState().league))
    useApp.getState().notify('Your league list could not be loaded. Reopen Seam before creating or switching leagues.', 'bad')
  }
}

/** Persist all league snapshots before replacing the store; a failed save leaves the current league open. */
async function change(next: (library: LeagueLibrary) => LeagueLibrary): Promise<boolean> {
  if (useLeagues.getState().busy || !useLeagues.getState().ready) return false
  useLeagues.setState({ busy: true })
  try {
    let library = next(snapshot())
    await write(library)
    // Bot replies may have arrived during the write. Keep the latest old league too.
    const latest = useApp.getState().league
    if (latest && library.leagues.some((l) => l.createdAt === latest.createdAt)) library = rememberLeague(library, latest)
    await write(library)
    useLiveSim.setState({ m: null, scores: new Map(), over: null })
    useLeagues.setState(library)
    const league = library.leagues.find((l) => l.createdAt === library.activeId) ?? null
    useApp.setState({ league, viewWeek: null, tab: 'matchup', typing: {}, chatChannel: LEAGUE_CHANNEL, playerModal: null, matchModal: null, liveMatch: null, tradeWith: null, addTarget: null, toast: null })
    return true
  } catch {
    useApp.getState().notify('Could not save your leagues. Please try again.', 'bad')
    return false
  } finally {
    useLeagues.setState({ busy: false })
  }
}
export async function selectLeague(id: number) {
  const target = useLeagues.getState().leagues.find((l) => l.createdAt === id)
  if (!target || target.dataVersion !== getData().version) return false
  if (useApp.getState().league?.createdAt === id) return true
  return change((library) => ({ ...library, activeId: id }))
}
export const addLeague = (league: League) => change((library) => ({ ...rememberLeague(library, league), activeId: league.createdAt }))
export const deleteActiveLeague = () => {
  const id = useApp.getState().league?.createdAt
  return id === undefined ? Promise.resolve(false) : change((library) => withoutLeague(library, id))
}
