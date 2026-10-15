import { memo } from 'react'
import { View } from 'react-native'
import { fmt } from '@shared/engine/scoring'
import { getData } from '@shared/store'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { haptic, Icon, PlayerLine, PlayerLink, report, Txt } from '@/ui'

/** Separator inset for a `Section` of PickRows, so hairlines line up with the names. */
export const PICK_INSET = { check: 100, radio: 64 } as const

/**
 * A player you can pick in a sheet: avatar, name, team and role (plus an optional note), and (when given) his
 * rest-of-season value. `check` rows (multi-select) lead with a circle that fills when picked; `radio` rows (pick
 * one) show a trailing checkmark. Tap picks him, press and hold shows his menu. Locked players can't be picked:
 * tapping says why.
 */
export const PickRow = memo(function PickRow({ pid, ros, on, locked, mark, note, onPick }: {
  pid: number; ros?: number; on: boolean; locked: boolean; mark: 'check' | 'radio'
  /** a short line after his team and role, e.g. why picking him has a catch */
  note?: string
  onPick: (pid: number) => void
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const p = getData().players[pid]
  const pick = () => {
    if (locked) {
      report(`${p.name} is locked: his match this week has started.`)
      return
    }
    haptic.select()
    onPick(pid)
  }
  return (
    <PlayerLink
      pid={pid}
      onPress={pick}
      style={s.row}
      accessibilityRole={mark === 'check' ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: on, disabled: locked }}
    >
      <View style={[s.body, locked && s.locked]}>
        {mark === 'check' && (
          <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={24} weight="regular" color={on ? t.c.accent : t.c.dim} />
        )}
        <PlayerLine
          p={p}
          sub={note}
          right={
            <View style={s.right}>
              {locked && <Icon name="lock.fill" size={11} color={t.c.dim} />}
              {ros !== undefined && <Txt num weight={600} size={15} tone="muted">{fmt(ros, 0)}</Txt>}
              {mark === 'radio' && (
                <View style={s.mark}>{on && <Icon name="checkmark" size={16} weight="bold" color={t.c.accent} />}</View>
              )}
            </View>
          }
        />
      </View>
    </PlayerLink>
  )
})

const styles = (t: Theme) => ({
  row: { minHeight: 60, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' as const, backgroundColor: t.c.panel },
  body: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  locked: { opacity: 0.45 },
  right: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  mark: { width: 20, alignItems: 'flex-end' as const },
})
