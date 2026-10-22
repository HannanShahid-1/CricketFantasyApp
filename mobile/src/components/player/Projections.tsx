import { Image } from 'expo-image'
import { memo, useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { matchProjection, type Player } from '@shared/engine/data'
import { countedMatch, currentWeek, LAST_WEEK, weekMatches, type League } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData } from '@shared/store'
import { fmtDate, weekLabel } from '@shared/ui/format'
import { ownersOf } from '@/data/derived'
import { useLiveSim } from '@/data/simulation'
import { LOGOS } from '@/generated/photos'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { haptic, Icon, type SFSymbol, Txt } from '@/ui'
import { InfoButton } from './InfoButton'

// Compact weekly match tiles with projection and final/live points or start time.

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
  const [width, setWidth] = useState(340)
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
    setWeek((w) => w + by)
  }
  const columns = Math.min(3, Math.max(1, rows.length))
  const tileWidth = Math.min(132, (width - (columns - 1) * 8) / columns)
  return (
    <View style={{ gap: 10 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={s.heading}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Txt up size={10.5} weight={700} tone="muted">FPTS Projections</Txt>
          <InfoButton title="How projections work" message={HOW_PROJECTIONS} />
        </View>
        <View style={s.stepper}>
          <StepButton icon="chevron.left" label="Previous week" disabled={week <= 1} onPress={() => step(-1)} />
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Txt weight={700} size={14} tone="accent">{weekLabel(week)}</Txt>
            {gw && <Txt size={9.5} weight={600} tone="accent">{fmtDate(gw.start, false)}–{fmtDate(gw.end, false)}</Txt>}
          </View>
          <StepButton icon="chevron.right" label="Next week" disabled={week >= LAST_WEEK} onPress={() => step(1)} />
        </View>
      </View>
      {rows.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {rows.map(({ mi, f }) => <ProjectionTile key={mi} p={p} mi={mi} f={f} played={played} counts={mi === counted} width={tileWidth} replay={league?.replayMatch === mi && played === mi} />)}
        </ScrollView>
      ) : <View style={s.empty}><Txt size={13} tone="muted">No match this week</Txt></View>}
    </View>
  )
}

const ProjectionTile = memo(function ProjectionTile({ p, mi, f, played, counts, width, replay }: {
  p: Player; mi: number; f: Forecast; played: number; counts: boolean; width: number; replay: boolean
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const m = getData().matches[mi]
  const done = mi < played
  const g = done ? p.games.get(mi) : undefined
  const live = useLiveSim((sim) => replay && sim.m?.mi === mi ? sim.scores.get(p.idx) : undefined)
  const actual = done ? g ? fmt(g.pts.total, 2) : 'DNP' : live ? fmt(live.points, 2) : null
  const forecast = live?.projection ?? f.total
  const pace = live?.pace === 'ahead' ? t.c.win : live?.pace === 'behind' ? t.c.loss : t.c.text
  const day = fmtDate(m.raw.date).split(' ')[0].toUpperCase()
  return (
    <View accessible accessibilityLabel={`${day} versus ${f.opponent}${counts ? ', counting match' : ''}. Projection ${fmt(forecast, 2)}. ${done ? `Final ${actual}` : live ? `Live ${actual}` : `Starts ${m.raw.time}`}`} style={{ width, gap: 5 }}>
      <View style={s.opponent}>
        <Txt size={10} weight={700} tone="muted" numberOfLines={1}>{day} vs {f.opponent}</Txt>
        {LOGOS[f.opponent] && <Image source={LOGOS[f.opponent]} style={{ width: 15, height: 15 }} contentFit="contain" accessible={false} />}
        {counts && <Icon name="checkmark.circle.fill" size={11} color={t.c.accent} />}
      </View>
      <View style={s.tile}>
        <View style={s.tileRow}>
          <Txt up size={10} tone="muted">Proj</Txt>
          <Txt num weight={700} size={14} style={{ color: live ? pace : t.c.text }} numberOfLines={1} adjustsFontSizeToFit>{fmt(forecast, 2)}</Txt>
        </View>
        <View style={[s.tileRow, s.resultRow]}>
          {actual !== null ? <>
            <Txt up size={10} tone="muted">{done ? 'Final' : 'Live'}</Txt>
            <Txt num weight={700} size={14} numberOfLines={1} adjustsFontSizeToFit>{actual}</Txt>
          </> : <Txt size={11} tone="muted" numberOfLines={1} adjustsFontSizeToFit>{fmtDate(m.raw.date).split(' ')[0]} · {m.raw.time}</Txt>}
        </View>
      </View>
    </View>
  )
})

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
      <Icon name={icon} size={14} weight="semibold" color={t.c.accent} />
    </Pressable>
  )
}

const styles = (t: Theme) => ({
  heading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  stepper: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
  step: { width: 24, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const },
  opponent: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 3, height: 20 },
  tile: { borderRadius: t.r.md, borderWidth: 1, borderColor: t.c.line2, overflow: 'hidden' as const, backgroundColor: t.c.panel },
  tileRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 4, paddingHorizontal: 9, minHeight: 34 },
  resultRow: { backgroundColor: alpha(t.c.tint, 0.035), borderTopWidth: 1, borderTopColor: t.c.line },
  empty: { padding: 16, borderRadius: t.r.md, backgroundColor: t.c.panel },
})
