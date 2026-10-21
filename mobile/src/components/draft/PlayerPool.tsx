import { memo, useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { Player } from '@shared/engine/data'
import { draftedSet, type League } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { availablePool, canDraft, currentSlot } from '@shared/ui/draft'
import { draftRating, draftRatings, estimatedRound } from '@shared/ui/draftRankings'
import type { RoleFilter } from '@shared/ui/playerList'
import { RolePills } from '@/components/RolePills'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, chooseOption, EmptyState, haptic, Icon, Pill, PlayerAvatar, PlayerLink, SearchField, Txt } from '@/ui'

// The draft room's player pool: every undrafted player best first by preseason value, filtered by role, IPL team and
// name. Rows are memoised on plain values, so a pick only re-renders the rows it changes.

/** Draft a player for you, if you're still on the clock and he's still there (a tap can land just after a pick). */
export function draftPlayer(pid: number) {
  const { league, draftPick } = useApp.getState()
  if (league && canDraft(league, ME, pid)) draftPick(pid)
}

/** Star / unstar a player in your draft queue. */
export function toggleQueued(pid: number) {
  haptic.select()
  useApp.getState().toggleQueue(pid)
}

/** separators start under the player's name: row padding + rank + gap + avatar + gap */
const INSET = 8 + 24 + 8 + 36 + 12
/** the star and Draft button after the numbers, so the Proj heading lines up: star + gap + button + gap */
const DRAFT_W = 48
const TRAIL = 26 + 6 + DRAFT_W + 6

