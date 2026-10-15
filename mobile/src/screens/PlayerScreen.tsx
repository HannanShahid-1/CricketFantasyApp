import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Animated, LayoutAnimation, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { matchProjection, ROLE_LABEL, ROLE_NAME, seasonToDate, type Player } from '@shared/engine/data'
import { fantasyAdvice, type FantasyAdvice } from '@shared/engine/fantasyAdvice'
import { addMode, countedMatch, currentWeek, isLocked, LAST_WEEK, managerName, weekMatches, type League } from '@shared/engine/league'
import { playerAge } from '@shared/engine/playerAge'
import { playerRanks, playerReports, playerSeasonStats, type PlayerReport } from '@shared/engine/playerInsights'
import { scoutingProfile } from '@shared/engine/playerProfile'
import { fmt } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { fmtDate, initials, weekLabel } from '@shared/ui/format'
import { cardPlayed, gameLog, ptsBand, type LogEntry } from '@shared/ui/playerCard'
import { MatchPicker } from '@/components/MatchPicker'
import { useSheetLeague } from '@/components/sheets/SheetChrome'
import { ownersOf, recordOf } from '@/data/derived'
import { LOGOS, PHOTOS } from '@/generated/photos'
import { intParam, nav } from '@/nav'
import { alpha, mix, useStyles, useTheme, type Theme } from '@/theme/theme'
import {
  Button, Chip, type ChipTone, confirm, EmptyState, GroupHeader, haptic, Icon, report, roleColor, Row, RowIcon,
  Section, type SFSymbol, SlotBadge, StatGrid, TeamTag, type Tone, Txt,
} from '@/ui'

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

// ---------------------------------------------------------------- header

// The header is the one team-branded block in the app: the IPL team's colours (darkened so white type always
// reads, even on CSK yellow) behind a small photo and a faded team logo (its code when there's no logo), with white
// type in every theme.
const HERO = {
  ink: '#fff',
  soft: 'rgba(255, 255, 255, 0.78)',
  faint: 'rgba(255, 255, 255, 0.6)',
  plate: 'rgba(0, 0, 0, 0.15)',
  button: 'rgba(255, 255, 255, 0.2)',
  base: '#0b1017',
  fallback: { color: '#33404d' },
}
const PHOTO_W = 136

const BATS: Record<string, string> = { 'Right-handed': 'RHB', 'Left-handed': 'LHB' }
const BOWLS: Record<string, string> = {
  'Off break': 'OB', 'Off Spin': 'OB', 'Leg break': 'LB', 'Leg spin': 'LB', 'Leg break googly': 'LBG',
  'Slow left-arm orthodox': 'SLA', 'Left-arm wrist spin': 'SLC',
  'Right-arm fast': 'RF', 'Right-arm fast medium': 'RFM', 'Right-arm medium fast': 'RMF', 'Right-arm medium': 'RM',
  'Left-arm fast': 'LF', 'Left-arm fast medium': 'LFM', 'Left-arm medium fast': 'LMF', 'Left-arm medium': 'LM',
}
const COUNTRY: Record<string, string> = {
  India: 'IND', 'South Africa': 'SA', Australia: 'AUS', England: 'ENG', 'New Zealand': 'NZ', 'Sri Lanka': 'SL',
  'West Indies': 'WI', Afghanistan: 'AFG', Bangladesh: 'BAN', Zimbabwe: 'ZIM',
}
const initialsOf = (s: string) => s.split(/[\s-]+/).map((w) => w[0]).join('').toUpperCase()

