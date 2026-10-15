import { memo, useEffect, useRef } from 'react'
import { Animated, ScrollView, View } from 'react-native'
import type { FTeam, League } from '@shared/engine/league'
import { getData, ME } from '@shared/store'
import { upcomingPicks } from '@shared/ui/draft'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { PlayerAvatar, PlayerLink, TeamBadge, Txt } from '@/ui'

// The pick ticker under the on-the-clock card: the latest picks, then who is up next. It follows the draft, keeping
// the newest pick and the team on the clock in view, and each new pick drops in.

const W = 128
const GAP = 8
const PAST = 24
const NEXT = 8

export const DraftTicker = memo(function DraftTicker({ league }: { league: League }) {
  const picks = league.draft.picks
  const past = picks.slice(-PAST)
  const next = upcomingPicks(league, NEXT)
  const ref = useRef<ScrollView>(null)
  // picks made before the ticker appeared don't animate in
  const seen = useRef(picks.length).current
  // the newest pick at the left edge, the team on the clock beside it
  const x = Math.max(0, (past.length - 1) * (W + GAP))

  useEffect(() => {
    ref.current?.scrollTo({ x, animated: true })
  }, [x, picks.length])

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentOffset={{ x, y: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: GAP }}
      style={{ flexGrow: 0 }}
    >
      {past.map((pk) => (
        <PastPick
          key={`p${pk.overall}`}
          pid={pk.player}
          label={`${pk.round}.${String(pk.pick).padStart(2, '0')} · ${league.teams[pk.teamId].isUser ? 'You' : league.teams[pk.teamId].name}`}
          mine={pk.teamId === ME}
          fresh={pk.overall > seen}
        />
      ))}
      {next.map((u, i) => (
        <NextPick key={`n${u.overall}`} team={league.teams[u.teamId]} overall={u.overall} current={i === 0} />
      ))}
    </ScrollView>
  )
})

const PastPick = memo(function PastPick({ pid, label, mine, fresh }: { pid: number; label: string; mine: boolean; fresh: boolean }) {
  const s = useStyles(styles)
  const p = getData().players[pid]
  const appear = useRef(new Animated.Value(fresh ? 0 : 1)).current
  useEffect(() => {
    if (fresh) Animated.spring(appear, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 7 }).start()
  }, [fresh, appear])
  return (
    <Animated.View style={{ opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
      <PlayerLink pid={pid} style={mine ? s.tickMine : s.tick}>
        <PlayerAvatar p={p} size={30} />
        <View style={s.text}>
          <Txt size={13} weight={600} numberOfLines={1}>{p.name}</Txt>
          <Txt size={10.5} tone="dim" numberOfLines={1}>{label}</Txt>
        </View>
      </PlayerLink>
    </Animated.View>
  )
})

function NextPick({ team, overall, current }: { team: FTeam; overall: number; current: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const mine = team.id === ME
  return (
    <View style={[s.tick, s.next, mine && s.mine, current && { borderStyle: 'solid', borderColor: mine ? t.c.accent : t.c.line2 }]}>
      <TeamBadge team={team} size={30} />
      <View style={s.text}>
        <Txt size={13} weight={600} numberOfLines={1} tone={mine ? 'accent' : 'text'}>{mine ? 'Your pick' : team.name}</Txt>
        <Txt size={10.5} tone={current ? 'accent' : 'dim'} weight={current ? 700 : 400} numberOfLines={1}>
          {current ? 'On the clock' : `Pick ${overall}`}
        </Txt>
      </View>
    </View>
  )
}

const styles = (t: Theme) => {
  const tick = {
    width: W, height: 50, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 9,
    borderRadius: t.r.md, backgroundColor: t.c.panel, borderWidth: 1, borderColor: 'transparent',
  }
  const mine = { backgroundColor: alpha(t.c.accent, 0.12), borderColor: alpha(t.c.accent, 0.4) }
  return {
    tick,
    mine,
    // one flat style for PlayerLink
    tickMine: { ...tick, ...mine },
    next: { backgroundColor: 'transparent', borderColor: t.c.line2, borderStyle: 'dashed' as const },
    text: { flex: 1, minWidth: 0, gap: 1 },
  }
}
