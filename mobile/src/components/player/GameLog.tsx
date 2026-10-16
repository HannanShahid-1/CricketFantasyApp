import { memo, useCallback, useMemo, useState } from 'react'
import { LayoutAnimation, Pressable, View } from 'react-native'
import type { Player } from '@shared/engine/data'
import { fmt } from '@shared/engine/scoring'
import { getData } from '@shared/store'
import { fmtDate } from '@shared/ui/format'
import { gameLog, ptsBand, type LogEntry } from '@shared/ui/playerCard'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Chip, haptic, Icon, Row, Section, type SFSymbol, TeamTag, Txt } from '@/ui'

// The player card's Game log tab: every match of his season, each opening to his stat line.

export function GameLog({ p, played }: { p: Player; played: number }) {
  const d = getData()
  const log = useMemo(() => gameLog(d, p, played), [d, p, played])
  const [open, setOpen] = useState<number | null>(null)
  const toggle = useCallback((mi: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    haptic.select()
    setOpen((o) => (o === mi ? null : mi))
  }, [])
  return (
    <Section
      title={`IPL ${d.raw.simSeason} matches`}
      inset={58}
    >
      {log.length
        ? log.map((e) => <LogRow key={e.mi} e={e} open={open === e.mi} onToggle={toggle} />)
        : <Row title="No matches" subtitle="He isn't in an IPL squad this season." />}
    </Section>
  )
}

const STAT_ICONS: SFSymbol[] = ['figure.cricket', 'cricket.ball', 'hand.raised']

const LogRow = memo(function LogRow({ e, open, onToggle }: { e: LogEntry; open: boolean; onToggle: (mi: number) => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const g = e.game
  const band = g ? ptsBand(g.pts.total) : 'normal'
  const stats = [e.bat, e.bowl, e.field]
  const line = (
    <View style={[s.logRow, e.state === 'upcoming' && { opacity: 0.5 }]}>
      <View style={s.gw}>
        <Txt up size={9} weight={700} tone="dim">GW</Txt>
        <Txt num weight={700} size={16}>{e.gw}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={s.inline}>
          <Txt size={13} tone="muted">v</Txt>
          <TeamTag code={e.opp} />
          <Txt size={13} tone="muted">{fmtDate(e.date)}</Txt>
        </View>
        {e.state === 'upcoming' ? (
          <Txt size={13.5} tone="dim">Upcoming · {e.time}</Txt>
        ) : e.state === 'dnp' ? (
          <Txt size={13.5} tone="loss">Did not play</Txt>
        ) : stats.some(Boolean) ? (
          <View style={s.stats}>
            {stats.map((text, i) => text ? (
              <View key={i} style={s.inline}>
                <Icon name={STAT_ICONS[i]} size={12} color={t.c.dim} />
                <Txt size={13.5}>{text}</Txt>
              </View>
            ) : null)}
          </View>
        ) : (
          <Txt size={13.5} tone="dim">In the XI · no stats</Txt>
        )}
      </View>
      {g && (
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Txt num weight={700} size={19} tone={band === 'big' ? 'win' : band === 'low' ? 'loss' : 'text'}>{fmt(g.pts.total)}</Txt>
          <Icon name={open ? 'chevron.up' : 'chevron.down'} size={11} color={t.c.dim} weight="semibold" />
        </View>
      )}
    </View>
  )
  if (!g) return line
  return (
    <View>
      <Pressable
        onPress={() => onToggle(e.mi)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Shows his points breakdown"
        style={({ pressed }) => pressed && { backgroundColor: alpha(t.c.tint, 0.07) }}
      >
        {line}
      </Pressable>
      {open && (
        <View style={s.breakdown}>
          <View style={s.chips}>
            {g.pts.parts.map((x, i) => (
              <Chip key={i} label={`${x.label} ${x.pts > 0 ? '+' : ''}${fmt(x.pts)}`} tone={x.pts > 0 ? 'ok' : 'bad'} />
            ))}
          </View>
          <Pressable onPress={() => nav.match(e.mi)} hitSlop={8} accessibilityRole="link" style={({ pressed }) => [s.inline, pressed && { opacity: 0.5 }]}>
            <Icon name="list.bullet.rectangle" size={14} color={t.c.accent} />
            <Txt size={14} weight={600} tone="accent">Full scorecard</Txt>
            <Icon name="chevron.right" size={11} color={t.c.accent} weight="semibold" />
          </Pressable>
        </View>
      )}
    </View>
  )
})

const styles = (t: Theme) => ({
  logRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
  gw: { width: 30, alignItems: 'center' as const },
  inline: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  stats: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, columnGap: 12, rowGap: 3 },
  breakdown: { gap: 12, paddingLeft: 58, paddingRight: 16, paddingBottom: 14, backgroundColor: alpha(t.c.shade, 0.12) },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, paddingTop: 12 },
})
