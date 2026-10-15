import { Stack, type NativeStackHeaderItem, type NativeStackNavigationOptions } from 'expo-router'
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native'
import type { SearchBarCommands } from 'react-native-screens'
import type { Data } from '@shared/engine/data'
import { currentWeek, type FTeam } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import {
  playerRows, STATUS_LABEL, type PlayerRow, type PlayerStatus, type RoleFilter, type SortKey,
} from '@shared/ui/playerList'
import { useGameLeague } from '@/data/gameLeague'
import { RolePills } from '@/components/RolePills'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import {
  Button, Chip, EmptyState, haptic, Icon, MatchBalls, PlayerAvatar, PlayerLink, RoleTag, Segmented, TeamTag, Txt,
  useSettingsButton,
} from '@/ui'

// Players tab: every IPL player, to find free agents, waiver claims and trade targets. Filtering and sorting come from
// the shared playerList (same as the web's PlayersView). Status and role sit at the top of the list; search, IPL team
// and sort live in the header.

type Stat = SortKey | 'gp'

/** stat-line order under each player; the stat the list is sorted by moves to the big number on the right */
const STAT_LINE: Stat[] = ['week', 'last', 'gp', 'season', 'avg', 'prev', 'ros']
const SORTS: SortKey[] = ['ros', 'week', 'last', 'season', 'avg', 'prev']
const STATUSES = (Object.keys(STATUS_LABEL) as PlayerStatus[]).map((key) => ({ key, label: STATUS_LABEL[key] }))
const NO_MATCH: Record<PlayerStatus, string> = {
  avail: 'No free agents or waiver players match.',
  all: 'Try a different search, role or team.',
  rostered: 'No rostered players match.',
  mine: 'None of your players match.',
}

interface StatLabel {
  /** stat-line column */
  short: string
  /** under the big number */
  tag: string
  /** sort menu and list caption */
  long: string
}

function statLabels(d: Data, week: number): Record<Stat, StatLabel> {
  const prev = Number(d.raw.simSeason) - 1
  const yy = `’${String(prev).slice(-2)}`
  return {
    ros: { short: 'ROS', tag: 'ROS proj', long: 'Rest-of-season projection' },
    week: { short: 'Week', tag: 'Week proj', long: `${weekLabel(week)} projection` },
    last: { short: 'Last', tag: 'Last', long: 'Last match' },
    gp: { short: 'GP', tag: 'GP', long: 'Games played' },
    season: { short: 'Season', tag: 'Season', long: 'Season points' },
    avg: { short: 'Avg', tag: 'Average', long: 'Season average' },
    prev: { short: `${yy} avg`, tag: `${yy} avg`, long: `${prev} average` },
  }
}

const DASH = '–'

function statText(r: PlayerRow, k: Stat): string {
  switch (k) {
    case 'week': return fmt(r.week.total, 1)
    case 'last': return r.last === null ? DASH : fmt(r.last)
    case 'gp': return String(r.season.apps)
    case 'season': return fmt(r.season.pts, 1)
    case 'avg': return r.season.apps ? fmt(r.season.avg, 1) : DASH
    case 'prev': return r.p.s25.apps ? fmt(r.p.s25.avg, 1) : DASH
    case 'ros': return fmt(r.ros, 0)
  }
}

