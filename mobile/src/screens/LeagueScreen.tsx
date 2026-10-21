import { memo, useCallback, useMemo, useState } from 'react'
import { LayoutAnimation, Pressable, View } from 'react-native'
import { dmChannel } from '@shared/engine/chat'
import {
  currentWeek, managerName, REG_WEEKS, TRADE_DEADLINE_WEEK, type FTeam, type League, type StandingRow,
} from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import { weeklyResults, type WeekCell } from '@shared/ui/weeklyResults'
import { useGameLeague } from '@/data/gameLeague'
import { recordOf, standingsOf } from '@/data/derived'
import { nav } from '@/nav'
import { LeagueMatchups, LeagueActivity, StandingsHeader } from '@/components/league/LeagueOverview'
import { useProfile } from '@/data/profile'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, haptic, Icon, Row, RowIcon, Screen, Section, TeamBadge, Txt, type Tone } from '@/ui'

// League overview: matchups, standings and recent activity. Team details and weekly results stay available.

/** the top four after the regular season play the semifinals */
const PLAYOFF_SPOTS = 4
/** where a standings row's text starts: padding + rank + gap + badge + gap (separators line up with it) */
const TEXT_INSET = 12 + 27 + 6 + 26 + 6

export function LeagueScreen() {
  const t = useTheme()
  const d = getData()
  const league = useGameLeague()!
  const rows = standingsOf(league)
  const [details, setDetails] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const toggle = useCallback((id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    haptic.select()
    setOpen((o) => (o === id ? null : id))
  }, [])
  const cur = currentWeek(d, league)
  const champ = league.champion !== null ? league.teams[league.champion] : null
  const seeded = league.schedule.some((m) => m.week === REG_WEEKS + 1)
  const status = champ ? 'Season complete' : cur <= REG_WEEKS ? `Week ${cur} of ${REG_WEEKS}` : `Playoffs · ${weekLabel(cur)}`
  const standing = (r: StandingRow, rank: number) => (
    <TeamRow key={r.teamId} rank={rank} r={r} open={open === r.teamId} onToggle={toggle} />
  )

  return (
    <Screen gap={16}>
      <Txt tone="muted" size={14}>{league.name} · {league.numTeams} teams · {status}</Txt>
      <LeagueMatchups league={league} rows={rows} />
      {champ && (
        <Section>
          <Row
            left={<RowIcon name="trophy.fill" color={t.c.gold} />}
            title={<Txt display weight={700} size={16} numberOfLines={1}>{champ.name}</Txt>}
            subtitle={champ.isUser ? 'You won the league' : `League champion · ${managerName(champ)}`}
            right={<TeamBadge team={champ} size={30} />}
            chevron
            onPress={() => nav.league('playoffs')}
          />
        </Section>
      )}
      <View style={{ gap: 6 }}>
        <StandingsHeader details={details} onDetails={() => { haptic.select(); setDetails((v) => !v) }} />
        <Section inset={TEXT_INSET}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 7, gap: 6 }}>
            <Txt up size={9} tone="dim" numberOfLines={1} adjustsFontSizeToFit style={{ width: 27 }}>Rank</Txt>
            <Txt up size={9} tone="dim" style={{ flex: 1 }}>Team</Txt>
            {['Waiver', 'PF', 'PA'].map((label) => <Txt key={label} up size={9} tone="dim" style={{ width: 48, textAlign: 'right' }}>{label}</Txt>)}
          </View>
          {rows.map((r, i) => <View key={r.teamId} style={i === PLAYOFF_SPOTS ? { borderTopWidth: 1, borderTopColor: t.c.accent } : undefined}>{standing(r, i + 1)}</View>)}
        </Section>
        {details && <WeeklyResults league={league} rows={rows} />}
      </View>
      <LeagueActivity league={league} />
      <Section title="More" inset={58}>
        <Row
          title="Playoffs"
          left={<RowIcon name="trophy.fill" color={t.c.gold} />}
          value={champ ? 'Complete' : seeded ? 'Underway' : 'Projected'}
          chevron
          onPress={() => nav.league('playoffs')}
        />
        <Row
          title="IPL Fixtures"
          left={<RowIcon name="calendar" color={t.c.sky} />}
          value={`${league.played} of ${d.matches.length} played`}
          chevron
          onPress={() => nav.league('fixtures')}
        />
        <Row
          title="Activity"
          left={<RowIcon name="arrow.left.arrow.right" color={t.c.accent} />}
          value={league.txns.length ? String(league.txns.length) : undefined}
          chevron
          onPress={() => nav.league('activity')}
        />
        <Row
          title="Draft Board"
          left={<RowIcon name="square.grid.3x3.fill" color={t.c.ar} />}
          value={`${league.draft.rounds} rounds`}
          chevron
          onPress={() => nav.league('draft-board')}
        />
        <Row
          title="Scoring"
          left={<RowIcon name="list.number" color={t.c.bowl} />}
          value="Standard"
          chevron
          onPress={() => nav.league('scoring')}
        />
      </Section>
    </Screen>
  )
}

