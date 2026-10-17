import { Stack } from 'expo-router'
import { Alert, Pressable, View } from 'react-native'
import { currentWeek, ROSTER_SIZE, userMatchup, type League } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import { matchupOdds } from '@shared/ui/helpers'
import { simulatedFromBase, teamWeekBase } from '@shared/ui/matchupSimulation'
import { CompetitionLogo } from '@/components/CompetitionLogo'
import { ProfileButton } from '@/components/ProfileAvatar'
import { IPL } from '@/data/competitions'
import { togglePinned, useHomePrefs } from '@/data/homePrefs'
import { recordOf } from '@/data/derived'
import { selectLeague, useLeagues } from '@/data/leagues'
import { useLiveSim } from '@/data/simulation'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, chooseOption, Chip, EmptyState, Icon, Meter, Screen, TeamBadge, Txt, useTabTitle } from '@/ui'

export async function openSavedLeague(id: number, target: 'matchup' | 'team' | 'chat' | 'activity' = 'matchup') {
  if (!await selectLeague(id)) return
  nav.openLeague(target)
}

export function HomeScreen() {
  const t = useTheme()
  const s = useStyles(styles)
  const title = useTabTitle('Seam')
  const leagues = useLeagues((st) => st.leagues)
  const busy = useLeagues((st) => st.busy)
  const pinned = useHomePrefs((st) => st.pinned)
  const sorted = [...leagues].sort((a, b) => Number(pinned.includes(b.createdAt)) - Number(pinned.includes(a.createdAt)))
  return (
    <>
      <Stack.Screen options={{ ...title, unstable_headerRightItems: () => [
        { type: 'custom', element: <ProfileButton />, hidesSharedBackground: true },
      ] }} />
      <Screen gap={24}>
        <View style={s.welcome}>
          <View style={s.brand}><Icon name="cricket.ball.fill" size={24} color={t.c.accent} /></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt display size={23} weight={700}>Your season starts here.</Txt>
            <Txt size={13} tone="muted">Season-long fantasy cricket</Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Create league" icon="plus" kind="filled" size="large" disabled={busy} style={{ flex: 1 }} onPress={nav.createLeague} />
          <Button title="Join league" icon="person.badge.plus" kind="gray" size="large" style={{ flex: 1 }} onPress={() => Alert.alert('Join a league', 'Online leagues with friends are coming later. For now, you can create leagues on this phone and draft against AI managers.')} />
        </View>
        <View style={{ gap: 10 }}>
          <View style={s.heading}>
            <Txt display weight={700} size={21}>Your leagues</Txt>
            <View style={s.count}><Txt num size={12} weight={600} tone="muted">{leagues.length}</Txt></View>
          </View>
          {leagues.length ? sorted.map((league) => <LeagueCard key={league.createdAt} league={league} />) : (
            <EmptyState icon="sportscourt" title="Your league belongs here" message="Draft your squad and build your season." />
          )}
        </View>
      </Screen>
    </>
  )
}

