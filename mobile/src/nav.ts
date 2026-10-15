import { router } from 'expo-router'
import { LEAGUE_CHANNEL, type ChannelId } from '@shared/engine/chat'
import { useApp } from '@shared/store'

// Every route the app opens, in one place. Screens call these instead of building hrefs.

export const nav = {
  /** player card (sheet) */
  player: (pid: number) => router.push({ pathname: '/player/[id]', params: { id: String(pid) } }),
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
  /** a screen inside the League tab */
  league: (screen: 'playoffs' | 'fixtures' | 'activity' | 'draft-board' | 'scoring') => router.push(`/league/${screen}`),
  /** app settings (sheet) */
  settings: () => router.push('/settings'),
  close: () => (router.canGoBack() ? router.back() : nav.home()),
  /**
   * start from the top: Setup, the draft room or the season, by phase. Use after deleting the league, when the sheet
   * you're in has nothing left to go back to.
   */
  home: () => router.replace('/'),
}

/** Parse a numeric route param (`useLocalSearchParams` values are strings). */
export const intParam = (v: string | string[] | undefined) => Number(Array.isArray(v) ? v[0] : v)