function Hero({ p, league, closeAfter }: { p: Player; league: League | null; closeAfter: () => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const code = p.team || p.profileTeam || ''
  const team = getData().teams[code]
  const { color } = team ?? HERO.fallback
  const photo = PHOTOS[p.id]
  const bio = p.bio
  const age = bio ? playerAge(bio.birthDate) : null
  // short values in the header; VoiceOver reads the full ones
  const facts = [
    { label: 'Age', value: age !== null ? String(age) : '–', full: age !== null ? `${age} years` : 'not listed' },
    { label: 'Bats', value: bio ? (BATS[bio.battingStyle] ?? initialsOf(bio.battingStyle)) : '–', full: bio?.battingStyle ?? 'not listed' },
    {
      label: 'Bowls',
      value: bio?.bowlingStyle ? (BOWLS[bio.bowlingStyle] ?? initialsOf(bio.bowlingStyle)) : '–',
      full: bio?.bowlingStyle ?? "doesn't bowl",
    },
    { label: 'From', value: bio ? (COUNTRY[bio.nationality] ?? bio.nationality.slice(0, 3).toUpperCase()) : '–', full: bio?.nationality ?? 'not listed' },
  ]
  // the surname keeps its lowercase particles: Quinton / de Kock
  const words = p.fullName.trim().split(/\s+/)
  let split = words.length - 1
  while (split > 1 && /^[a-z]/.test(words[split - 1])) split--
  const first = words.slice(0, split).join(' ')
  const last = words.slice(split).join(' ')
  const own = useOwnership(p, league, closeAfter)
  return (
    <View
      style={[s.hero, {
        backgroundColor: mix(color, HERO.base, 0.45),
        experimental_backgroundImage:
          `radial-gradient(circle at 12% 40%, ${alpha(color, 0.55)} 0%, transparent 60%), ` +
          `linear-gradient(150deg, ${mix(color, HERO.base, 0.62)} 0%, ${mix(color, HERO.base, 0.26)} 100%)`,
      }]}
    >
      <HeroBackdrop color={color} />
      <View style={s.side}>
        <View style={s.photoBox}>
          {LOGOS[code] ? (
            <Image source={LOGOS[code]} style={s.logo} contentFit="contain" accessible={false} />
          ) : !!code && (
            <Txt display weight={700} size={70} numberOfLines={1} style={s.watermark}>{code}</Txt>
          )}
          {photo ? (
            <Image source={photo} style={s.photo} contentFit="contain" contentPosition="bottom" transition={160} accessibilityLabel={p.fullName} />
          ) : (
            <View style={s.noPhoto}><Txt display weight={700} size={40} style={{ color: HERO.soft }}>{initials(p.name)}</Txt></View>
          )}
        </View>
        <View style={s.plate}>
          <Txt display up weight={700} size={12} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: HERO.ink, textAlign: 'center' }}>
            {team?.name ?? 'No IPL team'}
          </Txt>
          <Txt size={12} weight={800} style={{ color: mix(roleColor(t, p.role), HERO.ink, 0.7), letterSpacing: 0.4 }}>
            {ROLE_LABEL[p.role]}
            {!!code && <Txt size={12} weight={600} style={{ color: HERO.faint }}>{`  ·  ${code}`}</Txt>}
          </Txt>
          <View style={s.slots} accessible accessibilityLabel={`Eligible for ${p.elig.join(', ')}`}>
            {p.elig.map((e) => <SlotBadge key={e} slot={e} small />)}
          </View>
        </View>
      </View>
      <View style={s.main}>
        {own && (
          <View style={s.owner}>
            <Icon name="arrow.right" size={11} weight="bold" color={HERO.soft} />
            <Txt size={13} numberOfLines={1} style={{ color: HERO.soft, flexShrink: 1 }}>
              <Txt size={13} weight={600} style={{ color: HERO.ink }}>{own.owner}</Txt>
              {own.detail ? ` · ${own.detail}` : ''}
            </Txt>
          </View>
        )}
        <View accessible accessibilityRole="header" accessibilityLabel={p.fullName}>
          {!!first && <Txt display up weight={700} size={20} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: HERO.ink }}>{first}</Txt>}
          <Txt display up weight={800} size={31} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: HERO.ink, lineHeight: 36 }}>{last}</Txt>
        </View>
        <View style={s.facts}>
          {facts.map((f) => (
            <View key={f.label} style={s.fact} accessible accessibilityLabel={`${f.label}: ${f.full}`}>
              <Txt up size={11} weight={600} numberOfLines={1} style={{ color: HERO.faint }}>{f.label}</Txt>
              <Txt num weight={700} size={19} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: HERO.ink }}>
                {f.value}
              </Txt>
            </View>
          ))}
        </View>
        {own?.action && (
          <Pressable
            disabled={own.action.disabled}
            onPress={() => {
              if (own.action?.disabled) return
              haptic.tap()
              own.action?.onPress()
            }}
            accessibilityRole="button"
            accessibilityLabel={`${own.action.title} ${p.name}`}
            accessibilityState={{ disabled: !!own.action.disabled }}
            accessibilityHint={own.action.disabled ? 'Locked until this gameweek ends.' : undefined}
            style={({ pressed }) => [s.pill, own.action?.disabled && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}
          >
            <Icon name={own.action.icon} size={13} weight="semibold" color={HERO.ink} />
            <Txt up size={14} weight={700} style={{ color: HERO.ink }}>{own.action.title}</Txt>
          </Pressable>
        )}
      </View>
      <Pressable onPress={nav.close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [s.close, pressed && { opacity: 0.6 }]}>
        <Icon name="xmark" size={12} weight="bold" color={HERO.ink} />
      </Pressable>
    </View>
  )
}

