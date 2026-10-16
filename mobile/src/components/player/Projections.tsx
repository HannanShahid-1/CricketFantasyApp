import { memo, useCallback, useMemo, useState } from 'react'
import { LayoutAnimation, Pressable, View } from 'react-native'
import { matchProjection, ROLE_NAME, type Player } from '@shared/engine/data'
import { countedMatch, currentWeek, LAST_WEEK, weekMatches, type League } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData } from '@shared/store'
import { fmtDate, weekLabel } from '@shared/ui/format'
import { ptsBand } from '@shared/ui/playerCard'
import { ownersOf } from '@/data/derived'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Chip, haptic, Icon, Row, Section, type SFSymbol, TeamTag, type Tone, Txt } from '@/ui'
import { InfoButton } from './InfoButton'

// The player card's weekly projections: one row per match, each opening to the forecast's breakdown.

const HOW_PROJECTIONS =
  'Each projection starts from his average and his estimated chance of playing, then adjusts for the venue, how ' +
  "this opponent has fared against his role, his recent form and his batting and bowling workload. The weights are " +
  'fixed and conservative, small samples count for less, and the total adjustment is capped at ±25%.\n\n' +
  "Opposition XIs, injuries and batter-v-bowler matchups aren't known, so these are rough estimates, not " +
  "predictions, and they aren't proven to beat a plain average.\n\n" +
  'Past weeks are rebuilt from what was known before each match. Only the one match that counts for a lineup ' +
  'scores each week.'

type Forecast = ReturnType<typeof matchProjection>

export function Projections({ p, league, played }: { p: Player; league: League | null; played: number }) {
  const d = getData()
  const s = useStyles(styles)
  const [week, setWeek] = useState(() =>
    league?.phase === 'season' ? currentWeek(d, league) : league?.phase === 'complete' ? LAST_WEEK : 1,
  )
  const [open, setOpen] = useState<number | null>(null)
  const gw = d.gameweeks.find((g) => g.gw === week)
  const rows = useMemo(
    () => weekMatches(d, p.idx, week).map((mi) => ({ mi, f: matchProjection(d, p, mi, Math.min(played, mi)) })),
    [d, p, week, played],
  )
  // with two matches in the week, mark the one that counts for whoever has him
  const owner = league ? ownersOf(league).get(p.idx) : undefined
  const counted = league && owner !== undefined && rows.length > 1 ? countedMatch(d, league, owner, p.idx, week) : null
  const step = (by: number) => {
    haptic.select()
    setOpen(null)
    setWeek((w) => w + by)
  }
  const toggle = useCallback((mi: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    haptic.select()
    setOpen((o) => (o === mi ? null : mi))
  }, [])
  return (
    <Section
      title="Projections"
      action={<InfoButton title="How projections work" message={HOW_PROJECTIONS} />}
    >
      <View style={s.stepper}>
        <StepButton icon="chevron.left" label="Previous week" disabled={week <= 1} onPress={() => step(-1)} />
        <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
          <Txt display weight={700} size={16}>{weekLabel(week)}</Txt>
          {gw && <Txt size={12} tone="muted">{fmtDate(gw.start, false)} – {fmtDate(gw.end, false)}</Txt>}
        </View>
        <StepButton icon="chevron.right" label="Next week" disabled={week >= LAST_WEEK} onPress={() => step(1)} />
      </View>
      {rows.length ? (
        rows.map(({ mi, f }) => (
          <ProjectionRow key={mi} p={p} mi={mi} f={f} played={played} counts={mi === counted} open={open === mi} onToggle={toggle} />
        ))
      ) : (
        <Row title="No match this week" subtitle={`${getData().teams[p.team]?.name ?? 'His team'} doesn't play in ${weekLabel(week).toLowerCase()}.`} />
      )}
    </Section>
  )
}

