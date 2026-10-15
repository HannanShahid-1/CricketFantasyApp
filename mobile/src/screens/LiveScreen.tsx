import { useIsFocused, useLocalSearchParams } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Match } from '@shared/engine/data'
import { userMatchup, type Matchup } from '@shared/engine/league'
import { fmt, oversStr, type StatLine } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { fmtDate, weekLabel } from '@shared/ui/format'
import {
  fantasyTracker, isNextMatch, liveMatchupScore, REPLAY_SPEEDS, replayState, resultToast, type ReplayState, type TrackedPlayer,
} from '@shared/ui/replay'
import { ballEvents, runRate, type BallEvent } from '@shared/ui/scorecard'
import { useGameLeague } from '@/data/gameLeague'
import { BallChip, FlashNum, LiveBadge, TeamMark } from '@/components/match/parts'
import { ownersOf } from '@/data/derived'
import { intParam, nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, Chip, EmptyState, haptic, Icon, PlayerAvatar, PlayerLink, Section, Segmented, TeamBadge, TeamTag, Txt } from '@/ui'

// Ball-by-ball replay of a real IPL match, full screen. Watching the next unplayed match is playing it: closing the
// replay (finished or not) records the match in the league, like the web. Replays of played matches change nothing.
// One interval advances `k` (balls bowled); everything on screen is derived from it by the shared `replayState`.

/** shortest timer tick: the fastest speed advances a few balls per tick instead of re-rendering every 22ms */
const MIN_TICK_MS = 60
const FASTEST = REPLAY_SPEEDS.length - 1
const SPEED_OPTIONS = REPLAY_SPEEDS.map((s, i) => ({ key: String(i), label: s.label }))
type Pane = 'comm' | 'fantasy'

export function LiveScreen() {
  const mi = intParam(useLocalSearchParams<{ mi: string }>().mi)
  const league = useGameLeague()
  const m = getData().matches[mi]
  // a match that hasn't started can't be watched yet: its result would leak
  if (!m || !league || mi > league.played) return <Unavailable />
  return <Replay m={m} />
}

function Unavailable() {
  const insets = useSafeAreaInsets()
  const t = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + 6, paddingHorizontal: 16 }}>
      <Button icon="xmark" onPress={nav.close} accessibilityLabel="Close" />
      <EmptyState icon="clock" title="Not started yet" message="You can watch this match once the matches before it have been played." />
    </View>
  )
}

function Replay({ m }: { m: Match }) {
  const d = getData()
  const s = useStyles(styles)
  const insets = useSafeAreaInsets()
  const league = useGameLeague()!
  // decided when the screen opens, so the screen doesn't change while it closes and the match is recorded
  const [live] = useState(() => isNextMatch(league, m.mi))
  const evs = useMemo(() => ballEvents(d, m.raw), [d, m])
  const total = evs.length
  const [k, setK] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [pane, setPane] = useState<Pane>('comm')
  const focused = useIsFocused()
  const finished = k >= total

  // the one timer: stops while paused, finished, or covered by a player card
  useEffect(() => {
    if (!playing || finished || !focused) return
    const { ms } = REPLAY_SPEEDS[speed]
    const step = Math.max(1, Math.round(MIN_TICK_MS / ms))
    const id = setInterval(() => setK((x) => Math.min(total, x + step)), ms * step)
    return () => clearInterval(id)
  }, [playing, finished, focused, speed, total])

  // haptics for the ball just bowled: a tap for a boundary, a thud for a wicket, a success at full time
  // (not at 20×, and not when skipping to the end)
  const prevK = useRef(0)
  useEffect(() => {
    const from = prevK.current
    prevK.current = k
    if (k <= from || k - from > 1 || speed === FASTEST) return
    const cls = evs[k - 1].cls
    if (k === total) haptic.success()
    else if (cls === 'bw') haptic.heavy()
    else if (cls === 'b4' || cls === 'b6') haptic.tap()
  }, [k, total, speed, evs])

  const st = useMemo(() => replayState(d, m, evs, k), [d, m, evs, k])
  const rostered = useMemo(() => [...m.xi].filter((p) => ownersOf(league).has(p)).length, [m, league])

  const closing = useRef(false)
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const { league: l, simMatch, notify } = useApp.getState()
    if (live && l && isNextMatch(l, m.mi)) {
      simMatch()
      notify(resultToast(m), 'info')
    }
    nav.close()
  }, [live, m])
  const toggle = useCallback(() => setPlaying((p) => !p), [])
  const toEnd = useCallback(() => setK(total), [total])
  const restart = useCallback(() => {
    setK(0)
    setPlaying(true)
  }, [])

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <TopBar m={m} live={live} finished={finished} playing={playing} onClose={close} />
      <View style={s.head}>
        <Scorebug m={m} st={st} progress={total ? k / total : 0} />
        <PaneSwitch pane={pane} rostered={rostered} onChange={setPane} />
      </View>
      <View style={{ flex: 1 }}>
        {pane === 'comm' ? <Commentary m={m} evs={evs} k={k} /> : <FantasyPane m={m} lines={st.lines} live={live} />}
      </View>
      <Transport
        bottom={insets.bottom}
        live={live}
        finished={finished}
        playing={playing}
        speed={speed}
        onToggle={toggle}
        onSpeed={setSpeed}
        onEnd={toEnd}
        onRestart={restart}
        onClose={close}
      />
    </View>
  )
}