/**
 * The abstract layer behind the header, all in shades of the team's own colour: a light glow in the top corner,
 * a deep shade pooling at the bottom, three diagonal bands sweeping across and a faint ring.
 */
function HeroBackdrop({ color }: { color: string }) {
  const s = useStyles(styles)
  const light = mix(color, HERO.ink, 0.55)
  const deep = mix(color, HERO.base, 0.15)
  return (
    <View style={s.backdrop} pointerEvents="none">
      <View
        style={[s.backdrop, {
          experimental_backgroundImage:
            `radial-gradient(circle at 96% 0%, ${alpha(light, 0.45)} 0%, transparent 45%), ` +
            `radial-gradient(circle at 40% 120%, ${alpha(deep, 0.8)} 0%, transparent 55%)`,
        }]}
      />
      <View style={[s.band, { left: 170, width: 110, experimental_backgroundImage: `linear-gradient(180deg, ${alpha(light, 0.14)} 0%, transparent 85%)` }]} />
      <View style={[s.band, { left: 292, width: 36, experimental_backgroundImage: `linear-gradient(180deg, ${alpha(light, 0.22)} 0%, transparent 90%)` }]} />
      <View style={[s.band, { left: 340, width: 7, backgroundColor: alpha(light, 0.12) }]} />
      <View style={[s.ring, { borderColor: alpha(light, 0.08) }]} />
    </View>
  )
}

// ---------------------------------------------------------------- ownership and actions

interface Ownership { owner: string; detail: string | null; action: { title: string; icon: SFSymbol; disabled?: boolean; onPress: () => void } | null }