const TeamRow = memo(function TeamRow({ rank, r, open, onToggle }: {
  rank: number; r: StandingRow; open: boolean; onToggle: (teamId: number) => void
}) {
  const s = useStyles(styles)
  const league = useGameLeague()!
  const team = league.teams[r.teamId]
  const username = useProfile((p) => p.profile.username)
  return (
    <View style={team.isUser && s.mine}>
      <Pressable onPress={() => onToggle(team.id)} accessibilityRole="button" accessibilityLabel={`${rank}. ${team.name}, ${recordOf(league, team.id)}. Show team details`} accessibilityState={{ expanded: open }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 }, pressed && { opacity: 0.65 }]}>
        <Txt num weight={700} size={13} tone="muted" style={{ width: 27, textAlign: 'center' }}>{rank}</Txt>
        <TeamBadge team={team} size={26} />
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Txt weight={700} size={12.5} tone={team.isUser ? 'accent' : 'text'} numberOfLines={2}>{team.name}</Txt>
          <Txt size={10} tone="dim" numberOfLines={1}>{team.isUser && username ? `@${username}` : managerName(team)}</Txt>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <Txt num weight={600} size={11} tone="muted">{recordOf(league, team.id)}</Txt>
            {r.streak && <Txt size={10} tone={r.streak.startsWith('W') ? 'win' : 'loss'}>{r.streak.startsWith('W') ? '▲' : '▼'} {r.streak.slice(1)}{r.streak[0]}</Txt>}
          </View>
        </View>
        <View style={{ width: 48, alignItems: 'flex-end', gap: 2 }}>
          <Txt num size={11} tone="muted">${team.faab}</Txt>
          <Txt num size={9} tone="dim">#{league.waiverOrder.indexOf(team.id) + 1}</Txt>
        </View>
        <Txt num size={11} tone="muted" style={{ width: 48, textAlign: 'right' }}>{fmt(r.pf, 1)}</Txt>
        <Txt num size={11} tone="muted" style={{ width: 48, textAlign: 'right' }}>{fmt(r.pa, 1)}</Txt>
      </Pressable>
      {open && <TeamDetail team={team} r={r} />}
    </View>
  )
})

/** A team's full record, plus message/trade for the other managers. */
function TeamDetail({ team, r }: { team: FTeam; r: StandingRow }) {
  const s = useStyles(styles)
  const league = useGameLeague()!
  const closed = league.phase !== 'season' || currentWeek(getData(), league) >= TRADE_DEADLINE_WEEK
  const stats: { label: string; value: string; tone?: Tone }[] = [
    { label: 'H2H', value: `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}` },
    { label: 'vs Median', value: `${r.mw}-${r.ml}` },
    { label: 'Streak', value: r.streak || '–', tone: r.streak.startsWith('W') ? 'win' : r.streak ? 'loss' : 'dim' },
    { label: 'PF', value: fmt(r.pf, 1) },
    { label: 'PA', value: fmt(r.pa, 1) },
    { label: 'FAAB', value: `$${team.faab}` },
  ]
  return (
    <View style={s.detail}>
      <View style={s.stats}>
        {stats.map((x) => (
          <View key={x.label} style={s.stat}>
            <Txt num weight={700} size={16} tone={x.tone ?? 'text'}>{x.value}</Txt>
            <Txt up size={9.5} weight={600} tone="dim" numberOfLines={1}>{x.label}</Txt>
          </View>
        ))}
      </View>
      {!team.isUser && (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Message" icon="bubble.left.fill" size="small" onPress={() => nav.chat(dmChannel(ME, team.id))} style={{ flex: 1 }} />
            <Button title="Trade" icon="arrow.left.arrow.right" size="small" kind="tinted" disabled={closed} onPress={() => nav.trade(team.id)} style={{ flex: 1 }} />
          </View>
          {closed && league.phase === 'season' && (
            <Txt size={12} tone="dim">Trades closed at the start of Week {TRADE_DEADLINE_WEEK}.</Txt>
          )}
        </>
      )}
    </View>
  )
}

