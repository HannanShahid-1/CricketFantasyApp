import { router } from 'expo-router'
import { LEAGUE_CHANNEL, type ChannelId } from '@shared/engine/chat'
import { useApp } from '@shared/store'

// Every route the app opens, in one place. Screens call these instead of building hrefs.

export const nav = {
  /** player card (sheet) */
  player: (pid: number) => router.push({ pathname: '/player/[id]', params: { id: String(pid) } }),
  /** eligible lineup swaps from a Matchup position badge */
  swap: (slot: number, week: number, pid: number | null) =>
    router.push({ pathname: '/swap/[slot]', params: { slot: String(slot), week: String(week), pid: String(pid ?? -1) } }),
  /** add a free agent or claim off waivers (sheet) */
  add: (pid: number) => router.push({ pathname: '/add/[id]', params: { id: String(pid) } }),
  /** propose a trade to a team (sheet) */
  trade: (teamId: number) => router.push({ pathname: '/trade/[team]', params: { team: String(teamId) } }),
  /** step 2 of a trade: review the deal and send it (pushed inside the trade sheet) */
  tradeReview: (teamId: number, give: number[], get: number[]) =>
    router.push({ pathname: '/trade/review', params: { team: String(teamId), give: give.join(','), get: get.join(',') } }),
  /** IPL match scorecard (sheet) */
  match: (mi: number) => router.push({ pathname: '/match/[mi]', params: { mi: String(mi) } }),
  /** ball-by-ball live replay (full screen) */
  live: (mi: number) => router.push({ pathname: '/live/[mi]', params: { mi: String(mi) } }),
  /**
   * a conversation in the Chat tab. From a sheet it closes the sheet (even one with screens pushed inside, like the
   * trade review) so it lands in the existing tab.
   */
  chat: (channel: ChannelId) => {
    // the league chat is the tab's first screen
    const href = channel === LEAGUE_CHANNEL ? '/chat' : { pathname: '/chat/[channel]' as const, params: { channel } }
    if (router.canDismiss()) router.dismissTo(href)
    else router.navigate(href)
  },
  /** every conversation, Messages style (pushed from the league chat) */
  messages: () => router.push('/chat/messages'),
  /** the Matchup tab, showing a given week */
  week: (week: number) => {
    useApp.getState().setViewWeek(week)
    router.navigate('/matchup')
  },
  /** Open the selected league overview card, rather than always opening your own matchup. */
  leagueMatchup: (week: number, team: number) => {
    useApp.getState().setViewWeek(week)
    router.navigate({ pathname: '/matchup', params: { focusTeam: String(team), focusWeek: String(week), selection: String(Date.now()) } })
  },
  /** a screen inside the League tab */
  league: (screen: 'playoffs' | 'fixtures' | 'activity' | 'draft-board' | 'scoring') => screen === 'draft-board' ? router.push('/draft-review') : router.push(`/league/${screen}`),
  /** app settings (sheet) */
  settings: () => router.push('/settings'),
  profile: () => router.push('/profile'),
  editProfile: () => router.push('/profile/edit'),
  close: () => (router.canGoBack() ? router.back() : nav.home()),
  /**
   * start from the top: Setup, the draft room or the season, by phase. Use after deleting the league, when the sheet
   * you're in has nothing left to go back to.
   */
  home: () => router.dismissTo('/home'),
  createLeague: () => router.push('/competitions'),
  setupIpl: () => router.replace('/setup'),
  homeActivity: () => router.navigate('/activity'),
  preferences: () => router.navigate('/preferences'),
  enterLeague: () => router.replace(useApp.getState().league?.phase === 'draft' ? '/draft' : '/matchup'),
  openLeague: (target: 'matchup' | 'team' | 'chat' | 'activity' = 'matchup') => router.push(useApp.getState().league?.phase === 'draft' ? '/draft' : target === 'team' ? '/team' : target === 'chat' ? '/chat' : target === 'activity' ? '/league/activity' : '/matchup'),
}

/** Parse a numeric route param (`useLocalSearchParams` values are strings). */
export const intParam = (v: string | string[] | undefined) => Number(Array.isArray(v) ? v[0] : v)
