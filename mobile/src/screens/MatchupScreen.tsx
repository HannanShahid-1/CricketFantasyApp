import { Stack } from 'expo-router'
import { matchProjection } from '@shared/engine/data'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import {
  currentWeek, isOffRoster, LAST_WEEK, matchupsForWeek, matchupWinner, playerWeek, REG_WEEKS, slotLocked, SLOTS, winProbability,
  type League, type Matchup,
} from '@shared/engine/league'
import { simulatedTeamScore } from '@shared/ui/matchupSimulation'
import { REPLAY_SPEEDS } from '@shared/ui/replay'
import { SimulationContext, useMatchupSimulation, useSimulation } from '@/data/matchupSimulation'
import { fmt } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { fmtDate, weekLabel } from '@shared/ui/format'
import { liveTeamScore, teamStarters, weekRecap, weekSummary } from '@shared/ui/helpers'
import { useGameLeague } from '@/data/gameLeague'
import { WeekPills } from '@/components/WeekPills'
import { recordOf } from '@/data/derived'
import { usePrefs } from '@/data/prefs'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import {
  Button, canLiquid, Chip, EmptyState, Glass, GlassSection, GlassSlotBadge, Icon, LiquidPager, MatchBalls, Meter, PlayerAvatar, PlayerLink, Screen,
  Seam, Section, sideWash, SlotBadge, TeamBadge, Segmented, Txt, useSettingsButton, useNextMatchMenu, useTabTitle,
} from '@/ui'

// Home tab: this week's head-to-head. Mirrors the web's MatchupView (same engine helpers), laid out for a phone:
// a swipeable scoreboard per matchup, then both lineups side by side, slot by slot. Watching the next match live is
// the play button in the header (useNextMatchMenu), so the matchup gets the top of the screen.

export function MatchupScreen() {
  const d = getData()
  const league = useGameLeague()!
  const { viewWeek, setViewWeek } = useApp(useShallow((s) => ({ viewWeek: s.viewWeek, setViewWeek: s.setViewWeek })))
  const cur = currentWeek(d, league)
  const week = viewWeek ?? cur
  const [picked, setPicked] = useState({ week, i: 0 })
  // your matchup first, then the rest of the league
  const ms = useMemo(
    () => matchupsForWeek(league, week).sort((a, b) => Number(b.a === ME || b.b === ME) - Number(a.a === ME || a.b === ME)),
    [league, week],
  )
  const index = picked.week === week ? Math.min(picked.i, Math.max(0, ms.length - 1)) : 0
  const recap = useMemo(() => weekRecap(d, league, week), [d, league, week])
  const g = d.gameweeks[week - 1]
  // the play button (next match: watch live / sim) sits left of "…"
  const settings = useSettingsButton()
  const simulation = useSimulation(league)
  const next = useNextMatchMenu(simulation.start)
  const headerItems = useMemo(() => () => (next ? [next, ...settings()] : settings()), [next, settings])
  const title = useTabTitle(weekLabel(week))
  const playedIn = g.mis.filter((mi) => mi < league.played).length

  return (
    <>
      <Stack.Screen options={{ ...title, unstable_headerRightItems: headerItems }} />
      <SimulationContext.Provider value={simulation}>
      <Screen gap={14}>
        <SimulationControls />
        <View style={{ gap: 12 }}>
          <Txt tone="muted" size={14}>
            {fmtDate(g.start, false)} – {fmtDate(g.end, false)} · {week === cur && league.phase === 'season' ? `${playedIn} of ${g.mis.length} IPL matches played` : `${g.mis.length} IPL matches`}
          </Txt>
          <WeekPills league={league} week={week} onChange={(w) => { if (simulation.m) return useApp.getState().notify('Finish the current match before switching weeks.', 'info'); setViewWeek(w); setPicked({ week: w, i: 0 }) }} />
        </View>
        {league.champion !== null && week === LAST_WEEK && <Champion league={league} />}
        {ms.length === 0 ? (
          <EmptyState
            icon="trophy"
            title="Playoff matchups aren't set yet"
            message={`The top four after Week ${REG_WEEKS} play the semifinals, then the final.`}
            action={<Button title="Projected bracket" kind="tinted" onPress={() => nav.league('playoffs')} />}
          />
        ) : (
          <>
            <Carousel key={week} ms={ms} index={index} onIndex={(i) => setPicked({ week, i })} />
            <Lineups m={ms[index]} />
          </>
        )}
        {recap && (
          <Section title="Week recap">
            <View style={{ padding: 16, gap: 10 }}>
              {recap.map((s, i) => <Txt key={i} tone="muted" size={14} style={{ lineHeight: 20 }}>{s}</Txt>)}
            </View>
          </Section>
        )}
      </Screen>
      </SimulationContext.Provider>
    </>
  )
}

