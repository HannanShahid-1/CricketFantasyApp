import { memo, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import type { League } from '@shared/engine/league'
import { getData, ME } from '@shared/store'
import { currentSlot, draftBoard } from '@shared/ui/draft'
import { alpha, vivid, useStyles, useTheme, type Theme } from '@/theme/theme'
import { PlayerLink, roleColor, TeamBadge, Txt } from '@/ui'

// The draft board as the classic grid: a column per team in draft order, a row per round. It scrolls both ways, the
// team header stays pinned, and it opens on the round being drafted. Tap a pick for the player's card.

const CW = 80
const RH = 50
const GAP = 3
const HEADER = 37

export function DraftBoardGrid({ league }: { league: League }) {
  const s = useStyles(styles)
  const [height, setHeight] = useState(0)
  const rows = useMemo(() => draftBoard(league), [league])
  const cur = currentSlot(league)
  const order = league.draft.order
  const width = order.length * (CW + GAP) - GAP
  // open on the round being drafted (one round of context above it) and the column on the clock
  const [start] = useState(() => ({
    x: cur ? Math.max(0, order.indexOf(cur.teamId) - 1) * (CW + GAP) : 0,
    y: cur ? Math.max(0, cur.round - 2) * (RH + GAP) : 0,
  }))

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: start.x, y: 0 }} contentContainerStyle={{ paddingHorizontal: 6 }}>
          <View style={{ width, height }}>
            <View style={s.header}>
              {order.map((tid) => {
                const team = league.teams[tid]
                return (
                  <View key={tid} style={s.head}>
                    <TeamBadge team={team} size={22} />
                    <Txt size={11.5} weight={700} numberOfLines={1} tone={tid === ME ? 'accent' : 'text'} style={{ flexShrink: 1 }}>
                      {team.isUser ? 'You' : team.name}
                    </Txt>
                  </View>
                )
              })}
            </View>
            <ScrollView style={{ flex: 1 }} contentOffset={{ x: 0, y: start.y }} contentContainerStyle={{ paddingBottom: 12, gap: GAP }} showsVerticalScrollIndicator={false}>
            {rows.map((row, r) => (
              <View key={r} style={s.row}>
                {row.map((pk, c) => {
                  const tid = order[c]
                  const pick = pk?.pick ?? (r % 2 === 0 ? c + 1 : order.length - c)
                  return (
                    <Cell
                      key={tid}
                      pid={pk?.player ?? null}
                      label={`${r + 1}.${String(pick).padStart(2, '0')}`}
                      mine={tid === ME}
                      current={!!cur && cur.round === r + 1 && cur.teamId === tid}
                      arrow={c === (r % 2 === 0 ? order.length - 1 : 0) ? '↓' : r % 2 === 0 ? '→' : '←'}
                    />
                  )
                })}
              </View>
            ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const Cell = memo(function Cell({ pid, label, mine, current, arrow }: { pid: number | null; label: string; mine: boolean; current: boolean; arrow: string }) {
  const t = useTheme()
  const s = useStyles(styles)
  if (pid === null) {
    return (
      <View style={[s.cell, s.empty, mine && s.emptyMine, current && s.current]}>
        <Txt num size={11} tone={current ? 'accent' : 'dim'} weight={current ? 700 : 400}>{label}</Txt>
        {current && <Txt size={9.5} weight={700} tone="accent">ON THE CLOCK</Txt>}
      </View>
    )
  }
  const p = getData().players[pid]
  const color = roleColor(t, p.role)
  const background = vivid(color)
  return (
    <PlayerLink pid={pid} style={{ ...s.cell, backgroundColor: background, borderColor: mine ? t.c.accent : background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
        <Txt size={7.5} weight={700} numberOfLines={1} style={{ color: t.c.ink, flexShrink: 1 }}>{p.role} · {p.team}</Txt>
        <Txt num size={8} weight={700} style={{ color: t.c.ink }}>{label}</Txt>
      </View>
      <View style={{ paddingRight: 9 }}>
        <Txt size={9} weight={600} numberOfLines={1} adjustsFontSizeToFit style={{ color: t.c.ink }}>{p.fullName.includes(' ') ? p.fullName.slice(0, p.fullName.lastIndexOf(' ')) : ''}</Txt>
        <Txt size={11} weight={700} numberOfLines={1} adjustsFontSizeToFit style={{ color: t.c.ink }}>{p.fullName.slice(p.fullName.lastIndexOf(' ') + 1)}</Txt>
      </View>
      <Txt size={11} style={{ color: t.c.ink, position: 'absolute', right: 4, bottom: 1 }}>{arrow}</Txt>
    </PlayerLink>
  )
})

const styles = (t: Theme) => ({
  header: { flexDirection: 'row' as const, gap: GAP, height: HEADER, alignItems: 'center' as const, backgroundColor: t.c.bg },
  head: { width: CW, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  row: { flexDirection: 'row' as const, gap: GAP },
  cell: { width: CW, height: RH, borderRadius: t.r.sm, paddingHorizontal: 5, paddingVertical: 4, justifyContent: 'space-between' as const, borderWidth: 1 },
  empty: { alignItems: 'center' as const, justifyContent: 'center' as const, gap: 2, borderColor: t.c.line2, borderStyle: 'dashed' as const },
  emptyMine: { backgroundColor: alpha(t.c.accent, 0.05) },
  current: { borderStyle: 'solid' as const, borderColor: t.c.accent, backgroundColor: alpha(t.c.accent, 0.1) },
})