const TopBar = memo(function TopBar({ m, live, finished, playing, onClose }: {
  m: Match; live: boolean; finished: boolean; playing: boolean; onClose: () => void
}) {
  const s = useStyles(styles)
  return (
    <View style={s.top}>
      <View style={s.topSide}>
        <Button icon="xmark" onPress={onClose} accessibilityLabel={live ? 'Close and record the match' : 'Close'} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
        <Txt display weight={700} size={17} numberOfLines={1}>{m.teams[0]} v {m.teams[1]}</Txt>
        <Txt size={12} tone="dim" numberOfLines={1}>{m.raw.num ? `Match ${m.raw.num}` : (m.raw.stage ?? 'Playoff')} · {fmtDate(m.raw.date)}</Txt>
      </View>
      <View style={[s.topSide, { alignItems: 'flex-end' }]}>
        {finished ? <Chip label="FULL TIME" /> : live ? <LiveBadge pulsing={playing} /> : <Chip label="REPLAY" tone="sky" icon="arrow.counterclockwise" />}
      </View>
    </View>
  )
})

/** Commentary or fantasy tracker; memoised so the native control isn't updated on every ball. */
const PaneSwitch = memo(function PaneSwitch({ pane, rostered, onChange }: { pane: Pane; rostered: number; onChange: (p: Pane) => void }) {
  const options = useMemo(
    () => [{ key: 'comm' as const, label: 'Commentary' }, { key: 'fantasy' as const, label: rostered ? `Fantasy · ${rostered}` : 'Fantasy' }],
    [rostered],
  )
  return <Segmented options={options} value={pane} onChange={onChange} />
})