/** Who has him, what that means this week, and the one thing you can do about it (null outside a league). */
function useOwnership(p: Player, league: League | null, closeAfter: () => void): Ownership | null {
  const drop = useApp((s) => s.drop)
  if (!league) return null
  const d = getData()
  const owners = ownersOf(league)
  const owner = owners.get(p.idx)
  const team = owner !== undefined ? league.teams[owner] : null
  const season = league.phase === 'season'

  if (team) {
    const mine = team.isUser
    if (league.phase === 'draft') return { owner: mine ? 'Your team' : team.name, detail: mine ? 'You drafted him' : `Drafted by ${managerName(team)}`, action: null }
    if (!mine) {
      return {
        owner: team.name,
        detail: `${managerName(team)} · ${recordOf(league, team.id)}`,
        // the trade sheet replaces the card, so sending the offer can go straight to the chat
        action: season ? { title: 'Trade', icon: 'arrow.left.arrow.right', onPress: () => { nav.close(); nav.trade(team.id) } } : null,
      }
    }
    const locked = season && isLocked(d, league, p.idx)
    const onDrop = async () => {
      if (!(await confirm({ title: `Drop ${p.name}?`, message: 'He goes on waivers.', ok: 'Drop', destructive: true }))) return
      if (report(drop(p.idx), `Dropped ${p.name}`)) closeAfter()
    }
    return {
      owner: 'Your team',
      detail: !season ? null : locked ? 'Locked: his match has started' : team.starters.includes(p.idx) ? 'Starting XI' : 'Bench',
      action: season ? { title: 'Drop', icon: locked ? 'lock.fill' : 'trash', disabled: locked, onPress: onDrop } : null,
    }
  }
  if (league.phase === 'draft') return { owner: 'Available', detail: 'Not drafted yet', action: null }
  const mode = addMode(d, league, p.idx, owners)
  const claim = league.claims.find((c) => c.teamId === ME && c.add === p.idx)
  const waiver = mode === 'waiver'
  return {
    owner: waiver ? 'On waivers' : 'Free agent',
    detail: claim ? `Your $${claim.bid} claim is in` : waiver ? 'Claims run when the week ends' : null,
    action: mode !== 'none' ? { title: waiver ? 'Claim' : 'Add', icon: 'plus', onPress: () => nav.add(p.idx) } : null,
  }
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

// ---------------------------------------------------------------- summary: weekly projections

const HOW_PROJECTIONS =
  'Each projection starts from his average and his estimated chance of playing, then adjusts for the venue, how ' +
  "this opponent has fared against his role, his recent form and his batting and bowling workload. The weights are " +
  'fixed and conservative, small samples count for less, and the total adjustment is capped at ±25%.\n\n' +
  "Opposition XIs, injuries and batter-v-bowler matchups aren't known, so these are rough estimates, not " +
  "predictions, and they aren't proven to beat a plain average.\n\n" +
  'Past weeks are rebuilt from what was known before each match. Only the one match that counts for a lineup ' +
  'scores each week.'

type Forecast = ReturnType<typeof matchProjection>

function Projections({ p, league, played }: { p: Player; league: League | null; played: number }) {
  const d = getData()
  const s = useStyles(styles)
  const [week, setWeek] = useState(() =>
    league?.phase === 'season' ? currentWeek(d, league) : league?.phase === 'complete' ? LAST_WEEK : 1,
  )
  const [open, setOpen] = useState<number | null>(null)
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
    setOpen(null)
    setWeek((w) => w + by)
  }
  const toggle = useCallback((mi: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    haptic.select()
    setOpen((o) => (o === mi ? null : mi))
  }, [])
  return (
    <Section
      title="Projections"
      action={<InfoButton title="How projections work" message={HOW_PROJECTIONS} />}
    >
      <View style={s.stepper}>
        <StepButton icon="chevron.left" label="Previous week" disabled={week <= 1} onPress={() => step(-1)} />
        <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
          <Txt display weight={700} size={16}>{weekLabel(week)}</Txt>
          {gw && <Txt size={12} tone="muted">{fmtDate(gw.start, false)} – {fmtDate(gw.end, false)}</Txt>}
        </View>
        <StepButton icon="chevron.right" label="Next week" disabled={week >= LAST_WEEK} onPress={() => step(1)} />
      </View>
      {rows.length ? (
        rows.map(({ mi, f }) => (
          <ProjectionRow key={mi} p={p} mi={mi} f={f} played={played} counts={mi === counted} open={open === mi} onToggle={toggle} />
        ))
      ) : (
        <Row title="No match this week" subtitle={`${getData().teams[p.team]?.name ?? 'His team'} doesn't play in ${weekLabel(week).toLowerCase()}.`} />
      )}
    </Section>
  )
}

