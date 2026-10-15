import { memo, useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { Player } from '@shared/engine/data'
import { draftedSet, preseasonValue, type League } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { availablePool, canDraft, rankedPool } from '@shared/ui/draft'
import type { RoleFilter } from '@shared/ui/playerList'
import { RolePills } from '@/components/RolePills'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, chooseOption, EmptyState, haptic, Icon, Pill, PlayerLine, PlayerLink, SearchField, Txt } from '@/ui'

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
const DRAFT_W = 62
const TRAIL = 30 + 8 + DRAFT_W + 8

export function PlayerPool({ league, canPick, hidden }: { league: League; canPick: boolean; hidden?: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const [role, setRole] = useState<RoleFilter>('ALL')
  const [team, setTeam] = useState('ALL')
  const [q, setQ] = useState('')
  const taken = useMemo(() => draftedSet(league), [league])
  const pool = useMemo(() => availablePool(getData(), taken, { role, team, q }), [taken, role, team, q])
  const queued = useMemo(() => new Set(league.draft.queue), [league])
  const { rank } = rankedPool(d)
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
      <PoolRow p={item} rank={rank.get(item.idx)!} queued={queued.has(item.idx)} canPick={canPick} first={index === 0} last={index === last} />
    ),
    [rank, queued, canPick, last],
  )

  return (
    <View style={[{ flex: 1 }, hidden && { display: 'none' }]}>
      <View style={s.filters}>
        <SearchField value={q} onChange={setQ} placeholder="Search players" style={{ marginHorizontal: 16 }} />
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
              <Txt up size={12} weight={600} tone="muted" style={{ flex: 1 }}>{filtered ? 'Matching' : 'Available'} · {pool.length}</Txt>
              <Txt up size={12} weight={600} tone="muted">Proj</Txt>
            </View>
          ) : null
        }
        ListFooterComponent={
          pool.length ? (
            <Txt size={12.5} tone="dim" style={s.footer}>
              Ranked by Proj: 14 matches at his {Number(d.raw.simSeason) - 1} points per game (blended with his role's
              average), scaled by how often he played. Star a player to queue him; autopick takes from your queue first.
            </Txt>
          ) : null
        }
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

const PoolRow = memo(function PoolRow({ p, rank, queued, canPick, first, last }: {
  p: Player; rank: number; queued: boolean; canPick: boolean; first: boolean; last: boolean
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const played = p.s25.apps > 0
  return (
    <View style={[s.row, first && s.first, last && s.last]}>
      <Txt num size={12} tone="dim" style={s.rank}>{rank}</Txt>
      <PlayerLink pid={p.idx} style={s.link}>
        <PlayerLine
          p={p}
          sub={played ? `${p.s25.apps} GP` : 'New'}
          right={
            <View style={s.stat}>
              <Txt num weight={700} size={15} tone="accent">{fmt(preseasonValue(p), 0)}</Txt>
              <Txt num size={10.5} tone="dim">{played ? `${fmt(p.s25.avg, 1)}/g` : '–'}</Txt>
            </View>
          }
        />
      </PlayerLink>
      <Pressable
        hitSlop={8}
        onPress={() => toggleQueued(p.idx)}
        accessibilityRole="button"
        accessibilityLabel={queued ? `Remove ${p.name} from your queue` : `Queue ${p.name}`}
        style={({ pressed }) => [s.star, pressed && { opacity: 0.5 }]}
      >
        <Icon name={queued ? 'star.fill' : 'star'} size={19} color={queued ? t.c.gold : t.c.dim} />
      </Pressable>
      <Button title="Draft" kind="filled" size="small" disabled={!canPick} onPress={() => draftPlayer(p.idx)} accessibilityLabel={`Draft ${p.name}`} style={{ width: DRAFT_W }} />
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
  listHead: { flexDirection: 'row' as const, paddingLeft: 32, paddingRight: 16 + 12 + TRAIL, paddingTop: 4, paddingBottom: 7 },
  footer: { paddingHorizontal: 32, paddingTop: 8, lineHeight: 17 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 62, marginHorizontal: 16, paddingLeft: 8, paddingRight: 12, paddingVertical: 8, backgroundColor: t.c.panel },
  first: { borderTopLeftRadius: t.r.lg, borderTopRightRadius: t.r.lg },
  last: { borderBottomLeftRadius: t.r.lg, borderBottomRightRadius: t.r.lg },
  rank: { width: 24, textAlign: 'center' as const },
  link: { flex: 1, minWidth: 0 },
  stat: { alignItems: 'flex-end' as const, minWidth: 36 },
  star: { width: 30, height: 30, alignItems: 'center' as const, justifyContent: 'center' as const },
  sepWrap: { marginHorizontal: 16, backgroundColor: t.c.panel },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: INSET, backgroundColor: t.c.line2 },
})