/** The broadcast score header: both innings, the chase, progress, this over and who's at the crease. */
const Scorebug = memo(function Scorebug({ m, st, progress }: { m: Match; st: ReplayState; progress: number }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const name = (p: number) => d.players[p].name
  const side = (code: string, right: boolean) => {
    const inn = st.inns.find((x) => x.team === code)
    const batting = !st.finished && st.cur?.team === code
    return (
      <View style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start', gap: 3 }}>
        <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 7 }}>
          <TeamMark code={code} />
          {batting && <Icon name="figure.cricket" size={14} color={t.c.live2} />}
        </View>
        <Txt num weight={700} size={38} tone={inn ? 'hi' : 'dim'} style={{ marginTop: 4 }}>
          {inn ? <>{inn.runs}<Txt num weight={600} size={20} tone="muted">/{inn.wkts}</Txt></> : '–'}
        </Txt>
        <Txt size={12.5} tone="dim">{inn ? `${oversStr(inn.balls)} ov` : 'Yet to bat'}</Txt>
      </View>
    )
  }

  let status
  if (st.finished) status = <Txt size={14} weight={600} tone="accent" style={s.center}>{m.raw.result}</Txt>
  else if (st.chase && st.cur) {
    status = (
      <Txt size={13.5} tone="muted" style={s.center}>
        {st.cur.team} need <Txt size={13.5} weight={700} tone="accent">{st.chase.need}</Txt> off {st.chase.balls} balls
        <Txt size={13.5} tone="dim">{'  ·  '}RRR {st.chase.rrr}</Txt>
      </Txt>
    )
  } else if (st.cur) status = <Txt size={13.5} tone="muted" style={s.center}>Run rate {runRate(st.cur.runs, st.cur.balls)}</Txt>
  else status = <Txt size={13.5} tone="muted" style={s.center}>{m.raw.innings[0]?.team ?? m.teams[0]} to bat · {m.raw.venue}</Txt>

  const over = st.last ? Number(st.last.label.split('.')[0]) + 1 : 1
  const bowler = st.last && st.lines.get(st.last.bowler)
  const pom = m.raw.pom.map(name).join(', ')
  return (
    <View style={s.bug}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {side(m.teams[0], false)}
        {side(m.teams[1], true)}
      </View>
      {status}
      <View style={s.track}>
        <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: t.c.live, borderRadius: 2 }} />
      </View>
      {!st.finished ? (
        <>
          <View style={s.overRow}>
            <Txt up size={10.5} weight={600} tone="dim" style={{ width: 54 }}>Over {over}</Txt>
            {st.over.map((e, i) => <BallChip key={st.overStart + i} e={e} size={28} pop={i === st.over.length - 1} />)}
          </View>
          <View style={s.crease}>
            <View style={{ flex: 1, gap: 4 }}>
              {st.batters.map((p) => <Crease key={p} icon="figure.cricket" name={name(p)} figures={batFigures(st.lines.get(p))} />)}
            </View>
            {st.last && (
              <View style={{ flex: 0.85, gap: 4 }}>
                <Crease icon="cricket.ball" name={name(st.last.bowler)} figures={bowler ? `${bowler.w}/${bowler.rc} (${oversStr(bowler.bb)})` : ''} />
              </View>
            )}
          </View>
        </>
      ) : pom ? (
        <View style={[s.crease, { alignItems: 'center' }]}>
          <Icon name="star.fill" size={13} color={t.c.gold} />
          <Txt size={13.5} tone="muted" numberOfLines={1} style={{ flex: 1 }}>Player of the match: <Txt size={13.5} weight={600}>{pom}</Txt></Txt>
        </View>
      ) : null}
    </View>
  )
})

const batFigures = (l: StatLine | undefined) => `${l?.r ?? 0} (${l?.b ?? 0})`

function Crease({ icon, name, figures }: { icon: 'figure.cricket' | 'cricket.ball'; name: string; figures: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={12} />
      <Txt size={13.5} weight={600} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Txt>
      <Txt num size={13.5} tone="muted">{figures}</Txt>
    </View>
  )
}

/** Ball-by-ball commentary, newest first. Stays put while you read further down; follows the play at the top. */
const Commentary = memo(function Commentary({ m, evs, k }: { m: Match; evs: BallEvent[]; k: number }) {
  const s = useStyles(styles)
  const data = useMemo(() => Array.from({ length: k }, (_, i) => k - 1 - i), [k])
  const breakText = `Innings break · ${m.raw.innings[1]?.team ?? ''} need ${(m.totals[0]?.runs ?? 0) + 1} to win`
  // at the top, new balls push the list down so the latest stays in view; once you scroll down to read, the list holds
  // your place instead (maintainVisibleContentPosition's own autoscrollToTopThreshold doesn't fire on iOS)
  const [follow, setFollow] = useState(true)
  const settle = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => setFollow(e.nativeEvent.contentOffset.y < 40), [])
  const renderItem = useCallback(
    ({ item: i }: { item: number }) => {
      const brk = i > 0 && evs[i].inn !== evs[i - 1].inn ? (evs[i].inn === 1 ? breakText : 'Super over') : undefined
      return <CommentaryRow e={evs[i]} brk={brk} />
    },
    [evs, breakText],
  )
  if (!k) return <EmptyState icon="cricket.ball" title="First ball coming up" message={m.raw.venue} />
  return (
    <FlatList
      data={data}
      keyExtractor={ballKey}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      // each new ball goes in at the top and shifts every mounted row, so keep only the rows near the screen mounted
      // (the default keeps ~20 screens' worth: by the second innings that's the whole match, re-checked on every ball)
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={3}
      maintainVisibleContentPosition={follow ? undefined : HOLD_PLACE}
      onScrollEndDrag={settle}
      onMomentumScrollEnd={settle}
      contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
      style={s.fill}
    />
  )
})