const ProjectionRow = memo(function ProjectionRow({ p, mi, f, played, counts, open, onToggle }: {
  p: Player; mi: number; f: Forecast; played: number; counts: boolean; open: boolean; onToggle: (mi: number) => void
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const m = getData().matches[mi]
  const done = mi < played
  const g = done ? p.games.get(mi) : undefined
  const actual: { value: string; tone: Tone } = !done
    ? { value: '–', tone: 'dim' }
    : !g
      ? { value: 'DNP', tone: 'loss' }
      : { value: fmt(g.pts.total, 1), tone: ptsBand(g.pts.total) === 'big' ? 'win' : ptsBand(g.pts.total) === 'low' ? 'loss' : 'text' }
  return (
    <View>
      <Pressable
        onPress={() => onToggle(mi)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Shows what went into his projection"
        style={({ pressed }) => [s.projRow, pressed && { backgroundColor: alpha(t.c.tint, 0.07) }]}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <View style={s.inline}>
            <Txt size={13} tone="muted">v</Txt>
            <TeamTag code={f.opponent} />
            {counts && <Chip label="Counts" tone="accent" icon="checkmark" />}
          </View>
          <Txt size={13} tone="muted" numberOfLines={1}>{fmtDate(m.raw.date)} · {m.raw.time}</Txt>
        </View>
        <NumCol label="Proj" value={fmt(f.total, 1)} tone={done ? 'muted' : 'text'} />
        <NumCol label="FPTS" value={actual.value} tone={actual.tone} />
        <Icon name={open ? 'chevron.up' : 'chevron.down'} size={11} color={t.c.dim} weight="semibold" />
      </Pressable>
      {open && <Breakdown p={p} f={f} />}
    </View>
  )
})

function NumCol({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <View style={{ width: 50, alignItems: 'flex-end', gap: 1 }}>
      <Txt up size={9.5} weight={700} tone="dim">{label}</Txt>
      <Txt num weight={700} size={18} tone={tone} numberOfLines={1}>{value}</Txt>
    </View>
  )
}

const signed = (x: number) => `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(2)}`
const appearances = (n: number) => `${n} earlier ${n === 1 ? 'appearance' : 'appearances'}`

/**
 * Why this forecast: his baseline plus each adjustment, both already scaled by his chance of playing, so the lines
 * add up to the projection. Adjustments that are zero (bowling workload for a keeper, say) are left out.
 */
function Breakdown({ p, f }: { p: Player; f: Forecast }) {
  const s = useStyles(styles)
  const line = (label: string, value: string, strong = false) => (
    <View key={label} style={s.line}>
      <Txt size={13.5} tone={strong ? 'text' : 'muted'} weight={strong ? 600 : 400} style={{ flex: 1 }}>{label}</Txt>
      <Txt num size={13.5} weight={strong ? 700 : 600}>{value}</Txt>
    </View>
  )
  const role = ROLE_NAME[p.role].toLowerCase()
  return (
    <View style={s.forecast}>
      {line('Player baseline', (f.base * f.chance).toFixed(2))}
      {f.components.filter((c) => Math.abs(c.points) >= 0.005).map((c) => line(c.label, signed(c.points)))}
      <View style={s.rule} />
      {line('Projection', f.total.toFixed(2), true)}
      <Txt size={12} tone="dim" style={{ lineHeight: 16, marginTop: 6 }}>
        Already allows for his {Math.round(f.chance * 100)}% chance of playing. Venue: {appearances(f.venueSamples)} by a{' '}
        {role} at {f.venue}. Opponent: {appearances(f.opponentSamples)} by a {role} against {f.opponent}. Small samples count for less.
      </Txt>
    </View>
  )
}

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
      <Icon name={icon} size={14} weight="semibold" color={t.c.text} />
    </Pressable>
  )
}

/** ⓘ in a section header: the longer explanation in a native alert. */
function InfoButton({ title, message }: { title: string; message: string }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={() => Alert.alert(title, message)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && { opacity: 0.5 }}
    >
      <Icon name="info.circle" size={17} color={t.c.accent} />
    </Pressable>
  )
}

// ---------------------------------------------------------------- summary: outlook

const REC_TONE: Record<FantasyAdvice['recommendation'], ChipTone> = {
  'Strong start': 'accent',
  'Start consideration': 'ok',
  'Matchup-dependent': 'sky',
  'Bench / watchlist': 'neutral',
  'Wait for XI': 'gold',
  Unproven: 'neutral',
}

