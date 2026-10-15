import { Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import {
  currentWeek, isOffRoster, LAST_WEEK, matchupsForWeek, matchupWinner, playerWeek, REG_WEEKS, slotLocked, SLOTS, winProbability,
  type League, type Matchup,
} from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { fmtDate, weekLabel } from '@shared/ui/format'
import { liveTeamScore, teamStarters, weekRecap, weekSummary } from '@shared/ui/helpers'
import { useGameLeague } from '@/data/gameLeague'
import { WeekPills } from '@/components/WeekPills'
import { recordOf } from '@/data/derived'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import {
  Button, Chip, EmptyState, Icon, MatchBalls, Meter, PlayerAvatar, PlayerLink, Screen, Seam, Section, SlotBadge,
  TeamBadge, Txt, useSettingsButton, useNextMatchMenu, useTabTitle,
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
  const next = useNextMatchMenu()
  const headerItems = useMemo(() => () => (next ? [next, ...settings()] : settings()), [next, settings])
  const title = useTabTitle(weekLabel(week))
  const playedIn = g.mis.filter((mi) => mi < league.played).length

  return (
    <>
      <Stack.Screen options={{ ...title, unstable_headerRightItems: headerItems }} />
      <Screen gap={14}>
        <View style={{ gap: 12 }}>
          <Txt tone="muted" size={14}>
            {fmtDate(g.start, false)} – {fmtDate(g.end, false)} · {week === cur && league.phase === 'season' ? `${playedIn} of ${g.mis.length} IPL matches played` : `${g.mis.length} IPL matches`}
          </Txt>
          <WeekPills league={league} week={week} onChange={(w) => { setViewWeek(w); setPicked({ week: w, i: 0 }) }} />
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
    </>
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
  const league = useGameLeague()!
  const width = useWindowDimensions().width - 32
  const label = (m: Matchup) => (m.a === ME || m.b === ME ? 'Your matchup' : m.label ?? `${league.teams[m.a].name} v ${league.teams[m.b].name}`)
  return (
    <View style={{ gap: 8 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: index * width, y: 0 }}
        onMomentumScrollEnd={(e) => onIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ borderRadius: t.r.lg }}
      >
        {ms.map((m, i) => <Scoreboard key={i} m={m} width={width} />)}
      </ScrollView>
      {ms.length > 1 && (
        <View style={{ alignItems: 'center', gap: 5 }}>
          <Txt tone="muted" size={13} weight={600} numberOfLines={1}>{label(ms[index])}</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {ms.map((_, i) => (
              <View key={i} style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? t.c.accent : alpha(t.c.tint, 0.2) }} />
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

/** keep your team on the left */
const oriented = (m: Matchup): Matchup => (m.b === ME ? { ...m, a: m.b, b: m.a } : m)

function Scoreboard({ m: raw, width }: { m: Matchup; width: number }) {
  const t = useTheme()
  const s = useStyles(styles)
  const m = oriented(raw)
  const d = getData()
  const league = useGameLeague()!
  const week = m.week
  const res = league.results[week]
  const final = !!res
  const live = !final && week === currentWeek(d, league) && league.played > d.gameweeks[week - 1].mis[0]
  const sa = liveTeamScore(d, league, m.a, week)
  const sb = liveTeamScore(d, league, m.b, week)
  if (res) {
    sa.proj = res.proj[m.a]
    sb.proj = res.proj[m.b]
  }
  const mis = d.gameweeks[week - 1].mis
  const remainingShare = final ? 0 : mis.filter((mi) => mi >= league.played).length / mis.length
  const pA = final ? (sa.score > sb.score ? 1 : sa.score < sb.score ? 0 : 0.5) : winProbability(sa.proj, sb.proj, sa.score, sb.score, remainingShare)
  const winner = final ? matchupWinner(league, m) : null
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
        <Txt num weight={700} size={34} style={{ color: mine.score > other.score ? t.c.accent : t.c.hi, marginTop: 6, lineHeight: 38 }}>{fmt(mine.score)}</Txt>
        <Txt tone="dim" size={12}>Proj {fmt(mine.proj, 1)}</Txt>
      </View>
    )
  }
  return (
    <View style={[s.board, { width }]}>
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
    </View>
  )
}

function Lineups({ m: raw }: { m: Matchup }) {
  const s = useStyles(styles)
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
      ><SlotBadge slot={slot} /></Pressable>
      <Cell teamId={m.b} pid={b} week={week} played={played} right />
    </View>
  )
  return (
    <>
      <Section title="Starting XI" inset={0}>
        {SLOTS.map((slot, i) => row(`s${i}`, slot, stA[i], stB[i], false, i))}
      </Section>
      <Section title="Bench" inset={0}>
        {Array.from({ length: Math.max(bA.length, bB.length) }, (_, i) => row(`b${i}`, 'BN', bA[i] ?? null, bB[i] ?? null, true))}
      </Section>
    </>
  )
}

function Cell({ teamId, pid, week, played, right }: { teamId: number; pid: number | null; week: number; played: number; right: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const league = useGameLeague()!
  if (pid === null) {
    return <View style={[s.cell, right && s.cellR]}><Txt tone="dim" size={13} style={{ fontStyle: 'italic' }}>Empty</Txt></View>
  }
  const p = d.players[pid]
  const wp = playerWeek(d, league, teamId, pid, week, played)
  const locked = !league.results[week] && week === currentWeek(d, league) && slotLocked(d, league, teamId, pid, week)
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
            {weekSummary(d, p, wp.mi, played)}
          </Txt>
        </View>
        <View style={{ alignItems: right ? 'flex-start' : 'flex-end', minWidth: 34 }}>
          <Txt num weight={700} size={16} style={{ color: wp.banked >= 25 ? t.c.accent : t.c.text }}>{fmt(wp.banked)}</Txt>
          {wp.remaining > 0 && <Txt num tone="dim" size={10.5}>{fmt(wp.total, 1)}</Txt>}
        </View>
      </View>
    </PlayerLink>
  )
}

const styles = (t: Theme) => ({
  board: { paddingHorizontal: 16, paddingVertical: 13, gap: 10, backgroundColor: t.c.feature, borderRadius: t.r.lg },
  mrow: { flexDirection: 'row' as const, alignItems: 'center' as const, minHeight: 58 },
  cell: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, paddingVertical: 7, paddingHorizontal: 10 },
  cellR: { flexDirection: 'row-reverse' as const },
})
