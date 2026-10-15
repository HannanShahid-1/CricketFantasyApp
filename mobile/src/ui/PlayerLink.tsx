import { Link } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, type AccessibilityRole, type AccessibilityState, type StyleProp, type ViewStyle } from 'react-native'
import { addMode, isLocked, type League } from '@shared/engine/league'
import { getData, ME, useApp } from '@shared/store'
import { ownersOf } from '@/data/derived'
import { nav } from '@/nav'
import { confirm, report } from './feedback'
import type { SFSymbol } from './Icon'

interface PlayerAction {
  label: string
  icon: SFSymbol
  destructive?: boolean
  run: () => void
}

/**
 * What you can do with a player right now, as a short key: 'free' / 'waiver' (add or claim him), 'trade:<team>'
 * (he's on another team), 'drop' (he's yours and not locked) or '' (nothing). Rows subscribe to this string rather than
 * the league, so a row re-renders only when its own options change, not on every pick or chat message.
 */
function actionKey(league: League | null, pid: number): string {
  if (!league || league.phase !== 'season') return ''
  const d = getData()
  const owners = ownersOf(league)
  const owner = owners.get(pid)
  if (owner === undefined) {
    const mode = addMode(d, league, pid, owners)
    return mode === 'none' ? '' : mode
  }
  if (owner !== ME) return `trade:${owner}`
  return isLocked(d, league, pid) ? '' : 'drop'
}

function actionsFor(key: string, pid: number): PlayerAction[] {
  const p = getData().players[pid]
  if (key === 'free' || key === 'waiver') {
    return [{ label: key === 'free' ? 'Add to team' : 'Claim off waivers', icon: 'plus.circle', run: () => nav.add(pid) }]
  }
  if (key.startsWith('trade:')) {
    const owner = Number(key.slice(6))
    return [{ label: `Trade for ${p.name}`, icon: 'arrow.left.arrow.right', run: () => nav.trade(owner) }]
  }
  if (key !== 'drop') return []
  return [{
    label: 'Drop',
    icon: 'trash',
    destructive: true,
    run: async () => {
      if (await confirm({ title: `Drop ${p.name}?`, message: 'He goes on waivers.', ok: 'Drop', destructive: true })) {
        report(useApp.getState().drop(pid), `Dropped ${p.name}`)
      }
    },
  }]
}

/**
 * Wraps a player row. Tap opens his card (or runs `onPress` instead, e.g. selecting him in the lineup editor);
 * press and hold shows a native menu with what you can do with him.
 */
export function PlayerLink({ pid, onPress, style, accessibilityRole, accessibilityState, children }: {
  pid: number; onPress?: () => void; style?: StyleProp<ViewStyle>
  /** for selection rows (e.g. checklists), so VoiceOver announces the row's role and checked state */
  accessibilityRole?: AccessibilityRole; accessibilityState?: AccessibilityState; children: ReactNode
}) {
  const key = useApp((s) => actionKey(s.league, pid))
  const actions = actionsFor(key, pid)
  return (
    <Link
      href={{ pathname: '/player/[id]', params: { id: String(pid) } }}
      asChild
      onPress={onPress && ((e) => {
        e.preventDefault()
        onPress()
      })}
    >
      <Link.Trigger>
        {/* one flat, static style: Link's Slot rejects style arrays and drops function styles (the native menu gives
            the press feedback) */}
        <Pressable style={StyleSheet.flatten(style)} accessibilityRole={accessibilityRole} accessibilityState={accessibilityState}>
          {children}
        </Pressable>
      </Link.Trigger>
      <Link.Menu title={getData().players[pid].fullName}>
        {[
          <Link.MenuAction key="card" icon="person.text.rectangle" onPress={() => nav.player(pid)}>Player card</Link.MenuAction>,
          ...actions.map((a) => (
            <Link.MenuAction key={a.label} icon={a.icon} destructive={a.destructive} onPress={a.run}>{a.label}</Link.MenuAction>
          )),
        ]}
      </Link.Menu>
    </Link>
  )
}