function SimulationControls() {
  const sim = useMatchupSimulation()!
  const league = useGameLeague()!
  const Group = usePrefs((p) => p.glassMatchup) ? GlassSection : Section
  if (!sim.m) {
    const next = league.phase === 'season' ? getData().matches[league.played] : null
    return next ? (
      <Group>
        <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Txt display weight={600} size={15} style={{ flex: 1 }}>{next.teams.join(' v ')}</Txt>
          <Button title="Simulate live" icon="play.fill" kind="tinted" onPress={sim.start} />
        </View>
      </Group>
    ) : null
  }
  const m = sim.m
  const last = sim.st?.last
  return (
    <Group>
      <View style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip label={sim.playing ? 'LIVE SIM' : 'PAUSED'} tone="live" />
          <Txt size={13} tone="muted" style={{ flex: 1 }} numberOfLines={1}>{`${m.teams.join(' v ')} · ${last ? `${last.label} · ${last.desc}` : 'Ready for the first ball'}`}</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Button icon={sim.playing ? 'pause.fill' : 'play.fill'} accessibilityLabel={sim.playing ? 'Pause simulation' : 'Resume simulation'} onPress={sim.toggle} />
          <Segmented options={REPLAY_SPEEDS.map((speed, i) => ({ key: String(i), label: speed.label }))} value={String(sim.speed)} onChange={(v) => sim.setSpeed(Number(v))} style={{ flex: 1 }} />
          <Button title="Finish" onPress={sim.finish} />
        </View>
      </View>
    </Group>
  )
}

function Champion({ league }: { league: League }) {
  const t = useTheme()
  const team = league.teams[league.champion!]
  return (
    <View style={{ alignItems: 'center', gap: 10, padding: 22, borderRadius: t.r.lg, backgroundColor: alpha(t.c.gold, 0.08), borderWidth: 1, borderColor: alpha(t.c.gold, 0.3) }}>
      <Icon name="trophy.fill" size={34} color={t.c.gold} />
      <Txt up size={12} weight={700} tone="gold">League champion</Txt>
      <Seam style={{ alignSelf: 'stretch' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TeamBadge team={team} size={44} />
        <Txt display weight={700} size={24}>{team.name}</Txt>
      </View>
      <Txt tone="muted" size={14}>{team.isUser ? 'You won the league. Take a lap of honour. 🏆' : `${team.owner} lifts the trophy.`}</Txt>
    </View>
  )
}

function Carousel({ ms, index, onIndex }: { ms: Matchup[]; index: number; onIndex: (i: number) => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const league = useGameLeague()!
  const screen = useWindowDimensions().width
  const width = screen - 32
  const glass = usePrefs((p) => p.glassMatchup)
  const liquid = usePrefs((p) => p.liquidSwipe) && glass && canLiquid
  // glass: pages span the screen with the card inset in each, so cards keep their edges and glow while swiping
  const page = glass ? screen : width
  const label = (m: Matchup) => (m.a === ME || m.b === ME ? 'Your matchup' : m.label ?? `${league.teams[m.a].name} v ${league.teams[m.b].name}`)
  const pager = ms.length > 1 && (
    <>
      <Txt tone={glass ? 'text' : 'muted'} size={13} weight={600} numberOfLines={1}>{label(ms[index])}</Txt>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {ms.map((_, i) => (
          <View key={i} style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? t.c.accent : alpha(t.c.tint, 0.2) }} />
        ))}
      </View>
    </>
  )
  return (
    <View style={{ gap: glass ? 14 : 8 }}>
      {liquid ? (
        <LiquidPager count={ms.length} index={index} radius={t.r.lg} onIndex={onIndex}>
          {(i, w) => <Scoreboard m={ms[i]} width={w} bare />}
        </LiquidPager>
      ) : (
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: index * page, y: 0 }}
        onMomentumScrollEnd={(e) => onIndex(Math.round(e.nativeEvent.contentOffset.x / page))}
        style={glass ? s.pagerFull : { borderRadius: t.r.lg }}
        contentContainerStyle={glass ? { paddingVertical: 24 } : undefined}
      >
        {ms.map((m, i) => glass
          ? <View key={i} style={{ width: page, paddingHorizontal: 16 }}><Scoreboard m={m} width={width} /></View>
          : <Scoreboard key={i} m={m} width={width} />)}
      </ScrollView>
      )}
      {pager && (glass ? <Glass radius={22} style={s.pagerGlass}>{pager}</Glass> : <View style={{ alignItems: 'center', gap: 5 }}>{pager}</View>)}
    </View>
  )
}