const HOLD_PLACE = { minIndexForVisible: 0 }
const ballKey = (i: number) => String(i)

function Separator() {
  const s = useStyles(styles)
  return <View style={s.sep} />
}

const CommentaryRow = memo(function CommentaryRow({ e, brk }: { e: BallEvent; brk?: string }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const big = e.cls === 'bw' || e.cls === 'b4' || e.cls === 'b6'
  return (
    <View>
      <View style={[s.comm, e.cls === 'bw' ? { backgroundColor: alpha(t.c.live, 0.1) } : big && { backgroundColor: alpha(t.c.accent, 0.05) }]}>
        <Txt num size={13} tone="dim" style={{ width: 34, textAlign: 'right' }}>{e.label}</Txt>
        <BallChip e={e} size={28} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt size={12.5} tone="muted" numberOfLines={1}>{d.players[e.bowler].name} to {d.players[e.batter].name}</Txt>
          <Txt size={14.5} weight={big ? 700 : 500} tone={e.cls === 'bw' ? 'live' : 'text'}>{e.desc}</Txt>
        </View>
      </View>
      {brk ? (
        <View style={s.brk}>
          <Icon name="pause.circle" size={13} color={t.c.gold} />
          <Txt size={12.5} weight={600} tone="gold">{brk}</Txt>
        </View>
      ) : null}
    </View>
  )
})

/** Rostered players in this match with live points, under your matchup's live score. */
const FantasyPane = memo(function FantasyPane({ m, lines, live }: { m: Match; lines: Map<number, StatLine>; live: boolean }) {
  const d = getData()
  const league = useGameLeague()!
  const rows = fantasyTracker(d, league, m, lines, ownersOf(league))
  const um = live ? userMatchup(league, m.gw) : undefined
  return (
    <View style={{ flex: 1 }}>
      {um && <MatchupBar um={um} m={m} lines={lines} />}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {rows.length ? (
          <Section
            title="Rostered players in this match"
            inset={64}
            footer="Only one match per player counts each week. Points that won't count are dimmed."
          >
            {rows.map((r) => <TrackerRow key={r.p} {...r} />)}
          </Section>
        ) : (
          <EmptyState icon="person.2" title="No rostered players" message="Nobody in your league has a player in this match." />
        )}
      </ScrollView>
    </View>
  )
})

function MatchupBar({ um, m, lines }: { um: Matchup; m: Match; lines: Map<number, StatLine> }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const league = useGameLeague()!
  const me = league.teams[um.a === ME ? um.a : um.b]
  const opp = league.teams[um.a === ME ? um.b : um.a]
  const a = liveMatchupScore(d, league, me.id, m, lines)
  const b = liveMatchupScore(d, league, opp.id, m, lines)
  return (
    <View style={s.mbar}>
      <TeamBadge team={me} size={32} />
      <View style={{ gap: 1 }}>
        <Txt up size={10} weight={600} tone="dim">You</Txt>
        <FlashNum value={fmt(a)} size={22} align="left" color={a > b ? t.c.accent : t.c.hi} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <Txt up size={10} weight={600} tone="dim">Your matchup</Txt>
        <Txt size={12.5} tone="muted" numberOfLines={1}>{um.label ?? weekLabel(um.week)}</Txt>
      </View>
      <View style={{ gap: 1, alignItems: 'flex-end', maxWidth: 110 }}>
        <Txt up size={10} weight={600} tone="dim" numberOfLines={1}>{opp.name}</Txt>
        <FlashNum value={fmt(b)} size={22} color={b > a ? t.c.accent : t.c.hi} />
      </View>
      <TeamBadge team={opp} size={32} />
    </View>
  )
}

