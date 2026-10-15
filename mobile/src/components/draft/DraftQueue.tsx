import { memo } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import type { League } from '@shared/engine/league'
import { getData } from '@shared/store'
import { useStyles, useTheme } from '@/theme/theme'
import { Button, EmptyState, Icon, PlayerLine, PlayerLink, Section, Txt } from '@/ui'
import { draftPlayer, toggleQueued } from './PlayerPool'

// Your draft queue: the players you starred, in the order you starred them. Autopick, auto-draft and an expired
// timer take the first one who still fits your roster.

/** separators start under the player's name: padding + number + gap + avatar + gap */
const INSET = 16 + 20 + 10 + 36 + 12

export function DraftQueue({ league, canPick }: { league: League; canPick: boolean }) {
  const queue = league.draft.queue
  return (
    <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 }}>
      {queue.length === 0 ? (
        <EmptyState
          icon="star"
          title="Your queue is empty"
          message="Tap the star next to a player to queue him. When the AI picks for you, it takes from your queue first."
        />
      ) : (
        <Section
          title={`Queue · ${queue.length}`}
          inset={INSET}
          footer="Autopick, auto-draft and the pick timer take the first player here who still fits your roster. Drafted players drop off."
        >
          {queue.map((pid, i) => <QueueRow key={pid} pid={pid} n={i + 1} canPick={canPick} />)}
        </Section>
      )}
    </ScrollView>
  )
}

const QueueRow = memo(function QueueRow({ pid, n, canPick }: { pid: number; n: number; canPick: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const p = getData().players[pid]
  return (
    <View style={s.row}>
      <Txt num size={13} tone="dim" style={s.n}>{n}</Txt>
      <PlayerLink pid={pid} style={s.link}>
        <PlayerLine p={p} sub={p.s25.apps ? `${p.s25.apps} GP` : 'New'} />
      </PlayerLink>
      <Pressable
        hitSlop={8}
        onPress={() => toggleQueued(pid)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${p.name} from your queue`}
        style={({ pressed }) => [s.star, pressed && { opacity: 0.5 }]}
      >
        <Icon name="star.fill" size={19} color={t.c.gold} />
      </Pressable>
      <Button title="Draft" kind="filled" size="small" disabled={!canPick} onPress={() => draftPlayer(pid)} accessibilityLabel={`Draft ${p.name}`} />
    </View>
  )
})

const styles = () => ({
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 62, paddingLeft: 16, paddingRight: 12, paddingVertical: 8 },
  n: { width: 20, textAlign: 'center' as const },
  link: { flex: 1, minWidth: 0 },
  star: { width: 30, height: 30, alignItems: 'center' as const, justifyContent: 'center' as const },
})
