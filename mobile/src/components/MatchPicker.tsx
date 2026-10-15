import { Pressable, View } from 'react-native'
import { getData, ME, useApp } from '@shared/store'
import { lockMessage, matchChoices } from '@shared/ui/matchPick'
import { useGameLeague } from '@/data/gameLeague'
import { alpha, useTheme } from '@/theme/theme'
import { haptic, Icon, report, Txt } from '@/ui'

/**
 * Which of your player's matches counts this week (his first, unless you lock in another before it starts).
 * One capsule per match; tap a lockable one to lock it in. Logic shared with the web via `matchChoices`.
 * `compact` puts each capsule on one line (the My Team rows).
 */
export function MatchPicker({ pid, compact = false }: { pid: number; compact?: boolean }) {
  const t = useTheme()
  const d = getData()
  const league = useGameLeague()!
  const choices = matchChoices(d, league, ME, pid)
  if (!choices.length) return <Txt size={12} tone="dim">No match this week</Txt>
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 5 : 6 }} accessibilityRole="radiogroup">
      {choices.map((c, i) => {
        const color = c.on ? t.c.accent : t.c.muted
        return (
          <Pressable
            key={c.mi}
            disabled={!c.can}
            accessibilityRole="radio"
            accessibilityState={{ checked: c.on, disabled: !c.can }}
            accessibilityHint={c.hint}
            onPress={() => {
              haptic.select()
              report(useApp.getState().lockMatch(pid, c.mi), lockMessage(d, pid, c, i === 0))
            }}
            style={({ pressed }) => ({
              ...(compact
                ? { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 8, gap: 4 }
                : { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, gap: 2, minWidth: 92 }),
              borderWidth: c.explicit ? 1.5 : 1, borderStyle: c.can ? 'dashed' : 'solid',
              borderColor: c.on ? alpha(t.c.accent, 0.7) : t.c.line2,
              backgroundColor: c.on ? alpha(t.c.accent, 0.12) : pressed ? alpha(t.c.tint, 0.08) : 'transparent',
              opacity: c.done && !c.on ? 0.5 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: compact ? 4 : 5 }}>
              <Txt size={compact ? 11.5 : 12.5} weight={700} style={c.done && !c.on ? { textDecorationLine: 'line-through' } : undefined}>v {c.opp}</Txt>
              <Txt size={compact ? 10.5 : 11} tone="muted">{c.day}</Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {c.on && <Icon name={c.explicit ? 'lock.fill' : 'checkmark'} size={9} color={color} weight="bold" />}
              <Txt size={compact ? 10 : 10.5} weight={700} style={{ color: c.can ? t.c.text : color }}>{c.status}</Txt>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
