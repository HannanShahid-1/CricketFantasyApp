import { Stack, type NativeStackHeaderItem, type NativeStackNavigationOptions } from 'expo-router'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { currentWeek, LAST_WEEK, REG_WEEKS } from '@shared/engine/league'
import { getData, useApp } from '@shared/store'
import { fmtDate, weekLabel } from '@shared/ui/format'
import { nav } from '@/nav'
import { usePrefs } from '@/data/prefs'
import { useTheme } from '@/theme/theme'
import { haptic } from './feedback'

/** Native header look for every tab's stack: large title in the display face, translucent bar, accent tint. */
export function useStackOptions(): NativeStackNavigationOptions {
  const t = useTheme()
  return useMemo(() => ({
    headerLargeTitle: true,
    headerTransparent: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerTintColor: t.c.accent,
    headerTitleStyle: { fontFamily: t.font.display(700), color: t.c.text },
    headerLargeTitleStyle: { fontFamily: t.font.display(700), color: t.c.text },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: t.c.bg },
  }), [t])
}

/**
 * Layout for a sheet route (settings, trade, match): its own stack, because iOS only draws a sheet's navigation bar
 * (title, Cancel / Done) inside one. The screen sets its title and buttons with <Stack.Screen options>.
 */
export function SheetStack() {
  const options = useStackOptions()
  return <Stack screenOptions={{ ...options, headerLargeTitle: false }} />
}

/**
 * The Settings (gear) button in each tab's header. Pass the result as `unstable_headerRightItems`, or spread it last
 * into a screen's own items so it stays rightmost.
 */
export function useSettingsButton(): () => NativeStackHeaderItem[] {
  const t = useTheme()
  return useMemo(
    () => () => [{
      type: 'button',
      label: 'Settings',
      icon: { type: 'sfSymbol', name: 'gearshape' },
      tintColor: t.c.text,
      onPress: nav.settings,
    }],
    [t],
  )
}

/**
 * The Matchup tab's play button: a small menu naming the next IPL match, to watch it live (or, with testing tools,
 * sim it, the week or the season). Keeps the matchup itself at the top of the screen. Null once the season is over.
 */
export function useNextMatchMenu(): NativeStackHeaderItem | null {
  const t = useTheme()
  const { next, week } = useApp(useShallow((s) => {
    const l = s.league
    const running = !!l && l.phase === 'season' && l.played < getData().matches.length
    return { next: running ? l.played : null, week: l ? currentWeek(getData(), l) : 1 }
  }))
  const testingTools = usePrefs((s) => s.testingTools)
  return useMemo(() => {
    if (next === null) return null
    const m = getData().matches[next]
    const { simMatch, simWeek, simTo, notify } = useApp.getState()
    const sim = (fn: () => void, msg: string) => () => {
      fn()
      haptic.success()
      notify(msg, 'info')
    }
    return {
      type: 'menu',
      label: 'Next match',
      icon: { type: 'sfSymbol', name: 'play.fill' },
      tintColor: t.c.live,
      menu: {
        title: `Next: ${m.teams[0]} v ${m.teams[1]} · ${fmtDate(m.raw.date)}, ${m.raw.time}`,
        items: [
          { type: 'action', label: 'Watch live', icon: { type: 'sfSymbol', name: 'play.circle' }, onPress: () => nav.live(next) },
          ...(!testingTools ? [] : [
            { type: 'action' as const, label: 'Sim match', icon: { type: 'sfSymbol' as const, name: 'forward.end' as const }, onPress: sim(simMatch, 'Match simulated') },
            { type: 'action' as const, label: `Sim rest of ${weekLabel(week)}`, icon: { type: 'sfSymbol' as const, name: 'forward' as const }, onPress: sim(simWeek, `${weekLabel(week)} complete`) },
            { type: 'action' as const, label: 'Sim to playoffs', icon: { type: 'sfSymbol' as const, name: 'flag.checkered' as const }, hidden: week > REG_WEEKS, onPress: sim(() => simTo(REG_WEEKS), 'Regular season complete') },
            { type: 'action' as const, label: 'Sim whole season', icon: { type: 'sfSymbol' as const, name: 'trophy' as const }, onPress: sim(() => simTo(LAST_WEEK), 'Season complete') },
          ]),
        ],
      },
    }
  }, [t, next, week, testingTools])
}
