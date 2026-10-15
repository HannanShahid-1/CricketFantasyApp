import { Stack, useLocalSearchParams } from 'expo-router'
import { memo, useMemo, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import type { Match } from '@shared/engine/data'
import { batLine, bowlLine, fieldLine, fmt, oversStr } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { fmtDate } from '@shared/ui/format'
import { economy, fantasyLeaders, inningsDetails, runRate, strikeRate, type InningsDetail } from '@shared/ui/scorecard'
import { useGameLeague } from '@/data/gameLeague'
import { TeamMark } from '@/components/match/parts'
import { ownersOf } from '@/data/derived'
import { intParam, nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, EmptyState, Icon, PlayerAvatar, PlayerLink, Screen, Section, Txt } from '@/ui'

// IPL match scorecard (sheet): the result, fantasy points, then each innings' batting and bowling. Mirrors the web's
// MatchModal (same shared helpers), laid out as grouped tables for a phone.

const TOP_FANTASY = 6

export function MatchScreen() {
  const mi = intParam(useLocalSearchParams<{ mi: string }>().mi)
  const league = useGameLeague()
  const m = getData().matches[mi]
  const options = useMemo(() => ({
    title: m ? `${m.teams[0]} v ${m.teams[1]}` : 'Scorecard',
    unstable_headerRightItems: () => [{ type: 'button' as const, label: 'Done', variant: 'done' as const, onPress: nav.close }],
  }), [m])
  // only played matches have a scorecard: anything else would show a result early
  const played = !!m && !!league && mi < league.played
  const next = !!m && !!league && league.phase === 'season' && mi === league.played
  return (
    <>
      <Stack.Screen options={options} />
      {played ? (
        <Scorecard m={m} />
      ) : (
        <Screen>
          <EmptyState
            icon="clock"
            title="Not played yet"
            message="The scorecard appears once this match has been played in your league."
            action={next && <Button title="Watch live" icon="play.fill" kind="live" onPress={() => nav.live(mi)} />}
          />
        </Screen>
      )}
    </>
  )
}

function Scorecard({ m }: { m: Match }) {
  const d = getData()
  const inns = useMemo(() => inningsDetails(d, m.raw), [d, m])
  return (
    <Screen>
      <Summary m={m} />
      <FantasyPoints m={m} />
      {inns.map((inn, i) => (
        <View key={i} style={{ gap: 24 }}>
          <Batting m={m} inn={inn} />
          <Bowling m={m} inn={inn} />
        </View>
      ))}
    </Screen>
  )
}

/** Date and venue, both totals (winner bright), the result, player of the match and the ball-by-ball replay. */
function Summary({ m }: { m: Match }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const pom = m.raw.pom.map((p) => d.players[p].name).join(', ')
  return (
    <View style={s.card}>
      <Txt size={13} tone="dim" numberOfLines={2}>
        {m.raw.num ? `Match ${m.raw.num}` : (m.raw.stage ?? 'Playoff')} · {fmtDate(m.raw.date)} · {m.raw.venue}
      </Txt>
      <View style={{ gap: 10 }}>
        {m.teams.map((code) => {
          const tot = m.totals.find((x) => x.team === code)
          const lost = !!m.raw.winner && m.raw.winner !== code
          return (
            <View key={code} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: lost ? 0.6 : 1 }}>
              <TeamMark code={code} size={16} />
              <Txt size={14} tone="muted" numberOfLines={1} style={{ flex: 1 }}>{d.teams[code]?.name}</Txt>
              {tot ? (
                <Txt num weight={700} size={24} tone="hi">
                  {tot.runs}/{tot.wkts} <Txt num size={13} tone="dim">({oversStr(tot.balls)})</Txt>
                </Txt>
              ) : (
                <Txt size={13} tone="dim">Did not bat</Txt>
              )}
            </View>
          )
        })}
      </View>
      <Txt size={15} weight={600} tone="accent">{m.raw.result}</Txt>
      {pom ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="star.fill" size={13} color={t.c.gold} />
          <Txt size={13.5} tone="muted" numberOfLines={1} style={{ flex: 1 }}>Player of the match: <Txt size={13.5} weight={600}>{pom}</Txt></Txt>
        </View>
      ) : null}
      <Button title="Replay ball by ball" icon="play.fill" kind="tinted" onPress={() => nav.live(m.mi)} style={{ alignSelf: 'flex-start' }} />
    </View>
  )
}