const USAGE_NOTE =
  "Usage comes from the deliveries he faced and bowled, not an official position: the over of his first ball faced doesn't " +
  'fix his exact batting order, and bowling phases mean overs 1–6 and 17–20. Nothing about upcoming XIs, injuries or ' +
  'selection is assumed.'

function Outlook({ p, league, played }: { p: Player; league: League | null; played: number }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const size = league?.teams.length ?? 8
  const { profile, advice, reports } = useMemo(
    () => ({ profile: scoutingProfile(d, p, played), advice: fantasyAdvice(d, p, played, size), reports: playerReports(d, p, played, size) }),
    [d, p, played, size],
  )
  const identity = profile.identity.charAt(0).toUpperCase() + profile.identity.slice(1)
  return (
    <>
      <Section
        title="Fantasy outlook"
        action={<InfoButton title="About these opinions" message={advice.explanation} />}
      >
        <View style={s.outlook}>
          <View style={s.tags}>
            <Chip label={advice.recommendation} tone={REC_TONE[advice.recommendation]} />
            {advice.tier && <Chip label={advice.tier} />}
          </View>
          <View style={{ gap: 2 }}>
            <Txt display weight={700} size={17}>{identity}</Txt>
          </View>
          <Txt size={15} style={{ lineHeight: 21 }}>{advice.opinion}</Txt>
        </View>
        <Disclosure title="What this is based on">
          {(profile.evidence.length ? profile.evidence : ['No earlier appearances on record.']).map((fact) => (
            <View key={fact} style={s.bullet}>
              <View style={[s.dot, { backgroundColor: t.c.dim }]} />
              <Txt size={13.5} tone="muted" style={{ flex: 1, lineHeight: 19 }}>{fact}</Txt>
            </View>
          ))}
          <Txt size={12} tone="dim" style={{ lineHeight: 16, marginTop: 4 }}>{USAGE_NOTE}</Txt>
        </Disclosure>
      </Section>
      <PlayerUpdates p={p} reports={reports} />
    </>
  )
}

/** His match previews and recaps, folded away under one row until you open it. */
function PlayerUpdates({ p, reports }: { p: Player; reports: PlayerReport[] }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const n = reports.length
  return (
    <Section>
      <Row
        left={<RowIcon name="newspaper" color={t.c.accent} />}
        title="Player updates"
        subtitle={n ? `${n} match ${n === 1 ? 'preview or recap' : 'previews and recaps'}` : "He isn't in an IPL squad this season."}
        right={n ? <Icon name={open ? 'chevron.up' : 'chevron.down'} size={12} color={t.c.dim} weight="semibold" /> : undefined}
        onPress={n ? () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          haptic.select()
          setOpen((o) => !o)
        } : undefined}
      />
      {open && reports.map((r) => <ReportRow key={r.key} r={r} name={p.fullName} />)}
    </Section>
  )
}

/** A row that expands to show more (inside a Section). */
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  return (
    <View>
      <Row
        title={<Txt size={15} weight={500} tone="accent">{title}</Txt>}
        right={<Icon name={open ? 'chevron.up' : 'chevron.down'} size={12} color={t.c.dim} weight="semibold" />}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          haptic.select()
          setOpen((o) => !o)
        }}
      />
      {open && <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>{children}</View>}
    </View>
  )
}

