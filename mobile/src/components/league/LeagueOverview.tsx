import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { currentWeek, LAST_WEEK, managerName, matchupsForWeek, type League, type Matchup, type StandingRow, type Txn } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import { matchupOdds } from '@shared/ui/helpers'
import { simulatedFromBase, teamWeekBase } from '@shared/ui/matchupSimulation'
import { recordOf } from '@/data/derived'
import { useLiveSim } from '@/data/simulation'
import { nav } from '@/nav'
import { alpha, useTheme } from '@/theme/theme'
import { haptic, Icon, PlayerAvatar, PlayerLink, Section, TeamBadge, Txt } from '@/ui'

export function LeagueMatchups({ league, rows }: { league: League; rows: StandingRow[] }) {
  const t = useTheme()
  const [selected, setSelected] = useState<number | null>(null)
  const week = selected ?? currentWeek(getData(), league)
  const matchups = matchupsForWeek(league, week)
  const change = (delta: number) => { haptic.select(); setSelected(week + delta) }
  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt display size={18} weight={700}>Matchups</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Pressable disabled={week <= 1} onPress={() => change(-1)} accessibilityRole="button" accessibilityLabel="Previous matchup week" style={{ padding: 12, opacity: week <= 1 ? 0.25 : 1 }}><Icon name="chevron.left" size={15} color={t.c.accent} /></Pressable>
          <Txt weight={700} size={14} tone="accent">{weekLabel(week)}</Txt>
          <Pressable disabled={week >= LAST_WEEK} onPress={() => change(1)} accessibilityRole="button" accessibilityLabel="Next matchup week" style={{ padding: 12, opacity: week >= LAST_WEEK ? 0.25 : 1 }}><Icon name="chevron.right" size={15} color={t.c.accent} /></Pressable>
        </View>
      </View>
      {matchups.length ? matchups.map((m) => <MatchupCard key={`${week}-${m.a}-${m.b}`} m={m} league={league} rows={rows} />) : (
        <Section><View style={{ padding: 18, gap: 10 }}><Txt size={14} tone="muted">Playoff matchups aren't set yet.</Txt><Pressable onPress={() => nav.league('playoffs')} accessibilityRole="button"><Txt tone="accent" weight={600}>View projected bracket</Txt></Pressable></View></Section>
      )}
    </View>
  )
}

function MatchupCard({ m, league, rows }: { m: Matchup; league: League; rows: StandingRow[] }) {
  const t = useTheme()
  const d = getData()
  const sim = useLiveSim()
  const simMatch = sim.m?.gw === m.week && sim.m.mi === league.replayMatch && sim.m.mi === league.played ? sim.m : null
  const bases = useMemo(() => simMatch ? { [m.a]: teamWeekBase(d, league, m.a, m.week), [m.b]: teamWeekBase(d, league, m.b, m.week) } : null, [d, league, m.a, m.b, m.week, simMatch])
  const { sa, sb, pA, final } = matchupOdds(d, league, m, bases && simMatch ? (id) => simulatedFromBase(bases[id], simMatch, sim.scores) : undefined)
  const side = (id: number, score: typeof sa, probability: number, right: boolean) => {
    const team = league.teams[id]
    const rank = rows.findIndex((r) => r.teamId === id) + 1
    const r = rows.find((r) => r.teamId === id)
    const won = final && probability === 1
    const color = final ? (won ? t.c.win : probability === 0 ? t.c.dim : t.c.muted) : probability >= 0.5 ? t.c.accent : t.c.muted
    return (
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 7 }}>
          <TeamBadge team={team} size={28} />
          <View style={{ flex: 1, alignItems: right ? 'flex-start' : 'flex-end' }}>
            <Txt num weight={700} size={20} numberOfLines={1} adjustsFontSizeToFit>{fmt(score.score, 1)}</Txt>
            <Txt num size={10} tone="dim">{fmt(score.proj, 1)} proj</Txt>
          </View>
        </View>
        <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
          {won && <Icon name="trophy.fill" size={11} color={t.c.gold} />}
          <Txt num size={9} weight={700} style={{ color }}>{Math.round(probability * 100)}% WIN</Txt>
        </View>
        <View style={{ height: 3, borderRadius: 3, backgroundColor: alpha(t.c.muted, 0.2), overflow: 'hidden', alignItems: right ? 'flex-end' : 'flex-start' }}><View style={{ height: 3, width: `${Math.max(0, Math.min(100, probability * 100))}%`, backgroundColor: color }} /></View>
        <Txt display weight={700} size={12.5} numberOfLines={1} style={{ textAlign: right ? 'right' : 'left' }}>{team.name}</Txt>
        <Txt size={10} tone="dim" numberOfLines={1} style={{ textAlign: right ? 'right' : 'left' }}>{recordOf(league, id)}{r?.streak ? ` · ${r.streak.slice(1)}${r.streak[0]}` : ''} · #{rank}</Txt>
      </View>
    )
  }
  return (
    <Pressable onPress={() => nav.leagueMatchup(m.week, m.a)} accessibilityRole="button" accessibilityLabel={`${league.teams[m.a].name} versus ${league.teams[m.b].name}, ${weekLabel(m.week)}, ${fmt(sa.score, 1)} to ${fmt(sb.score, 1)}. Open matchup`} style={({ pressed }) => [{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: t.r.lg, backgroundColor: t.c.panel, borderWidth: 1, borderColor: t.c.line2, opacity: pressed ? 0.65 : 1 }]}>
      {m.label && <Txt up size={9} tone="gold" style={{ marginBottom: 4 }}>{m.label}</Txt>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        {side(m.a, sa, pA, false)}
        <View style={{ borderRadius: t.r.sm, backgroundColor: t.c.bg, paddingHorizontal: 5, paddingVertical: 7 }}><Txt weight={700} size={10} tone="dim">VS</Txt></View>
        {side(m.b, sb, 1 - pA, true)}
      </View>
    </Pressable>
  )
}