/** Everyone who played, by fantasy points, with his match line and who rosters him. */
function FantasyPoints({ m }: { m: Match }) {
  const [all, setAll] = useState(false)
  const leaders = useMemo(() => fantasyLeaders(m), [m])
  const shown = all ? leaders : leaders.slice(0, TOP_FANTASY)
  return (
    <Section
      title="Fantasy points"
      inset={64}
      action={leaders.length > TOP_FANTASY && (
        <Pressable hitSlop={10} onPress={() => setAll(!all)}>
          <Txt size={13} weight={600} tone="accent">{all ? `Top ${TOP_FANTASY}` : `All ${leaders.length}`}</Txt>
        </Pressable>
      )}
    >
      {shown.map(([p, pts]) => <FantasyRow key={p} m={m} p={p} pts={pts.total} />)}
    </Section>
  )
}

const FantasyRow = memo(function FantasyRow({ m, p, pts }: { m: Match; p: number; pts: number }) {
  const t = useTheme()
  const s = useStyles(styles)
  const pl = getData().players[p]
  const league = useGameLeague()!
  const o = ownersOf(league).get(p)
  const owner = o === undefined ? null : league.teams[o]
  const l = m.lines.get(p)
  const line = l ? [batLine(l), bowlLine(l), fieldLine(l)].filter(Boolean).join(' · ') : ''
  const mine = owner?.id === ME
  return (
    <PlayerLink pid={p}>
      <View style={[s.frow, mine && { backgroundColor: alpha(t.c.accent, 0.06) }]}>
        <PlayerAvatar p={pl} size={36} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Txt size={15} weight={600} numberOfLines={1}>{pl.name}</Txt>
          <Txt num size={12.5} tone="muted" numberOfLines={1}>{line || 'Did not bat or bowl'}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2, maxWidth: 110 }}>
          <Txt num weight={700} size={17} style={{ color: pts >= 25 ? t.c.accent : t.c.text }}>{fmt(pts)}</Txt>
          <Txt size={11} weight={mine ? 700 : 500} tone={mine ? 'accent' : owner ? 'muted' : 'dim'} numberOfLines={1}>
            {mine ? 'You' : owner ? owner.name : 'Free agent'}
          </Txt>
        </View>
      </View>
    </PlayerLink>
  )
})

// ---------- innings tables ----------

const BAT_COLS = [{ label: 'R', w: 30 }, { label: 'B', w: 28 }, { label: '4s', w: 24 }, { label: '6s', w: 24 }, { label: 'SR', w: 44 }, { label: 'Pts', w: 42 }]
const BOWL_COLS = [{ label: 'O', w: 32 }, { label: 'M', w: 22 }, { label: 'R', w: 30 }, { label: 'W', w: 24 }, { label: 'Econ', w: 42 }, { label: '0s', w: 26 }, { label: 'Pts', w: 42 }]

/** Column headings over a table's figures. */
function Heading({ first, cols }: { first: string; cols: { label: string; w: number }[] }) {
  const s = useStyles(styles)
  return (
    <View style={s.thead}>
      <Txt up size={10.5} weight={600} tone="dim" style={{ flex: 1 }}>{first}</Txt>
      {cols.map((c) => <Txt key={c.label} up size={10.5} weight={600} tone="dim" style={{ width: c.w, textAlign: 'right' }}>{c.label}</Txt>)}
    </View>
  )
}