/** A preview of his next match or a recap of a recent one. Previews skip the fantasy take: it's the outlook above. */
const ReportRow = memo(function ReportRow({ r, name }: { r: PlayerReport; name: string }) {
  const t = useTheme()
  const s = useStyles(styles)
  const [open, setOpen] = useState(false)
  const preview = r.kind === 'Preview'
  const prefix = `${name} · `
  const headline = r.title.startsWith(prefix) ? r.title.slice(prefix.length) : r.title
  return (
    <View style={s.report}>
      <View style={s.inline}>
        <Txt up size={11} weight={700} tone={preview ? 'accent' : 'muted'}>{r.kind}</Txt>
        <Txt size={12} tone="dim">· {fmtDate(r.date)}</Txt>
      </View>
      <Txt display weight={700} size={16.5} style={{ lineHeight: 21 }}>{headline}</Txt>
      <Txt size={14} tone="muted" style={{ lineHeight: 20 }}>{r.summary}</Txt>
      {!preview && (
        <>
          <View style={s.reportActions}>
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                haptic.select()
                setOpen((o) => !o)
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [s.inline, pressed && { opacity: 0.5 }]}
            >
              <Txt size={14} weight={600} tone="accent">Fantasy take</Txt>
              <Icon name={open ? 'chevron.up' : 'chevron.down'} size={11} color={t.c.accent} weight="semibold" />
            </Pressable>
            <Pressable onPress={() => nav.match(r.mi)} hitSlop={8} accessibilityRole="link" style={({ pressed }) => [s.inline, pressed && { opacity: 0.5 }]}>
              <Txt size={14} weight={600} tone="accent">Scorecard</Txt>
              <Icon name="chevron.right" size={11} color={t.c.accent} weight="semibold" />
            </Pressable>
          </View>
          {open && <Txt size={14} style={s.take}>{r.analysis}</Txt>}
        </>
      )}
    </View>
  )
})

// ---------------------------------------------------------------- game log

function GameLog({ p, played }: { p: Player; played: number }) {
  const d = getData()
  const log = useMemo(() => gameLog(d, p, played), [d, p, played])
  const [open, setOpen] = useState<number | null>(null)
  const toggle = useCallback((mi: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    haptic.select()
    setOpen((o) => (o === mi ? null : mi))
  }, [])
  return (
    <Section
      title={`IPL ${d.raw.simSeason} matches`}
      inset={58}
    >
      {log.length
        ? log.map((e) => <LogRow key={e.mi} e={e} open={open === e.mi} onToggle={toggle} />)
        : <Row title="No matches" subtitle="He isn't in an IPL squad this season." />}
    </Section>
  )
}

const STAT_ICONS: SFSymbol[] = ['figure.cricket', 'cricket.ball', 'hand.raised']