function LeagueCard({ league: l }: { league: League }) {
  const t = useTheme()
  const s = useStyles(styles)
  const busy = useLeagues((st) => st.busy)
  const activeId = useLeagues((st) => st.activeId)
  const sim = useLiveSim()
  const d = getData()
  const compatible = l.dataVersion === d.version
  const week = currentWeek(d, l)
  const raw = compatible && l.phase !== 'draft' ? userMatchup(l, week) : undefined
  const m = raw && (raw.b === ME ? { ...raw, a: raw.b, b: raw.a } : raw)
  const simM = activeId === l.createdAt && sim.m?.mi === l.replayMatch && sim.m.gw === week ? sim.m : null
  const odds = m ? matchupOdds(d, l, m, simM ? (id) => simulatedFromBase(teamWeekBase(d, l, id, week), simM, sim.scores) : undefined) : null
  const final = !!l.results[week]
  const started = l.played > d.gameweeks[week - 1].mis[0]
  const status = !compatible ? 'UPDATE NEEDED' : l.phase === 'draft' ? 'DRAFT' : final ? 'FINAL' : simM ? 'LIVE SIM' : started ? 'IN PROGRESS' : 'UPCOMING'
  const team = l.teams[ME]
  const pinned = useHomePrefs((st) => st.pinned.includes(l.createdAt))
  const open = () => void openSavedLeague(l.createdAt)
  type Action = 'pin' | 'matchup' | 'team' | 'chat' | 'activity' | null
  const menu = () => chooseOption<Action>({
    title: l.name, value: null, tint: t.c.accent,
    options: [
      { value: 'pin', label: pinned ? 'Unpin league' : 'Pin league' },
      { value: 'matchup', label: l.phase === 'draft' ? 'Continue draft' : 'View matchup' },
      ...(l.phase === 'draft' ? [] : [
        { value: 'team' as const, label: 'My team' }, { value: 'chat' as const, label: 'League chat' }, { value: 'activity' as const, label: 'League activity' },
      ]),
    ],
    onChoose: (action) => { if (action === 'pin') togglePinned(l.createdAt); else if (action) void openSavedLeague(l.createdAt, action) },
  })
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${l.name}`} disabled={busy || !compatible} onPress={open} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CompetitionLogo competition={IPL} width={36} height={30} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {pinned && <Icon name="pin.fill" size={11} color={t.c.accent} />}
              <Txt size={15} weight={700} numberOfLines={1} style={{ flexShrink: 1 }}>{l.name}</Txt>
            </View>
            <Txt size={11} tone="muted" numberOfLines={1}>IPL {d.raw.simSeason} · {l.phase === 'draft' ? 'Draft' : weekLabel(week)} · {l.numTeams} teams</Txt>
          </View>
        </Pressable>
        <Button icon="ellipsis" kind="plain" disabled={busy || !compatible} accessibilityLabel={`Options for ${l.name}`} onPress={menu} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${l.name}${odds ? `, your score ${fmt(odds.sa.score)}, opponent ${fmt(odds.sb.score)}` : ''}`} disabled={busy || !compatible} onPress={open} onLongPress={menu} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <View style={s.cardBody}>
        {m && odds ? (
          <>
            <View style={{ flexDirection: 'row', gap: 18 }}>
              <Score team={l.teams[m.a]} score={odds.sa.score} proj={odds.sa.proj} mine />
              <View style={{ justifyContent: 'center' }}><Txt size={11} tone="dim" weight={600}>VS</Txt></View>
              <Score team={l.teams[m.b]} score={odds.sb.score} proj={odds.sb.proj} />
            </View>
            <Meter value={odds.pA} height={3} color={t.c.accent} rest={alpha(t.c.tint, 0.1)} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 5 }}>
            <TeamBadge team={team} size={44} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt size={16} weight={600}>{team.name}</Txt>
              <Txt size={13} tone="muted">{!compatible ? 'This league uses a different data version.' : l.phase === 'draft' ? `${l.draft.picks.length} of ${l.numTeams * ROSTER_SIZE} picks made` : 'No matchup this week'}</Txt>
            </View>
          </View>
        )}
      </View>
      <View style={s.cardFooter}>
        <Txt size={11} tone="muted">{l.phase === 'draft' ? 'Build your XI' : `${recordOf(l, ME)} record`}</Txt>
        <Chip label={status} tone={simM ? 'live' : 'neutral'} />
        <Txt size={11} weight={600} tone="accent">{l.phase === 'draft' ? 'Continue draft' : 'View matchup'} →</Txt>
      </View>
      </Pressable>
    </View>
  )
}

function Score({ team, score, proj, mine }: { team: League['teams'][number]; score: number; proj: number; mine?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: mine ? 'flex-start' : 'flex-end', gap: 4, minWidth: 0 }}>
      <View style={{ flexDirection: mine ? 'row' : 'row-reverse', alignItems: 'center', gap: 5, maxWidth: '100%' }}>
        <TeamBadge team={team} size={24} />
        <Txt weight={600} size={12} numberOfLines={1} style={{ flexShrink: 1 }}>{team.name}</Txt>
      </View>
      <Txt num size={24} weight={700}>{fmt(score)}</Txt>
      <Txt num size={11} tone="dim">Proj {fmt(proj, 1)}</Txt>
    </View>
  )
}

const styles = (t: Theme) => ({
  welcome: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 14 },
  brand: { width: 48, height: 48, borderRadius: 16, backgroundColor: alpha(t.c.accent, 0.12), alignItems: 'center' as const, justifyContent: 'center' as const },
  heading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  count: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: alpha(t.c.tint, 0.08), alignItems: 'center' as const, justifyContent: 'center' as const },
  card: { backgroundColor: t.c.panel, borderRadius: t.r.lg, overflow: 'hidden' as const, borderWidth: 1, borderColor: t.c.line2 },
  cardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.c.line2 },
  cardBody: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  cardFooter: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: alpha(t.c.tint, 0.035) },
})
