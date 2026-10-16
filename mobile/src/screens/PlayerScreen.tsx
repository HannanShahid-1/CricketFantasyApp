import { useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ROLE_LABEL, seasonToDate, type Player } from '@shared/engine/data'
import { currentWeek, weekMatches, type League } from '@shared/engine/league'
import { playerRanks, playerSeasonStats } from '@shared/engine/playerInsights'
import { scoutingProfile } from '@shared/engine/playerProfile'
import { fmt } from '@shared/engine/scoring'
import { getData, ME } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import { cardPlayed } from '@shared/ui/playerCard'
import { MatchPicker } from '@/components/MatchPicker'
import { GameLog } from '@/components/player/GameLog'
import { Hero } from '@/components/player/Hero'
import { Outlook } from '@/components/player/Outlook'
import { Projections } from '@/components/player/Projections'
import { useSheetLeague } from '@/components/sheets/SheetChrome'
import { ownersOf } from '@/data/derived'
import { intParam, nav } from '@/nav'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, EmptyState, GroupHeader, haptic, Section, StatGrid, Txt } from '@/ui'

// The player card, laid out like Sleeper's: a compact team-branded header (his photo, team and lineup slots, who
// owns him, his bio in one row and the action you can take), then a sliding tab bar. Summary has his ranks and averages, which match
// counts this week (your players), weekly projections, his season numbers and the fantasy outlook, with his match
// previews and recaps folded away under a Player updates row at the bottom; Game log has every match. Opens from
// every player row, and from the draft room.

type Tab = 'summary' | 'log'
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'log', label: 'Game log' },
]

export function PlayerScreen() {
  const pid = intParam(useLocalSearchParams<{ id: string }>().id)
  const [league, closeAfter] = useSheetLeague()
  const [tab, setTab] = useState<Tab>('summary')
  const t = useTheme()
  const bottom = useSafeAreaInsets().bottom
  // switching tabs while scrolled down starts the new tab at its top, just under the pinned tab bar
  const scroller = useRef<ScrollView>(null)
  const scrollY = useRef(0)
  const heroHeight = useRef(0)
  const switchTab = useCallback((next: Tab) => {
    setTab(next)
    if (scrollY.current > heroHeight.current) scroller.current?.scrollTo({ y: heroHeight.current, animated: false })
  }, [])
  const p = getData().players[pid]
  if (!p) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.c.bg }}>
        <EmptyState icon="person.fill.questionmark" title="Player not found" action={<Button title="Close" onPress={nav.close} />} />
      </View>
    )
  }
  const played = cardPlayed(league)
  return (
    <ScrollView
      ref={scroller}
      onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y }}
      scrollEventThrottle={64}
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingBottom: bottom + 32 }}
      stickyHeaderIndices={[1]}
    >
      <View onLayout={(e) => { heroHeight.current = e.nativeEvent.layout.height }}>
        <Hero p={p} league={league} closeAfter={closeAfter} />
      </View>
      <View style={{ backgroundColor: t.c.bg, paddingHorizontal: 16, paddingTop: 14 }}>
        <TabBar value={tab} onChange={switchTab} />
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 24 }}>
        {tab === 'summary' && (
          <>
            <Headline p={p} played={played} />
            {league && <ThisWeek p={p} league={league} />}
            <Projections p={p} league={league} played={played} />
            <Season p={p} played={played} />
            <Outlook p={p} league={league} played={played} />
          </>
        )}
        {tab === 'log' && <GameLog p={p} played={played} />}
      </View>
    </ScrollView>
  )
}

// ---------------------------------------------------------------- tab bar