export function PlayersScreen() {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const league = useGameLeague()!
  const settings = useSettingsButton()
  const [status, setStatus] = useState<PlayerStatus>('avail')
  const [role, setRole] = useState<RoleFilter>('ALL')
  const [team, setTeam] = useState('ALL')
  const [sort, setSort] = useState<SortKey>('ros')
  const [q, setQ] = useState('')
  const query = useDeferredValue(q)
  const searchRef = useRef<SearchBarCommands>(null)
  const week = currentWeek(d, league)
  const labels = useMemo(() => statLabels(d, week), [d, week])

  const rows = useMemo(() => playerRows(d, league, { status, role, team, q: query }, sort), [d, league, status, role, team, query, sort])

  // Header: search bar, IPL-team filter and sort menus, then the league "…" menu. Kept independent of the search
  // text so typing doesn't reconfigure the native header on every keystroke.
  const options = useMemo((): NativeStackNavigationOptions => {
    const teams = [...d.raw.teams].sort((a, b) => a.name.localeCompare(b.name))
    const filtering = team !== 'ALL'
    const filterMenu: NativeStackHeaderItem = {
      type: 'menu',
      label: 'IPL team',
      icon: { type: 'sfSymbol', name: filtering ? 'line.3.horizontal.decrease.circle.fill' : 'line.3.horizontal.decrease.circle' },
      tintColor: filtering ? t.c.accent : t.c.text,
      menu: {
        title: 'IPL team',
        items: [
          { type: 'action', label: 'All teams', state: filtering ? 'off' : 'on', onPress: () => setTeam('ALL') },
          {
            type: 'submenu', label: '', inline: true, items: teams.map((x) => ({
              type: 'action' as const, label: x.name, state: team === x.code ? 'on' as const : 'off' as const,
              onPress: () => setTeam(x.code),
            })),
          },
        ],
      },
    }
    const sortMenu: NativeStackHeaderItem = {
      type: 'menu',
      label: 'Sort',
      icon: { type: 'sfSymbol', name: 'arrow.up.arrow.down' },
      tintColor: t.c.text,
      menu: {
        title: 'Sort by',
        items: SORTS.map((k) => ({
          type: 'action' as const, label: labels[k].long, state: sort === k ? 'on' as const : 'off' as const,
          onPress: () => setSort(k),
        })),
      },
    }
    return {
      headerSearchBarOptions: {
        ref: searchRef,
        placeholder: 'Search players',
        autoCapitalize: 'none',
        placement: 'stacked',
        hideWhenScrolling: false,
        tintColor: t.c.accent,
        textColor: t.c.text,
        onChangeText: (e) => setQ(e.nativeEvent.text),
        onCancelButtonPress: () => setQ(''),
      },
      unstable_headerRightItems: () => [filterMenu, sortMenu, ...settings()],
    }
  }, [d, t, team, sort, labels, settings])

  const clearFilters = useCallback(() => {
    setRole('ALL')
    setTeam('ALL')
    setQ('')
    searchRef.current?.clearText()
  }, [])

  const canAct = league.phase === 'season'
  const renderItem = useCallback<ListRenderItem<PlayerRow>>(({ item, index }) => (
    <PlayerItem
      row={item}
      sort={sort}
      labels={labels}
      week={week}
      played={league.played}
      owner={item.owner === undefined || item.owner === ME ? undefined : league.teams[item.owner]}
      canAct={canAct}
      first={index === 0}
      last={index === rows.length - 1}
    />
  ), [sort, labels, week, league, canAct, rows.length])

  const filtered = role !== 'ALL' || team !== 'ALL' || query.trim() !== ''
  const header = (
    <View style={s.header}>
      <Segmented options={STATUSES} value={status} onChange={setStatus} />
      <RolePills value={role} onChange={setRole} fill />
      {team !== 'ALL' && <TeamFilterChip code={team} onClear={() => setTeam('ALL')} />}
      {rows.length > 0 && (
        <View style={s.caption}>
          <Txt up size={12} weight={600} tone="muted" style={{ flex: 1 }}>{rows.length} {rows.length === 1 ? 'player' : 'players'}</Txt>
          <Icon name="arrow.down" size={10} color={t.c.dim} weight="semibold" />
          <Txt size={12} tone="dim" numberOfLines={1}>{labels[sort].long}</Txt>
        </View>
      )}
    </View>
  )

  return (
    <>
      <Stack.Screen options={options} />
      <FlatList
        data={rows}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="magnifyingglass"
            title={query.trim() ? `No results for “${query.trim()}”` : 'No players found'}
            message={NO_MATCH[status]}
            action={
              <View style={{ gap: 10, alignItems: 'center' }}>
                {status !== 'all' && <Button title="Show all players" kind="tinted" onPress={() => setStatus('all')} />}
                {filtered && <Button title="Clear filters" kind="plain" onPress={clearFilters} />}
              </View>
            }
          />
        }
        ListFooterComponent={rows.length > 0 ? <Txt size={12.5} tone="dim" style={s.footer}>Tap a player for his card. Press and hold for quick actions.</Txt> : null}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        style={{ flex: 1, backgroundColor: t.c.bg }}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </>
  )
}

const keyOf = (r: PlayerRow) => String(r.p.idx)

function Separator() {
  const s = useStyles(styles)
  return <View style={s.sepWrap}><View style={s.sep} /></View>
}