export function StandingsHeader({ details, onDetails }: { details: boolean; onDetails: () => void }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Txt display size={18} weight={700}>Standings</Txt>
      <Pressable onPress={onDetails} accessibilityRole="button" accessibilityState={{ expanded: details }} style={{ paddingVertical: 12 }}><Txt size={12} tone="accent" weight={600}>{details ? 'Less' : 'Details'} ›</Txt></Pressable>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => nav.league('playoffs')} accessibilityRole="button" accessibilityLabel="View playoff bracket" style={{ flexDirection: 'row', alignItems: 'center', gap: 5, padding: 9, borderRadius: t.r.lg, backgroundColor: t.c.panel, borderWidth: 1, borderColor: t.c.line2 }}><Icon name="trophy" size={12} color={t.c.accent} /><Txt size={11} weight={600}>Playoffs</Txt></Pressable>
    </View>
  )
}

const LABELS: Record<Txn['type'], string> = { add: 'Free agency', drop: 'Free agency', waiver: 'Waiver claim', 'waiver-fail': 'Claim failed', trade: 'Trade', autosub: 'Auto-sub' }
export function LeagueActivity({ league }: { league: League }) {
  const moves = league.txns.slice(0, 4)
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt display size={18} weight={700}>Activity</Txt>
        <Pressable onPress={() => nav.league('activity')} accessibilityRole="button" style={{ paddingVertical: 12 }}><Txt size={13} tone="accent" weight={600}>View all</Txt></Pressable>
      </View>
      <Section inset={10}>
        {moves.length ? moves.map((x) => (
          <View key={x.id} style={{ paddingHorizontal: 10, paddingVertical: 9, gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Txt weight={700} size={12} numberOfLines={1} style={{ flex: 1 }}>{managerName(league.teams[x.teamId])}</Txt>
              <Txt up size={9} tone="muted">{LABELS[x.type]}</Txt>
              <Txt size={10} tone="dim">{weekLabel(x.week)}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, opacity: x.type === 'waiver-fail' ? 0.5 : 1 }}>
              <Moves ids={x.adds} kind={x.type === 'waiver-fail' ? 'CLAIM' : x.type === 'autosub' ? 'IN' : 'ADD'} />
              <Moves ids={x.drops} kind={x.type === 'autosub' ? 'OUT' : 'DROP'} />
            </View>
            {x.bid !== undefined && <Txt num size={10} tone="dim">${x.bid} bid</Txt>}
            {x.otherTeamId !== undefined && <Txt size={11} tone="muted">With {league.teams[x.otherTeamId].name}</Txt>}
          </View>
        )) : <View style={{ padding: 18 }}><Txt size={14} tone="muted">No transactions yet</Txt></View>}
      </Section>
    </View>
  )
}
function Moves({ ids, kind }: { ids: number[]; kind: string }) {
  const positive = kind === 'ADD' || kind === 'IN' || kind === 'CLAIM'
  if (!ids.length) return null
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
      {ids.map((pid) => {
        const p = getData().players[pid]
        return <PlayerLink key={pid} pid={pid} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><PlayerAvatar p={p} size={24} /><View style={{ flex: 1, minWidth: 0, gap: 2 }}><Txt size={9} weight={600} tone={positive ? 'win' : 'loss'}>{positive ? '+' : '−'} {kind} · {p.role} · {p.team}</Txt><Txt size={12} weight={700} numberOfLines={1}>{p.name}</Txt></View></PlayerLink>
      })}
    </View>
  )
}