/** Sleeper-style tabs: equal-width labels over a track with an underline that slides to the selected one. */
function TabBar({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const s = useStyles(styles)
  const [width, setWidth] = useState(0)
  const index = TABS.findIndex((x) => x.key === value)
  const x = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(x, { toValue: (index * width) / TABS.length, duration: 180, useNativeDriver: true }).start()
  }, [index, width, x])
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      <View style={{ flexDirection: 'row' }}>
        {TABS.map((tab) => {
          const selected = tab.key === value
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                if (selected) return
                haptic.select()
                onChange(tab.key)
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={s.tab}
            >
              <Txt up size={13} weight={700} tone={selected ? 'text' : 'muted'}>{tab.label}</Txt>
            </Pressable>
          )
        })}
      </View>
      <View style={s.track}>
        {width > 0 && <Animated.View style={[s.indicator, { width: width / TABS.length, transform: [{ translateX: x }] }]} />}
      </View>
    </View>
  )
}

/** Which of his matches counts this week (your players only). */
function ThisWeek({ p, league }: { p: Player; league: League }) {
  const d = getData()
  if (league.phase !== 'season' || ownersOf(league).get(p.idx) !== ME) return null
  const week = currentWeek(d, league)
  const n = weekMatches(d, p.idx, week).length
  if (!n) return null
  return (
    <Section
      title={`${weekLabel(week)} · which match counts`}
    >
      <View style={{ padding: 14 }}><MatchPicker pid={p.idx} /></View>
    </Section>
  )
}

// ---------------------------------------------------------------- summary: ranks, averages and season numbers

/** The numbers at the top of Summary: his ranks, FPTS per game and season totals (scrolls sideways if it must). */
function Headline({ p, played }: { p: Player; played: number }) {
  const d = getData()
  const { season, ranks, last3 } = useMemo(() => {
    const profile = scoutingProfile(d, p, played)
    return {
      season: seasonToDate(p, played),
      ranks: playerRanks(d, p, played),
      last3: profile.currentApps >= 3 ? profile.recentAverage : null,
    }
  }, [d, p, played])
  const rank = (n: number | null) => (n ? `#${n}` : '–')
  const groups = [
    { title: 'Player rank', cells: [{ value: rank(ranks.role), label: ROLE_LABEL[p.role] }, { value: rank(ranks.overall), label: 'Overall' }] },
    { title: 'FPTS / game', cells: [{ value: season.apps ? fmt(season.avg, 1) : '–', label: 'Season' }, { value: last3 !== null ? fmt(last3, 1) : '–', label: 'Last 3' }] },
    { title: `IPL ${d.raw.simSeason} totals`, cells: [{ value: String(season.apps), label: 'Matches' }, { value: fmt(season.pts, 1), label: 'FPTS' }] },
  ]
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
      {groups.map((g) => (
        <View key={g.title} style={{ gap: 10 }}>
          <Txt up size={11} weight={700} tone="muted" style={g.title === `IPL ${d.raw.simSeason} totals` ? { textAlign: 'center' } : undefined}>{g.title}</Txt>
          <View style={{ flexDirection: 'row', gap: g.title === `IPL ${d.raw.simSeason} totals` ? 8 : 12, justifyContent: g.title === `IPL ${d.raw.simSeason} totals` ? 'center' : undefined }}>
            {g.cells.map((c) => (
              <View key={c.label} style={{ gap: 2, alignItems: g.title === `IPL ${d.raw.simSeason} totals` ? 'center' : 'flex-start' }}>
                <Txt num weight={700} size={21}>{c.value}</Txt>
                <Txt up size={10.5} weight={700} tone="dim">{c.label}</Txt>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

function Season({ p, played }: { p: Player; played: number }) {
  const d = getData()
  const stats = useMemo(() => playerSeasonStats(d, p, played).stats.map(([label, value]) => ({ label, value })), [d, p, played])
  return (
    <View>
      <GroupHeader title={`IPL ${d.raw.simSeason} stats`} />
      <StatGrid items={stats} columns={stats.length === 4 ? 2 : 3} />
    </View>
  )
}

const styles = (t: Theme) => ({
  tab: { flex: 1, alignItems: 'center' as const, paddingBottom: 10, paddingTop: 2 },
  track: { height: 3, borderRadius: 2, backgroundColor: t.c.line2 },
  indicator: { height: 3, borderRadius: 2, backgroundColor: t.c.accent },
})
