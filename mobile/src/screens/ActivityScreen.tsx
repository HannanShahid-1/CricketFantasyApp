import { memo, useMemo, useState } from 'react'
import { SectionList, View } from 'react-native'
import type { FTeam, Txn } from '@shared/engine/league'
import { getData, ME, useApp } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Chip, EmptyState, GroupCell, GroupHeader, Icon, PlayerAvatar, PlayerLink, RoleTag, RowIcon, Segmented, type SFSymbol, TeamTag, Txt } from '@/ui'

// Every transaction in the league, newest first and grouped by week: adds, drops, waiver claims (won and failed),
// trades and auto-subs. Players open their card.

type Filter = 'all' | 'mine'
const FILTERS: { key: Filter; label: string }[] = [{ key: 'all', label: 'All' }, { key: 'mine', label: 'Mine' }]

const KIND: Record<Txn['type'], { icon: SFSymbol; color: (t: Theme) => string; label: string }> = {
  add: { icon: 'plus', color: (t) => t.c.win, label: 'Free agent add' },
  drop: { icon: 'minus', color: (t) => t.c.loss, label: 'Dropped' },
  waiver: { icon: 'dollarsign', color: (t) => t.c.gold, label: 'Waiver claim' },
  'waiver-fail': { icon: 'xmark', color: (t) => t.c.loss, label: 'Claim failed' },
  trade: { icon: 'arrow.left.arrow.right', color: (t) => t.c.sky, label: 'Trade' },
  autosub: { icon: 'arrow.triangle.2.circlepath', color: (t) => t.c.ar, label: 'Auto-sub' },
}

/** separators start under the text, past the type icon */
const INSET = 16 + 30 + 12

export function ActivityScreen() {
  const t = useTheme()
  const txns = useApp((s) => s.league!.txns)
  const [filter, setFilter] = useState<Filter>('all')
  const sections = useMemo(() => {
    const byWeek = new Map<number, Txn[]>()
    for (const x of txns) {
      if (filter === 'mine' && x.teamId !== ME && x.otherTeamId !== ME) continue
      const list = byWeek.get(x.week)
      if (list) list.push(x)
      else byWeek.set(x.week, [x])
    }
    return [...byWeek].map(([week, data]) => ({ key: String(week), title: weekLabel(week), data }))
  }, [txns, filter])

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
      sections={sections}
      keyExtractor={(x) => String(x.id)}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={{ gap: 8 }}>
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />
          <Txt size={12.5} tone="dim" style={{ paddingHorizontal: 16 }}>Waivers, trades, adds, drops and auto-subs.</Txt>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="tray"
          title={filter === 'mine' ? 'No moves yet' : 'No transactions yet'}
          message="Waivers process at the end of each gameweek."
        />
      }
      renderSectionHeader={({ section }) => <GroupHeader title={section.title} style={{ paddingTop: 24 }} />}
      renderItem={({ item, index, section }) => (
        <GroupCell first={index === 0} last={index === section.data.length - 1} inset={INSET}>
          <TxnRow x={item} />
        </GroupCell>
      )}
    />
  )
}

const TxnRow = memo(function TxnRow({ x }: { x: Txn }) {
  const t = useTheme()
  const s = useStyles(styles)
  const teams = useApp((st) => st.league!.teams)
  const kind = KIND[x.type]
  const name = (team: FTeam) => (team.isUser ? 'You' : team.name)
  const failed = x.type === 'waiver-fail'
  return (
    <View style={s.row}>
      <RowIcon name={kind.icon} color={kind.color(t)} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Txt size={15.5} weight={600} numberOfLines={1}>{name(teams[x.teamId])}</Txt>
            <Txt size={13} tone="muted" numberOfLines={1}>
              {x.otherTeamId !== undefined ? `Trade with ${name(teams[x.otherTeamId])}` : kind.label}
            </Txt>
          </View>
          {x.bid !== undefined && <Chip label={`$${x.bid}`} tone="gold" />}
        </View>
        <View style={failed && { opacity: 0.6 }}>
          {x.adds.map((p) => <Move key={`+${p}`} pid={p} add />)}
          {x.drops.map((p) => <Move key={`-${p}`} pid={p} />)}
        </View>
        {x.note && <Txt size={12.5} tone="dim">{x.note}</Txt>}
      </View>
    </View>
  )
})

/** A player who came in (+) or went out (−); tap for his card. */
function Move({ pid, add }: { pid: number; add?: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const p = getData().players[pid]
  return (
    <PlayerLink pid={pid} style={s.move}>
      <Icon name={add ? 'plus' : 'minus'} size={11} color={add ? t.c.win : t.c.loss} weight="bold" />
      <PlayerAvatar p={p} size={26} />
      <Txt size={14.5} weight={600} numberOfLines={1} style={{ flexShrink: 1 }}>{p.name}</Txt>
      <TeamTag code={p.team} />
      <RoleTag p={p} />
    </PlayerLink>
  )
}

const styles = () => ({
  row: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  move: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingVertical: 4 },
})