/**
 * Every team's regular-season weeks in one compact grid (same order as the standings): a green/red score capsule
 * once played (★ beat the median), the opponent's badge before. Tap a week to open it in Matchup.
 */
function WeeklyResults({ league, rows }: { league: League; rows: StandingRow[] }) {
  const s = useStyles(styles)
  const grid = useMemo(() => weeklyResults(league), [league])
  const cur = currentWeek(getData(), league)
  return (
    <Section title="Weekly results" inset={12} footer="Green won the matchup, red lost. ★ beat the league median. Tap a week to open it.">
      <View style={[s.gridRow, s.gridHead]}>
        <View style={s.teamCol} />
        {Array.from({ length: REG_WEEKS }, (_, i) => i + 1).map((w) => (
          <Pressable key={w} onPress={() => nav.week(w)} hitSlop={8} style={s.weekCol} accessibilityRole="button" accessibilityLabel={`Open ${weekLabel(w)}`}>
            <Txt up size={11} weight={700} tone={w === cur && !league.results[w] ? 'accent' : 'dim'}>W{w}</Txt>
          </Pressable>
        ))}
      </View>
      {rows.map((r) => <ResultsRow key={r.teamId} teams={league.teams} teamId={r.teamId} cells={grid.get(r.teamId)!} />)}
    </Section>
  )
}

const ResultsRow = memo(function ResultsRow({ teams, teamId, cells }: { teams: FTeam[]; teamId: number; cells: WeekCell[] }) {
  const s = useStyles(styles)
  const team = teams[teamId]
  return (
    <View style={[s.gridRow, team.isUser && s.mine]}>
      <View style={s.teamCol}><TeamBadge team={team} size={26} /></View>
      {cells.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => nav.week(i + 1)}
          style={({ pressed }) => [s.weekCol, pressed && { opacity: 0.55 }]}
          accessibilityRole="button"
          accessibilityLabel={`${team.name}, ${weekLabel(i + 1)}: ${c.played ? `${fmt(c.score, 1)}, ${c.outcome}${c.beatMedian ? ', beat the median' : ''}` : 'not played'}`}
        >
          <ResultCell c={c} opp={c.opp !== null ? teams[c.opp] : null} />
        </Pressable>
      ))}
    </View>
  )
})

function ResultCell({ c, opp }: { c: WeekCell; opp: FTeam | null }) {
  const t = useTheme()
  const s = useStyles(styles)
  if (!c.played) {
    if (!opp) return <Txt tone="dim" size={12}>–</Txt>
    return <View style={{ opacity: 0.45 }}><TeamBadge team={opp} size={20} /></View>
  }
  const color = c.outcome === 'win' ? t.c.win : c.outcome === 'loss' ? t.c.loss : t.c.muted
  return (
    <View style={[s.pill, { backgroundColor: alpha(color, 0.15) }]}>
      <Txt num weight={700} size={12} numberOfLines={1} adjustsFontSizeToFit style={{ color }}>{fmt(c.score, 1)}</Txt>
      {c.beatMedian && <Icon name="star.fill" size={9} color={t.c.gold} style={s.star} />}
    </View>
  )
}

const styles = (t: Theme) => ({
  mine: { backgroundColor: alpha(t.c.accent, 0.1) },
  lead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  rank: { width: 20, textAlign: 'center' as const },
  detail: { paddingLeft: TEXT_INSET, paddingRight: 16, paddingBottom: 14, gap: 10 },
  stats: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, rowGap: 10, paddingVertical: 10, borderRadius: t.r.md, backgroundColor: alpha(t.c.tint, 0.05) },
  stat: { width: '33.33%' as const, alignItems: 'center' as const, gap: 2 },
  gridRow: { flexDirection: 'row' as const, alignItems: 'center' as const, height: 44, paddingHorizontal: 12 },
  gridHead: { height: 34 },
  teamCol: { width: 36 },
  weekCol: { flex: 1, height: '100%' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
  pill: { alignSelf: 'stretch' as const, marginHorizontal: 2, height: 26, borderRadius: 7, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 2 },
  star: { position: 'absolute' as const, top: -4, right: -3 },
})