/** The active IPL-team filter, tap to remove it. */
function TeamFilterChip({ code, onClear }: { code: string; onClear: () => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const team = getData().teams[code]
  if (!team) return null
  return (
    <Pressable
      onPress={() => {
        haptic.select()
        onClear()
      }}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${team.name} filter`}
      style={({ pressed }) => [s.filterChip, pressed && { opacity: 0.7 }]}
    >
      <View style={[s.swatch, { backgroundColor: t.team(team.color) }]} />
      <Txt size={13} weight={600} tone="accent">{team.name}</Txt>
      <Icon name="xmark.circle.fill" size={15} color={alpha(t.c.accent, 0.7)} />
    </Pressable>
  )
}

/** One player: who he is and his status, this week's matches, the sorted-by number, his stat line and an action. */
const PlayerItem = memo(function PlayerItem({ row, sort, labels, week, played, owner, canAct, first, last }: {
  row: PlayerRow; sort: SortKey; labels: Record<Stat, StatLabel>; week: number; played: number
  /** the other fantasy team that rosters him */
  owner: FTeam | undefined
  canAct: boolean; first: boolean; last: boolean
}) {
  const s = useStyles(styles)
  const d = getData()
  const { p } = row
  const big = statText(row, sort)
  // flattened: PlayerLink's Slot rejects style arrays
  const style = useMemo(() => StyleSheet.flatten([s.item, first && s.first, last && s.last]), [s, first, last])
  return (
    <PlayerLink pid={p.idx} style={style}>
      <View style={s.top}>
        <PlayerAvatar p={p} size={40} />
        <View style={s.who}>
          <View style={s.line}>
            <Txt size={15.5} weight={600} numberOfLines={1} style={{ flexShrink: 1 }}>{p.name}</Txt>
            <Status row={row} owner={owner} />
          </View>
          <View style={s.line}>
            <TeamTag code={p.team} />
            <RoleTag p={p} />
            <MatchBalls d={d} p={p} week={week} played={played} counted={row.week.mi} />
          </View>
        </View>
        <View style={s.side}>
          <Txt num weight={700} size={21} tone={big === DASH ? 'dim' : 'accent'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{big}</Txt>
          <Txt up size={9} weight={600} tone="dim" numberOfLines={1} style={s.label}>{labels[sort].tag}</Txt>
        </View>
      </View>
      <View style={s.bottom}>
        <View style={s.statLine}>
          {STAT_LINE.filter((k) => k !== sort).map((k) => {
            const v = statText(row, k)
            return (
              <View key={k} style={s.cell}>
                <Txt up size={8.5} weight={600} tone="dim" numberOfLines={1} style={s.label}>{labels[k].short}</Txt>
                <Txt num size={13} weight={600} tone={v === DASH ? 'dim' : 'text'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{v}</Txt>
              </View>
            )
          })}
        </View>
        <View style={s.side}>{canAct && <Action row={row} />}</View>
      </View>
    </PlayerLink>
  )
})

/** FA / Waivers / Mine, or the fantasy team that has him. */
function Status({ row, owner }: { row: PlayerRow; owner: FTeam | undefined }) {
  const t = useTheme()
  if (row.owner === undefined) return row.mode === 'waiver' ? <Chip label="WAIVERS" tone="gold" /> : <Chip label="FA" tone="accent" />
  if (row.owner === ME) return <Chip label="MINE" tone="ok" />
  if (!owner) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 10, minWidth: 0 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2.5, backgroundColor: t.team(owner.color) }} />
      <Txt size={12} tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{owner.name}</Txt>
    </View>
  )
}

/** Add a free agent, claim one off waivers, or open a trade with the team that has him. */
function Action({ row }: { row: PlayerRow }) {
  const { owner, mode, p } = row
  if (owner === undefined) {
    if (mode === 'none') return null
    return <Button title={mode === 'free' ? 'Add' : 'Claim'} kind="tinted" size="small" onPress={() => nav.add(p.idx)} accessibilityLabel={`${mode === 'free' ? 'Add' : 'Claim'} ${p.name}`} />
  }
  if (owner === ME) return null
  return <Button title="Trade" size="small" onPress={() => nav.trade(owner)} accessibilityLabel={`Trade for ${p.name}`} />
}

const styles = (t: Theme) => ({
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  caption: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 7 },
  filterChip: {
    flexDirection: 'row' as const, alignItems: 'center' as const, alignSelf: 'flex-start' as const, gap: 7, height: 32,
    paddingLeft: 12, paddingRight: 9, borderRadius: 999, backgroundColor: alpha(t.c.accent, 0.14),
  },
  swatch: { width: 8, height: 10, borderRadius: 2 },
  footer: { paddingHorizontal: 32, paddingTop: 8, lineHeight: 17 },
  item: { marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 10, backgroundColor: t.c.panel },
  first: { borderTopLeftRadius: t.r.lg, borderTopRightRadius: t.r.lg },
  last: { borderBottomLeftRadius: t.r.lg, borderBottomRightRadius: t.r.lg },
  sepWrap: { marginHorizontal: 16, backgroundColor: t.c.panel },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 16, backgroundColor: t.c.line2 },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  who: { flex: 1, minWidth: 0, gap: 5 },
  line: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  side: { width: 60, alignItems: 'flex-end' as const },
  label: { letterSpacing: 0.3 },
  bottom: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  statLine: { flex: 1, flexDirection: 'row' as const, paddingVertical: 6, borderRadius: t.r.md, backgroundColor: alpha(t.c.tint, 0.05) },
  cell: { flex: 1, minWidth: 0, alignItems: 'center' as const, gap: 2 },
})
