import type { NativeStackNavigationOptions } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, View } from 'react-native'
import { managerName, PERSONA_LABEL, type FTeam } from '@shared/engine/league'
import { getData } from '@shared/store'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Icon, PlayerAvatar, RoleTag, TeamBadge, TeamTag, Txt } from '@/ui'

// Pieces of the trade sheet: the board pinned over the roster lists, the summary on the review screen, and the
// plain-words value check.

export type TradeSide = 'give' | 'get'

/** Both trade screens: an opaque bar, so the pinned board sits right under it. Cancel on the first screen. */
export function useTradeHeader(title: string, cancel: boolean): NativeStackNavigationOptions {
  const t = useTheme()
  return useMemo(() => ({
    title,
    headerTransparent: false,
    headerStyle: { backgroundColor: t.c.bg },
    headerShadowVisible: false,
    ...(cancel && { unstable_headerLeftItems: () => [{ type: 'button' as const, label: 'Cancel', onPress: nav.close }] }),
  }), [t, title, cancel])
}

/**
 * The trade so far, always in view: what you give on the left, what you get on the right. Tap a column to pick for
 * that side, ✕ to take a player out, and the other team's name to trade with someone else.
 */
export function TradeBoard({ me, them, give, get, side, onSide, onRemove, onChangeTeam }: {
  me: FTeam; them: FTeam; give: number[]; get: number[]; side: TradeSide
  onSide: (side: TradeSide) => void; onRemove: (side: TradeSide, pid: number) => void; onChangeTeam: () => void
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const column = (key: TradeSide, team: FTeam, ps: number[]) => {
    const on = side === key
    return (
      <Pressable
        onPress={() => onSide(key)}
        style={[s.col, on && s.colOn]}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={key === 'give' ? 'You give' : 'You get'}
      >
        <Pressable
          onPress={key === 'get' ? onChangeTeam : () => onSide(key)}
          hitSlop={6}
          style={({ pressed }) => [s.colHead, pressed && key === 'get' && { opacity: 0.5 }]}
          accessibilityRole={key === 'get' ? 'button' : undefined}
          accessibilityHint={key === 'get' ? 'Trade with another team' : undefined}
        >
          <TeamBadge team={team} size={26} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt up size={9.5} weight={700} tone={on ? 'accent' : 'muted'}>{key === 'give' ? 'You give' : 'You get'}</Txt>
            <Txt size={13} weight={700} numberOfLines={1}>{team.name}</Txt>
          </View>
          {key === 'get' && <Icon name="chevron.up.chevron.down" size={11} color={t.c.muted} weight="semibold" />}
        </Pressable>
        {ps.length ? (
          ps.map((p) => <BoardPlayer key={p} pid={p} onRemove={() => onRemove(key, p)} />)
        ) : (
          <View style={[s.empty, on && { borderColor: alpha(t.c.accent, 0.5) }]}>
            <Txt size={12} tone={on ? 'accent' : 'dim'}>{on ? 'Pick below' : 'Tap to pick'}</Txt>
          </View>
        )}
      </Pressable>
    )
  }
  return (
    <View>
      <View style={s.board}>
        {column('give', me, give)}
        {column('get', them, get)}
      </View>
      {/* the swap mark between the two columns */}
      <View pointerEvents="none" style={s.swapWrap}>
        <View style={s.swap}><Icon name="arrow.left.arrow.right" size={11} color={t.c.muted} weight="bold" /></View>
      </View>
    </View>
  )
}

/** A picked player on the board, with ✕ to take him out. */
function BoardPlayer({ pid, onRemove }: { pid: number; onRemove: () => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const p = getData().players[pid]
  return (
    <View style={s.player}>
      <PlayerAvatar p={p} size={26} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={12.5} weight={600} numberOfLines={1}>{p.name}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Txt size={10} weight={700} tone="dim">{p.team}</Txt>
          <RoleTag p={p} />
        </View>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`}>
        {({ pressed }) => <Icon name="xmark.circle.fill" size={17} color={t.c.dim} style={{ opacity: pressed ? 0.5 : 1 }} />}
      </Pressable>
    </View>
  )
}

/** The review screen's card: both teams, then the players going each way, side by side. */
export function TradeSummary({ me, them, give, get }: { me: FTeam; them: FTeam; give: number[]; get: number[] }) {
  const t = useTheme()
  const s = useStyles(styles)
  const team = (tm: FTeam, sub: string) => (
    <View style={s.sumTeam}>
      <TeamBadge team={tm} size={44} />
      <Txt display size={14} weight={700} numberOfLines={1} style={{ textAlign: 'center' }}>{tm.name}</Txt>
      <Txt size={11.5} tone="muted" numberOfLines={1}>{sub}</Txt>
    </View>
  )
  const list = (label: string, ps: number[]) => (
    <View style={{ flex: 1, gap: 10 }}>
      <Txt up size={10.5} weight={700} tone="muted">{label}</Txt>
      {ps.map((pid) => {
        const p = getData().players[pid]
        return (
          <View key={pid} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PlayerAvatar p={p} size={34} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt size={14} weight={600} numberOfLines={1}>{p.name}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <TeamTag code={p.team} />
                <RoleTag p={p} />
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
  return (
    <View style={s.summary}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {team(me, 'You')}
        <View style={s.sumSwap}><Icon name="arrow.left.arrow.right" size={15} color={t.c.accent} weight="bold" /></View>
        {team(them, `${managerName(them)} · ${PERSONA_LABEL[them.persona]}`)}
      </View>
      <View style={s.rule} />
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {list(`You give · ${give.length}`, give)}
        {list(`You get · ${get.length}`, get)}
      </View>
    </View>
  )
}

const styles = (t: Theme) => ({
  board: { flexDirection: 'row' as const, gap: 8 },
  col: {
    flex: 1, gap: 8, padding: 10, borderRadius: t.r.lg, backgroundColor: t.c.panel,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  colOn: { borderColor: alpha(t.c.accent, 0.6) },
  colHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, minHeight: 30 },
  empty: {
    height: 38, borderRadius: t.r.md, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: t.c.line2,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  player: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, paddingVertical: 5, paddingLeft: 5, paddingRight: 7,
    borderRadius: t.r.md, backgroundColor: alpha(t.c.tint, 0.06),
  },
  swapWrap: { position: 'absolute' as const, top: 13, left: 0, right: 0, alignItems: 'center' as const },
  swap: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: t.c.panel3, borderWidth: 1, borderColor: t.c.line2,
  },
  summary: { padding: 16, gap: 16, borderRadius: t.r.lg, backgroundColor: t.c.panel },
  sumTeam: { flex: 1, alignItems: 'center' as const, gap: 5, minWidth: 0 },
  sumSwap: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: alpha(t.c.accent, 0.14),
  },
  rule: { height: 1, backgroundColor: t.c.line2 },
})