const ProjectionRow = memo(function ProjectionRow({ p, mi, f, played, counts, open, onToggle }: {
  p: Player; mi: number; f: Forecast; played: number; counts: boolean; open: boolean; onToggle: (mi: number) => void
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const m = getData().matches[mi]
  const done = mi < played
  const g = done ? p.games.get(mi) : undefined
  const actual: { value: string; tone: Tone } = !done
    ? { value: '–', tone: 'dim' }
    : !g
      ? { value: 'DNP', tone: 'loss' }
      : { value: fmt(g.pts.total, 1), tone: ptsBand(g.pts.total) === 'big' ? 'win' : ptsBand(g.pts.total) === 'low' ? 'loss' : 'text' }
  return (
    <View>
      <Pressable
        onPress={() => onToggle(mi)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Shows what went into his projection"
        style={({ pressed }) => [s.projRow, pressed && { backgroundColor: alpha(t.c.tint, 0.07) }]}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <View style={s.inline}>
            <Txt size={13} tone="muted">v</Txt>
            <TeamTag code={f.opponent} />
            {counts && <Chip label="Counts" tone="accent" icon="checkmark" />}
          </View>
          <Txt size={13} tone="muted" numberOfLines={1}>{fmtDate(m.raw.date)} · {m.raw.time}</Txt>
        </View>
        <NumCol label="Proj" value={fmt(f.total, 1)} tone={done ? 'muted' : 'text'} />
        <NumCol label="FPTS" value={actual.value} tone={actual.tone} />
        <Icon name={open ? 'chevron.up' : 'chevron.down'} size={11} color={t.c.dim} weight="semibold" />
      </Pressable>
      {open && <Breakdown p={p} f={f} />}
    </View>
  )
})

function NumCol({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <View style={{ width: 50, alignItems: 'flex-end', gap: 1 }}>
      <Txt up size={9.5} weight={700} tone="dim">{label}</Txt>
      <Txt num weight={700} size={18} tone={tone} numberOfLines={1}>{value}</Txt>
    </View>
  )
}

const signed = (x: number) => `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(2)}`
const appearances = (n: number) => `${n} earlier ${n === 1 ? 'appearance' : 'appearances'}`

/**
 * Why this forecast: his baseline plus each adjustment, both already scaled by his chance of playing, so the lines
 * add up to the projection. Adjustments that are zero (bowling workload for a keeper, say) are left out.
 */
function Breakdown({ p, f }: { p: Player; f: Forecast }) {
  const s = useStyles(styles)
  const line = (label: string, value: string, strong = false) => (
    <View key={label} style={s.line}>
      <Txt size={13.5} tone={strong ? 'text' : 'muted'} weight={strong ? 600 : 400} style={{ flex: 1 }}>{label}</Txt>
      <Txt num size={13.5} weight={strong ? 700 : 600}>{value}</Txt>
    </View>
  )
  const role = ROLE_NAME[p.role].toLowerCase()
  return (
    <View style={s.forecast}>
      {line('Player baseline', (f.base * f.chance).toFixed(2))}
      {f.components.filter((c) => Math.abs(c.points) >= 0.005).map((c) => line(c.label, signed(c.points)))}
      <View style={s.rule} />
      {line('Projection', f.total.toFixed(2), true)}
      <Txt size={12} tone="dim" style={{ lineHeight: 16, marginTop: 6 }}>
        Already allows for his {Math.round(f.chance * 100)}% chance of playing. Venue: {appearances(f.venueSamples)} by a{' '}
        {role} at {f.venue}. Opponent: {appearances(f.opponentSamples)} by a {role} against {f.opponent}. Small samples count for less.
      </Txt>
    </View>
  )
}

function StepButton({ icon, label, disabled, onPress }: { icon: SFSymbol; label: string; disabled: boolean; onPress: () => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.step, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={14} weight="semibold" color={t.c.text} />
    </Pressable>
  )
}

const styles = (t: Theme) => ({
  stepper: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  step: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: alpha(t.c.tint, 0.08),
  },
  projRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
  forecast: { gap: 2, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, backgroundColor: alpha(t.c.shade, 0.12) },
  line: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 22 },
  rule: { height: 1, backgroundColor: t.c.line2, marginVertical: 4 },
  inline: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
})