/** keep your team on the left */
const oriented = (m: Matchup): Matchup => (m.b === ME ? { ...m, a: m.b, b: m.a } : m)

/** `bare`: only the content and colour wash, for a card that `LiquidPager` provides */
function Scoreboard({ m: raw, width, bare }: { m: Matchup; width: number; bare?: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const m = oriented(raw)
  const d = getData()
  const league = useGameLeague()!
  const week = m.week
  const res = league.results[week]
  const final = !!res
  const live = !final && week === currentWeek(d, league) && (league.replayMatch != null || league.played > d.gameweeks[week - 1].mis[0])
  const simulation = useMatchupSimulation()
  let sa = liveTeamScore(d, league, m.a, week)
  let sb = liveTeamScore(d, league, m.b, week)
  if (simulation?.m && week === simulation.m.gw) {
    sa = simulatedTeamScore(d, league, m.a, week, simulation.m, simulation.scores)
    sb = simulatedTeamScore(d, league, m.b, week, simulation.m, simulation.scores)
  }
  if (res) {
    sa.proj = res.proj[m.a]
    sb.proj = res.proj[m.b]
  }
  const mis = d.gameweeks[week - 1].mis
  const remainingShare = final ? 0 : mis.filter((mi) => mi >= league.played).length / mis.length
  const pA = final ? (sa.score > sb.score ? 1 : sa.score < sb.score ? 0 : 0.5) : winProbability(sa.proj, sb.proj, sa.score, sb.score, remainingShare)
  const winner = final ? matchupWinner(league, m) : null
  const glass = usePrefs((p) => p.glassMatchup)
  const side = (id: number, mine: typeof sa, other: typeof sa, right: boolean) => {
    const team = league.teams[id]
    return (
      <View style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start', gap: 2 }}>
        <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <TeamBadge team={team} size={30} />
          <View style={{ flexShrink: 1, alignItems: right ? 'flex-end' : 'flex-start' }}>
            <Txt display weight={700} size={14.5} numberOfLines={1}>{team.name}</Txt>
            <Txt tone="dim" size={11.5}>{team.isUser ? 'You' : team.owner.replace('AI · ', '')} · {recordOf(league, id)}</Txt>
          </View>
        </View>
        <Txt num weight={700} size={34} style={{ color: t.c.hi, marginTop: 6, lineHeight: 38 }}>{fmt(mine.score)}</Txt>
        <Txt tone="dim" size={12}>Proj {fmt(mine.proj, 1)}</Txt>
      </View>
    )
  }
  const body = (
    <>
      {m.label && <Chip label={m.label.toUpperCase()} tone="gold" />}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {side(m.a, sa, sb, false)}
        {side(m.b, sb, sa, true)}
      </View>
      <View style={{ gap: 5 }}>
        <Meter value={pA} height={4} color={t.team(league.teams[m.a].color)} rest={t.team(league.teams[m.b].color)} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt num size={12.5} style={{ flex: 1 }}>{Math.round(pA * 100)}%</Txt>
          {winner !== null ? (
            <Chip label={league.teams[winner].isUser ? 'YOU WIN' : 'FINAL'} tone={league.teams[winner].isUser ? 'gold' : 'neutral'} icon={league.teams[winner].isUser ? 'crown.fill' : undefined} />
          ) : (
            <Chip label={final ? 'FINAL' : live ? 'LIVE' : 'UPCOMING'} tone={live ? 'live' : 'neutral'} />
          )}
          <Txt num size={12.5} style={{ flex: 1, textAlign: 'right' }}>{Math.round((1 - pA) * 100)}%</Txt>
        </View>
      </View>
    </>
  )
  if (!glass) return <View style={[s.board, { width }]}>{body}</View>
  // each team's colour washes in from its own side, under the glass, and glows out from that side of the card
  const [ca, cb] = [t.team(league.teams[m.a].color), t.team(league.teams[m.b].color)]
  if (bare) {
    return (
      <View style={[s.boardGlass, { width }]}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: t.r.lg, experimental_backgroundImage: sideWash(ca, cb, 0.35) }]} />
        {body}
      </View>
    )
  }
  const glow = `-5px 0 22px ${alpha(ca, 0.35)}, 5px 0 22px ${alpha(cb, 0.35)}`
  return <Glass radius={t.r.lg} wash={sideWash(ca, cb, 0.45)} style={[s.boardGlass, { width, boxShadow: glow }]}>{body}</Glass>
}