const LogRow = memo(function LogRow({ e, open, onToggle }: { e: LogEntry; open: boolean; onToggle: (mi: number) => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const g = e.game
  const band = g ? ptsBand(g.pts.total) : 'normal'
  const stats = [e.bat, e.bowl, e.field]
  const line = (
    <View style={[s.logRow, e.state === 'upcoming' && { opacity: 0.5 }]}>
      <View style={s.gw}>
        <Txt up size={9} weight={700} tone="dim">GW</Txt>
        <Txt num weight={700} size={16}>{e.gw}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={s.inline}>
          <Txt size={13} tone="muted">v</Txt>
          <TeamTag code={e.opp} />
          <Txt size={13} tone="muted">{fmtDate(e.date)}</Txt>
        </View>
        {e.state === 'upcoming' ? (
          <Txt size={13.5} tone="dim">Upcoming · {e.time}</Txt>
        ) : e.state === 'dnp' ? (
          <Txt size={13.5} tone="loss">Did not play</Txt>
        ) : stats.some(Boolean) ? (
          <View style={s.stats}>
            {stats.map((text, i) => text ? (
              <View key={i} style={s.inline}>
                <Icon name={STAT_ICONS[i]} size={12} color={t.c.dim} />
                <Txt size={13.5}>{text}</Txt>
              </View>
            ) : null)}
          </View>
        ) : (
          <Txt size={13.5} tone="dim">In the XI · no stats</Txt>
        )}
      </View>
      {g && (
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Txt num weight={700} size={19} tone={band === 'big' ? 'win' : band === 'low' ? 'loss' : 'text'}>{fmt(g.pts.total)}</Txt>
          <Icon name={open ? 'chevron.up' : 'chevron.down'} size={11} color={t.c.dim} weight="semibold" />
        </View>
      )}
    </View>
  )
  if (!g) return line
  return (
    <View>
      <Pressable
        onPress={() => onToggle(e.mi)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Shows his points breakdown"
        style={({ pressed }) => pressed && { backgroundColor: alpha(t.c.tint, 0.07) }}
      >
        {line}
      </Pressable>
      {open && (
        <View style={s.breakdown}>
          <View style={s.chips}>
            {g.pts.parts.map((x, i) => (
              <Chip key={i} label={`${x.label} ${x.pts > 0 ? '+' : ''}${fmt(x.pts)}`} tone={x.pts > 0 ? 'ok' : 'bad'} />
            ))}
          </View>
          <Pressable onPress={() => nav.match(e.mi)} hitSlop={8} accessibilityRole="link" style={({ pressed }) => [s.inline, pressed && { opacity: 0.5 }]}>
            <Icon name="list.bullet.rectangle" size={14} color={t.c.accent} />
            <Txt size={14} weight={600} tone="accent">Full scorecard</Txt>
            <Icon name="chevron.right" size={11} color={t.c.accent} weight="semibold" />
          </Pressable>
        </View>
      )}
    </View>
  )
})

const styles = (t: Theme) => ({
  hero: { flexDirection: 'row' as const, overflow: 'hidden' as const },
  side: { width: PHOTO_W },
  backdrop: { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 },
  band: { position: 'absolute' as const, top: -140, height: 560, transform: [{ rotate: '26deg' }] },
  ring: {
    position: 'absolute' as const, right: -110, top: -150, width: 300, height: 300, borderRadius: 150,
    borderWidth: 22,
  },
  photoBox: { flex: 1, minHeight: 168, justifyContent: 'flex-end' as const, overflow: 'hidden' as const },
  logo: { position: 'absolute' as const, left: 10, top: 10, width: PHOTO_W - 20, height: PHOTO_W - 20, opacity: 0.32 },
  watermark: { position: 'absolute' as const, left: 8, top: 10, color: 'rgba(255, 255, 255, 0.1)', letterSpacing: -2 },
  photo: { width: PHOTO_W, height: 160 },
  noPhoto: {
    alignSelf: 'center' as const, marginBottom: 24, width: 88, height: 88, borderRadius: 44,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  plate: {
    alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingTop: 9, paddingBottom: 11,
    backgroundColor: HERO.plate, borderTopRightRadius: t.r.lg,
  },
  main: { flex: 1, minWidth: 0, gap: 10, paddingLeft: 14, paddingRight: 16, paddingTop: 28, paddingBottom: 2 },
  owner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingRight: 34 },
  facts: { flexDirection: 'row' as const },
  fact: { flex: 1, alignItems: 'flex-start' as const, gap: 2 },
  slots: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 4, marginTop: 3 },
  pill: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 7,
    height: 38, borderRadius: 999, backgroundColor: HERO.button, marginTop: 8,
  },
  close: {
    position: 'absolute' as const, top: 12, right: 12, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  tab: { flex: 1, alignItems: 'center' as const, paddingBottom: 10, paddingTop: 2 },
  track: { height: 3, borderRadius: 2, backgroundColor: t.c.line2 },
  indicator: { height: 3, borderRadius: 2, backgroundColor: t.c.accent },
  stepper: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  step: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: alpha(t.c.tint, 0.08),
  },
  projRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
  forecast: { gap: 2, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, backgroundColor: alpha(t.c.shade, 0.12) },
  line: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 22 },
  rule: { height: 1, backgroundColor: t.c.line2, marginVertical: 4 },
  outlook: { gap: 12, padding: 16 },
  tags: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  bullet: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 9 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 8 },
  report: { gap: 6, paddingHorizontal: 16, paddingVertical: 14 },
  reportActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 20, marginTop: 4 },
  take: { lineHeight: 20, marginTop: 4, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: t.c.accent },
  logRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 62, paddingHorizontal: 16, paddingVertical: 10 },
  gw: { width: 30, alignItems: 'center' as const },
  inline: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  stats: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, columnGap: 12, rowGap: 3 },
  breakdown: { gap: 12, paddingLeft: 58, paddingRight: 16, paddingBottom: 14, backgroundColor: alpha(t.c.shade, 0.12) },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, paddingTop: 12 },
})
