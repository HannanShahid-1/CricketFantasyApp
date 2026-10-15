import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { currentWeek, SLOTS } from '@shared/engine/league'
import { getData, ME, useApp } from '@shared/store'
import { applyMove, sameSpot, spotPlayer, swapTargets, type LineupSpot } from '@shared/ui/lineup'
import { SHEET_HEADER_HEIGHT, SheetHeader } from '@/components/sheets/SheetChrome'
import { useGameLeague } from '@/data/gameLeague'
import { intParam } from '@/nav'
import { useTheme } from '@/theme/theme'
import { EmptyState, PlayerLine, report, Row, Section, SlotBadge, Txt } from '@/ui'

export function SwapScreen() {
  const params = useLocalSearchParams<{ slot: string; week: string; pid: string }>()
  const slot = intParam(params.slot)
  const week = intParam(params.week)
  const [expectedPid, setExpectedPid] = useState(() => intParam(params.pid))
  const league = useGameLeague()
  const t = useTheme()
  const d = getData()
  const starters = league?.teams[ME].starters
  const source = starters?.[slot] ?? null
  const current = !!league && week === currentWeek(d, league) && (source ?? -1) === expectedPid
  const targets = league && current ? swapTargets(d, league, ME, week, slot) : []
  const from: LineupSpot = { kind: 'slot', i: slot }

  const swap = (to: LineupSpot) => {
    // Recheck against the current store if a replay, trade or auto-sub changed the lineup while open.
    const latest = useApp.getState().league
    if (!latest || (latest.teams[ME].starters[slot] ?? -1) !== expectedPid || !swapTargets(d, latest, ME, week, slot).some((target) => sameSpot(target, to))) {
      report('This swap is no longer available. Close this screen and choose again.')
      return
    }
    const next = applyMove(latest.teams[ME].starters, from, to)
    if (report(useApp.getState().setStarters(next), 'Lineup updated')) setExpectedPid(next[slot] ?? -1)
  }

  const row = (to: LineupSpot) => {
    const pid = spotPlayer(starters!, to)
    const label = to.kind === 'bench' ? 'BN' : SLOTS[to.i]
    return (
      <Row key={to.kind === 'bench' ? `b${to.p}` : `s${to.i}`} onPress={() => swap(to)} left={<SlotBadge slot={label} />} right={<Txt size={13} weight={600} tone="accent">{source === null || pid === null ? 'Move' : 'Swap'}</Txt>}>
        {pid === null ? <Txt size={15}>Empty {label} slot</Txt> : <PlayerLine p={d.players[pid]} />}
      </Row>
    )
  }
  const xi = targets.filter((to) => to.kind === 'slot')
  const bench = targets.filter((to) => to.kind === 'bench')

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: SHEET_HEADER_HEIGHT + 4, paddingBottom: 32, gap: 24 }}>
        <Section title="Selected position">
          <Row left={<SlotBadge slot={SLOTS[slot] ?? 'BN'} />}>
            {source === null ? <Txt size={15}>Empty {SLOTS[slot]} slot</Txt> : <PlayerLine p={d.players[source]} />}
          </Row>
        </Section>
        {targets.length === 0 && <EmptyState icon="lock.fill" title={current ? 'No eligible swaps' : 'Lineup has changed'} message={current ? 'Only unlocked players who fit both positions can swap.' : 'Close this screen and select a position again.'} />}
        {xi.length > 0 && <Section title="Starting XI">{xi.map(row)}</Section>}
        <Section title="Bench">
          {bench.length > 0 ? bench.map(row) : <Row title="No eligible bench players" />}
        </Section>
      </ScrollView>
      <SheetHeader title={`Swap ${SLOTS[slot] ?? 'player'}`} cancelLabel="Done" />
    </View>
  )
}