export function PlayerPool({ league, canPick, hidden }: { league: League; canPick: boolean; hidden?: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const [role, setRole] = useState<RoleFilter>('ALL')
  const [team, setTeam] = useState('ALL')
  const [q, setQ] = useState('')
  const taken = useMemo(() => draftedSet(league), [league])
  const ratings = draftRatings(d)
  const pool = useMemo(() => availablePool(d, taken, { role, team, q }).sort((a, b) => ratings.get(a.idx)!.rank - ratings.get(b.idx)!.rank), [d, ratings, taken, role, team, q])
  const queued = useMemo(() => new Set(league.draft.queue), [league])
  const round = currentSlot(league)?.round
  const filtered = role !== 'ALL' || team !== 'ALL' || q.trim() !== ''

  const pickTeam = () =>
    chooseOption({
      title: 'IPL team',
      options: [{ value: 'ALL', label: 'All IPL teams' }, ...d.raw.teams.map((x) => ({ value: x.code, label: x.name }))],
      value: team,
      tint: t.c.accent,
      onChoose: setTeam,
    })

  const last = pool.length - 1
  const renderItem = useCallback(
    ({ item, index }: { item: Player; index: number }) => (
      <PoolRow p={item} rank={ratings.get(item.idx)!.rank} teams={league.numTeams} queued={queued.has(item.idx)} canPick={canPick} first={index === 0} last={index === last} />
    ),
    [ratings, queued, canPick, last, league.numTeams],
  )

  return (
    <View style={[{ flex: 1 }, hidden && { display: 'none' }]}>
      <View style={s.filters}>
        <SearchField value={q} onChange={setQ} placeholder="Search players" style={{ marginHorizontal: 8 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          <RolePills value={role} onChange={setRole} />
          <Pill
            label={team === 'ALL' ? 'All teams' : team}
            on={team !== 'ALL'}
            onPress={pickTeam}
            badge={<Icon name="chevron.down" size={10} weight="bold" color={team !== 'ALL' ? t.c.ink : t.c.muted} />}
          />
        </ScrollView>
      </View>
      <FlatList
        data={pool}
        keyExtractor={(p) => String(p.idx)}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          pool.length ? (
            <View style={s.listHead}>
              <Txt up size={10} weight={600} tone="muted" style={{ flex: 1 }}>{filtered ? 'Matching' : round ? `Round ${round}` : 'Available'} · {pool.length}</Txt>
              {['2025', '2026', 'PPG'].map((year) => <Txt key={year} up size={9} tone="dim" style={{ width: 37, textAlign: 'right' }}>{year}</Txt>)}
            </View>
          ) : null
        }
        ListFooterComponent={<Txt size={10} tone="dim" style={s.footer}>2025/2026 actual FPTS · PPG is a 2026-based estimate · R is estimated round.</Txt>}
        ListEmptyComponent={
          <EmptyState
            icon="magnifyingglass"
            title="No players match"
            message={filtered ? 'Try another role, team or name.' : 'Everyone has been drafted.'}
            action={filtered ? <Button title="Clear filters" kind="tinted" onPress={() => { setRole('ALL'); setTeam('ALL'); setQ('') }} /> : undefined}
          />
        }
      />
    </View>
  )
}

const PoolRow = memo(function PoolRow({ p, rank, teams, queued, canPick, first, last }: {
  p: Player; rank: number; teams: number; queued: boolean; canPick: boolean; first: boolean; last: boolean
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const rating = draftRating(getData(), p)
  return (
    <View style={[s.row, first && s.first, last && s.last]}>
      <Txt num size={10} tone="dim" style={s.rank}>{rank}</Txt>
      <PlayerLink pid={p.idx} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <PlayerAvatar p={p} size={25} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Txt size={12} weight={700} numberOfLines={1}>{p.name}</Txt><Txt size={9} tone="muted" numberOfLines={1}>{p.role} · {p.team} · R{estimatedRound(rank, teams)}</Txt></View>
      </PlayerLink>
      {[p.s25.apps ? rating.points25 : null, rating.games26 ? rating.points26 : null, rating.projection].map((n, i) => <Txt key={i} num size={11} weight={i === 2 ? 700 : 400} tone={i === 2 ? 'accent' : 'muted'} style={{ width: 31, textAlign: 'right' }}>{n === null ? '–' : fmt(n, i === 2 ? 1 : 0)}</Txt>)}
      <Pressable hitSlop={5} onPress={() => toggleQueued(p.idx)} accessibilityRole="button" accessibilityLabel={queued ? `Remove ${p.name} from your queue` : `Queue ${p.name}`} style={({ pressed }) => [s.star, pressed && { opacity: 0.5 }]}><Icon name={queued ? 'star.fill' : 'star'} size={17} color={queued ? t.c.gold : t.c.dim} /></Pressable>
      <Button title="Draft" kind="filled" size="small" disabled={!canPick} onPress={() => draftPlayer(p.idx)} accessibilityLabel={`Draft ${p.name}`} style={{ width: DRAFT_W, paddingHorizontal: 4 }} />
    </View>
  )
})

function Separator() {
  const s = useStyles(styles)
  return (
    <View style={s.sepWrap}>
      <View style={s.sep} />
    </View>
  )
}

const styles = (t: Theme) => ({
  filters: { gap: 10, paddingBottom: 10 },
  listHead: { flexDirection: 'row' as const, paddingLeft: 13, paddingRight: 13 + TRAIL, paddingTop: 4, paddingBottom: 7 },
  footer: { paddingHorizontal: 32, paddingTop: 8, lineHeight: 17 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, minHeight: 49, marginHorizontal: 8, paddingLeft: 5, paddingRight: 5, paddingVertical: 6, backgroundColor: t.c.panel },
  first: { borderTopLeftRadius: t.r.lg, borderTopRightRadius: t.r.lg },
  last: { borderBottomLeftRadius: t.r.lg, borderBottomRightRadius: t.r.lg },
  rank: { width: 17, textAlign: 'center' as const },
  link: { flex: 1, minWidth: 0 },
  stat: { alignItems: 'flex-end' as const, minWidth: 36 },
  star: { width: 26, height: 32, alignItems: 'center' as const, justifyContent: 'center' as const },
  sepWrap: { marginHorizontal: 8, backgroundColor: t.c.panel },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: INSET, backgroundColor: t.c.line2 },
})