/** One table row's figures in fixed-width columns, the `main` one emphasised (runs, wickets), then fantasy points. */
function Figures({ cols, values, main, pts }: { cols: { w: number }[]; values: (string | number)[]; main: number; pts?: number }) {
  const t = useTheme()
  return (
    <>
      {values.map((v, i) => (
        <Txt key={i} num size={i === main ? 15 : 14} weight={i === main ? 700 : 500} tone={i === main ? 'text' : 'muted'} style={{ width: cols[i].w, textAlign: 'right' }}>{v}</Txt>
      ))}
      <Txt num size={14} weight={700} style={{ width: cols[cols.length - 1].w, textAlign: 'right', color: (pts ?? 0) >= 25 ? t.c.accent : t.c.text }}>
        {pts === undefined ? '' : fmt(pts)}
      </Txt>
    </>
  )
}

/** A player's row in a table (your players' names in the accent colour), with an optional second line. */
function TableRow({ p, children, sub }: { p: number; children: ReactNode; sub?: string }) {
  const t = useTheme()
  const s = useStyles(styles)
  const mine = useApp((st) => !!st.league && ownersOf(st.league).get(p) === ME)
  return (
    <PlayerLink pid={p}>
      <View style={s.trow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt size={14.5} weight={600} numberOfLines={1} style={{ flex: 1, color: mine ? t.c.accent : t.c.text }}>{getData().players[p].name}</Txt>
          {children}
        </View>
        {sub !== undefined && <Txt size={12} tone="dim" numberOfLines={1}>{sub}</Txt>}
      </View>
    </PlayerLink>
  )
}

function Batting({ m, inn }: { m: Match; inn: InningsDetail }) {
  const s = useStyles(styles)
  const d = getData()
  const dnb = (m.raw.squads[inn.team] ?? []).filter((p) => !inn.batters.includes(p)).map((p) => d.players[p].name)
  return (
    <Section
      title={`${d.teams[inn.team]?.name ?? inn.team} batting`}
      inset={14}
      footer={dnb.length ? `Did not bat: ${dnb.join(', ')}` : undefined}
    >
      <Heading first="Batter" cols={BAT_COLS} />
      {inn.batters.map((p) => {
        const l = m.lines.get(p)
        if (!l) return null
        return (
          <TableRow key={p} p={p} sub={inn.dismissal.get(p) ?? 'not out'}>
            <Figures cols={BAT_COLS} values={[l.r, l.b, l.fours, l.sixes, strikeRate(l)]} main={0} pts={m.points.get(p)?.total} />
          </TableRow>
        )
      })}
      <View style={s.total}>
        <Txt size={14} tone="muted" style={{ flex: 1 }}>Extras</Txt>
        <Txt num size={14} tone="muted">{inn.extras}</Txt>
      </View>
      <View style={s.total}>
        <Txt size={15} weight={700} style={{ flex: 1 }}>Total</Txt>
        <Txt num size={15} weight={700}>
          {inn.runs}/{inn.wkts} <Txt num size={13} tone="dim">({oversStr(inn.balls)} ov · RR {runRate(inn.runs, inn.balls)})</Txt>
        </Txt>
      </View>
    </Section>
  )
}

function Bowling({ m, inn }: { m: Match; inn: InningsDetail }) {
  const d = getData()
  const team = m.teams.find((x) => x !== inn.team) ?? ''
  return (
    <Section title={`${d.teams[team]?.name ?? team} bowling`} inset={14}>
      <Heading first="Bowler" cols={BOWL_COLS} />
      {inn.bowlers.map((p) => {
        const l = m.lines.get(p)
        if (!l) return null
        return (
          <TableRow key={p} p={p}>
            <Figures cols={BOWL_COLS} values={[oversStr(l.bb), l.maidens, l.rc, l.w, economy(l), l.dots]} main={3} pts={m.points.get(p)?.total} />
          </TableRow>
        )
      })}
    </Section>
  )
}

const styles = (t: Theme) => ({
  card: { backgroundColor: t.c.panel, borderRadius: t.r.lg, padding: 16, gap: 14 },
  frow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 58, paddingVertical: 9, paddingHorizontal: 16 },
  thead: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 8 },
  trow: { gap: 2, paddingHorizontal: 14, paddingVertical: 9, minHeight: 50, justifyContent: 'center' as const },
  total: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, minHeight: 44 },
})
