import { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { ROSTER_SIZE, SLOTS, type League } from '@shared/engine/league'
import { getData, ME } from '@shared/store'
import { picksUntil, rosterBySlot } from '@shared/ui/draft'
import { ordinal } from '@shared/ui/lineup'
import { useStyles } from '@/theme/theme'
import { PlayerLine, PlayerLink, Section, SlotBadge, Tiles, Txt } from '@/ui'

// Your team so far, laid out by lineup slot: the best XI your picks can field, then the bench.

/** separators start under the player: padding + slot badge + gap */
const INSET = 16 + 44 + 12
const BENCH = ROSTER_SIZE - SLOTS.length

export function DraftRoster({ league }: { league: League }) {
  const { starters, bench } = useMemo(() => rosterBySlot(getData(), league, ME), [league])
  const next = picksUntil(league, ME)
  const extra = bench.length - BENCH
  return (
    <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 24 }}>
      <Tiles
        items={[
          { label: 'Drafted', value: `${league.teams[ME].roster.length}/${ROSTER_SIZE}` },
          { label: 'Draft slot', value: ordinal(league.draft.order.indexOf(ME) + 1) },
          { label: 'Your next pick', value: next === null ? 'Done' : next === 0 ? 'Now' : `In ${next}`, tone: next === 0 ? 'accent' : 'text' },
        ]}
      />
      <Section title="Starting XI" inset={INSET} footer="Your best XI from the players you have. Once the season starts you set it each week.">
        {SLOTS.map((slot, i) => <SlotRow key={i} slot={slot} pid={starters[i]} />)}
      </Section>
      <Section title="Bench" inset={INSET} footer={extra > 0 ? `+${extra} more: your XI can't fit them yet.` : undefined}>
        {Array.from({ length: BENCH }, (_, i) => <SlotRow key={i} slot="BN" pid={bench[i] ?? null} />)}
      </Section>
    </ScrollView>
  )
}

function SlotRow({ slot, pid }: { slot: string; pid: number | null }) {
  const s = useStyles(styles)
  return (
    <View style={s.row}>
      <SlotBadge slot={slot} />
      {pid === null ? (
        <Txt size={14} tone="dim" style={{ fontStyle: 'italic' }}>Empty</Txt>
      ) : (
        <PlayerLink pid={pid} style={s.link}>
          <PlayerLine p={getData().players[pid]} size={32} />
        </PlayerLink>
      )}
    </View>
  )
}

const styles = () => ({
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 54, paddingHorizontal: 16, paddingVertical: 8 },
  link: { flex: 1, minWidth: 0 },
})