const TrackerRow = memo(function TrackerRow({ p, owner, pts, starter, counts }: TrackedPlayer) {
  const t = useTheme()
  const s = useStyles(styles)
  const pl = getData().players[p]
  const team = useGameLeague()!.teams[owner]
  const mine = owner === ME
  const note = !starter ? 'Bench' : !counts ? 'Not counted' : null
  return (
    <PlayerLink pid={p}>
      <View style={[s.trow, mine && { backgroundColor: alpha(t.c.accent, 0.06) }]}>
        <PlayerAvatar p={pl} size={36} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Txt size={15} weight={600} numberOfLines={1}>{pl.name}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TeamTag code={pl.team} />
            <Txt size={12} weight={mine ? 600 : 400} tone={mine ? 'accent' : 'muted'} numberOfLines={1} style={{ flexShrink: 1 }}>
              {mine ? 'You' : team.name}
              {note && <Txt size={12} tone="dim">{` · ${note}`}</Txt>}
            </Txt>
          </View>
        </View>
        <TeamBadge team={team} size={22} />
        <FlashNum value={fmt(pts)} size={18} color={pts >= 25 ? t.c.accent : t.c.text} dim={note !== null} style={{ minWidth: 48 }} />
      </View>
    </PlayerLink>
  )
})

/** Playback: play/pause, speed, skip to the end; at full time, watch again or close. */
const Transport = memo(function Transport({ bottom, live, finished, playing, speed, onToggle, onSpeed, onEnd, onRestart, onClose }: {
  bottom: number; live: boolean; finished: boolean; playing: boolean; speed: number
  onToggle: () => void; onSpeed: (i: number) => void; onEnd: () => void; onRestart: () => void; onClose: () => void
}) {
  const s = useStyles(styles)
  return (
    <View style={[s.transport, { paddingBottom: Math.max(bottom, 12) }]}>
      {finished ? (
        <>
          <Button icon="arrow.counterclockwise" size="large" onPress={onRestart} accessibilityLabel="Watch again" style={{ alignSelf: 'auto' }} />
          <Button title={live ? 'Continue season' : 'Done'} icon={live ? 'forward.fill' : undefined} kind="filled" size="large" onPress={onClose} style={{ flex: 1 }} />
        </>
      ) : (
        <>
          <Button icon={playing ? 'pause.fill' : 'play.fill'} onPress={onToggle} accessibilityLabel={playing ? 'Pause' : 'Play'} />
          <Segmented options={SPEED_OPTIONS} value={String(speed)} onChange={(v) => onSpeed(Number(v))} style={{ flex: 1 }} />
          <Button title="End" icon="forward.end.fill" onPress={onEnd} accessibilityLabel="Skip to the result" />
        </>
      )}
    </View>
  )
})

const styles = (t: Theme) => ({
  root: { flex: 1, backgroundColor: t.c.bg },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, height: 52, paddingHorizontal: 16 },
  topSide: { width: 92 },
  head: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 14 },
  bug: { backgroundColor: t.c.panel, borderRadius: t.r.lg, padding: 16, gap: 12 },
  center: { textAlign: 'center' as const },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' as const, backgroundColor: alpha(t.c.tint, 0.1) },
  overRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, gap: 5, minHeight: 28 },
  crease: {
    flexDirection: 'row' as const, gap: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line2,
  },
  fill: { flex: 1 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: t.c.line2, marginLeft: 100 },
  comm: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11, paddingVertical: 10, paddingLeft: 16, paddingRight: 16 },
  brk: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line2, backgroundColor: alpha(t.c.gold, 0.06),
  },
  mbar: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginHorizontal: 16, marginTop: 2, paddingVertical: 10,
    paddingHorizontal: 12, borderRadius: t.r.lg, backgroundColor: t.c.panel, borderWidth: 1, borderColor: alpha(t.c.accent, 0.25),
  },
  trow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 58, paddingVertical: 9, paddingHorizontal: 16 },
  transport: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingTop: 12, paddingHorizontal: 16,
    backgroundColor: t.c.panel, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line2,
  },
})