function Lineups({ m: raw }: { m: Matchup }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const m = oriented(raw)
  const league = useGameLeague()!
  const week = m.week
  const final = !!league.results[week]
  const played = final ? Infinity : league.played
  const stA = teamStarters(league, m.a, week)
  const stB = teamStarters(league, m.b, week)
  const bench = (teamId: number, st: (number | null)[]) => league.teams[teamId].roster.filter((p) => !st.includes(p))
  const bA = bench(m.a, stA)
  const bB = bench(m.b, stB)
  const editable = m.a === ME && league.phase === 'season' && week === currentWeek(getData(), league) && !final
  const glass = usePrefs((p) => p.glassMatchup)
  const Slot = glass ? GlassSlotBadge : SlotBadge
  // glass: each player's IPL colour comes in from his own side of the row, under the glass
  const colour = (pid: number | null) => {
    const p = pid === null ? null : d.players[pid]
    const team = p && d.teams[p.team || p.profileTeam || '']
    return team ? t.team(team.color) : null
  }
  const row = (key: string, slot: string, a: number | null, b: number | null, dim = false, i?: number) => (
    <View key={key} style={[s.mrow, dim && { opacity: 0.7 }]}>
      <Cell teamId={m.a} pid={a} week={week} played={played} right={false} />
      <Pressable
        style={{ width: 50, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        disabled={!editable || i === undefined}
        accessibilityRole="button"
        accessibilityLabel={`Swap your ${slot} player`}
        accessibilityState={{ disabled: !editable || i === undefined }}
        onPress={() => { if (i !== undefined) nav.swap(i, week, a) }}
      ><Slot slot={slot} /></Pressable>
      <Cell teamId={m.b} pid={b} week={week} played={played} right />
    </View>
  )
  type RowArgs = readonly [string, string, number | null, number | null, boolean, number | undefined]
  const group = (title: string, rows: RowArgs[]) => glass ? (
    <GlassSection title={title} inset={0} washes={rows.map(([, , a, b]) => sideWash(colour(a), colour(b), 0.2, 30))}>
      {rows.map((r) => row(...r))}
    </GlassSection>
  ) : (
    <Section title={title} inset={0}>{rows.map((r) => row(...r))}</Section>
  )
  return (
    <>
      {group('Starting XI', SLOTS.map((slot, i) => [`s${i}`, slot, stA[i], stB[i], false, i] as const))}
      {group('Bench', Array.from({ length: Math.max(bA.length, bB.length) }, (_, i) => [`b${i}`, 'BN', bA[i] ?? null, bB[i] ?? null, true, undefined] as const))}
    </>
  )
}

function Cell({ teamId, pid, week, played, right }: { teamId: number; pid: number | null; week: number; played: number; right: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const league = useGameLeague()!
  const simulation = useMatchupSimulation()
  const wp = pid === null ? null : playerWeek(d, league, teamId, pid, week, played)
  // Reconstruct the original forecast using only history available before this fixture.
  const mi = wp?.mi ?? null
  const baseline = useMemo(() => pid === null || mi === null ? null : matchProjection(d, d.players[pid], mi, mi).total, [d, pid, mi])
  if (pid === null || wp === null) {
    return <View style={[s.cell, right && s.cellR]}><Txt tone="dim" size={13} style={{ fontStyle: 'italic' }}>Empty</Txt></View>
  }
  const p = d.players[pid]
  const locked = !league.results[week] && week === currentWeek(d, league) && slotLocked(d, league, teamId, pid, week)
  const active = simulation?.m && week === simulation.m.gw && wp.mi === simulation.m.mi ? simulation.scores.get(pid) : undefined
  const completed = mi !== null && mi < played
  const projection = active?.projection ?? (completed ? baseline : wp.remaining > 0 ? wp.total : null)
  const delta = active ? active.projection - active.baseline : 0
  const projectionTone = !active || Math.abs(delta) < 0.5 ? 'dim' : delta > 0 ? 'win' : 'loss'
  const liveLine = active ? simulation?.st?.lines.get(pid) : undefined
  const summary = active ? liveLine ? [liveLine.batted ? `${liveLine.r} (${liveLine.b})` : '', liveLine.bb ? `${liveLine.w}/${liveLine.rc}` : ''].filter(Boolean).join(' · ') || 'Yet to contribute' : 'Yet to contribute' : weekSummary(d, p, wp.mi, played)
  const offRoster = !league.results[week] && isOffRoster(league, teamId, pid)
  return (
    <PlayerLink pid={pid} style={{ flex: 1 }}>
      <View style={[s.cell, right && s.cellR]}>
        <PlayerAvatar p={p} size={30} />
        <View style={{ flex: 1, minWidth: 0, gap: 3, alignItems: right ? 'flex-end' : 'flex-start' }}>
          <Txt weight={600} size={13} numberOfLines={1}>{p.name}</Txt>
          <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
            <MatchBalls d={d} p={p} week={week} played={played} counted={wp.mi} />
            {locked && <Icon name="lock.fill" size={9} color={t.c.dim} />}
          </View>
          <Txt tone="dim" size={10.5} numberOfLines={1}>
            {/* traded away after playing: his points still count for this team this week */}
            {offRoster && <Txt size={10.5} weight={700} tone="gold">Off roster · </Txt>}
            {summary}
          </Txt>
        </View>
        <View style={{ alignItems: right ? 'flex-start' : 'flex-end', minWidth: 34 }}>
          <Txt num weight={700} size={16} tone="text">{fmt(active?.points ?? wp.banked)}</Txt>
          {projection !== null && <Txt num tone={projectionTone} size={10.5}>{fmt(projection, 1)}</Txt>}
        </View>
      </View>
    </PlayerLink>
  )
}

const styles = (t: Theme) => ({
  board: { paddingHorizontal: 16, paddingVertical: 13, gap: 10, backgroundColor: t.c.feature, borderRadius: t.r.lg },
  boardGlass: { paddingHorizontal: 16, paddingVertical: 13, gap: 10 },
  // full-bleed pager; the vertical padding (taken back by the margin) leaves room for the cards' glow
  pagerFull: { marginHorizontal: -16, marginVertical: -24 },
  pagerGlass: { alignSelf: 'center' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 22, paddingVertical: 9, maxWidth: '100%' as const },
  mrow: { flexDirection: 'row' as const, alignItems: 'center' as const, minHeight: 58 },
  cell: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, paddingVertical: 7, paddingHorizontal: 10 },
  cellR: { flexDirection: 'row-reverse' as const },
})
