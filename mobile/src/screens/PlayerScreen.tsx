import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { memo, useCallback, useMemo, useState, type ReactNode } from 'react'
import { Alert, LayoutAnimation, Linking, Pressable, ScrollView, View } from 'react-native'
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
import { PHOTOS } from '@/generated/photos'
import { intParam, nav } from '@/nav'
import { alpha, mix, useStyles, useTheme, type Theme } from '@/theme/theme'
import {
  Button, Chip, type ChipTone, confirm, EmptyState, GroupHeader, GroupNote, haptic, Icon, report, Row, RowIcon, Section,
  Segmented, type SFSymbol, SlotBadge, StatGrid, TeamBadge, TeamTag, Tiles, type Tone, Txt,
} from '@/ui'

// The player card: a team-branded hero with his photo, who owns him and what you can do about it, and which match
// counts this week (your players). Below that, three tabs: Overview (season numbers, weekly projections, profile),
// Outlook (start/bench opinion, scouting profile, match previews and recaps) and the full game log. Opens from every
// player row, and from the draft room.

type Tab = 'overview' | 'outlook' | 'log'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'outlook', label: 'Outlook' },
  { key: 'log', label: 'Game log' },
]

export function PlayerScreen() {
  const pid = intParam(useLocalSearchParams<{ id: string }>().id)
  const [league, closeAfter] = useSheetLeague()
  const [tab, setTab] = useState<Tab>('overview')
  const t = useTheme()
  const bottom = useSafeAreaInsets().bottom
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
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingBottom: bottom + 32 }}
    >
      <Hero p={p} />
      <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 24 }}>
        {league && <Ownership p={p} league={league} closeAfter={closeAfter} />}
        {league && <ThisWeek p={p} league={league} />}
        <Segmented options={TABS} value={tab} onChange={setTab} />
        {tab === 'overview' && (
          <>
            <Season p={p} played={played} />
            <Projections p={p} league={league} played={played} />
            <Profile p={p} />
          </>
        )}
        {tab === 'outlook' && <Outlook p={p} league={league} played={played} />}
        {tab === 'log' && <GameLog p={p} played={played} />}
      </View>
    </ScrollView>
  )
}

// ---------------------------------------------------------------- hero

// The hero is the one team-branded block in the app: the IPL team's own colours behind his photo, with white type
// over a dark scrim so it reads the same in every theme.
const HERO = {
  height: 300,
  ink: '#fff',
  soft: 'rgba(255, 255, 255, 0.82)',
  base: '#0b1017',
  fallback: { color: '#33404d', accent: '#5b6876' },
}

function Hero({ p }: { p: Player }) {
  const s = useStyles(styles)
  const code = p.team || p.profileTeam || ''
  const team = getData().teams[code]
  const { color, accent } = team ?? HERO.fallback
  const photo = PHOTOS[p.id]
  return (
    <View
      style={[s.hero, {
        backgroundColor: color,
        experimental_backgroundImage:
          `radial-gradient(circle at 74% 36%, rgba(255, 255, 255, 0.2) 0%, transparent 55%), ` +
          `linear-gradient(160deg, ${color} 0%, ${mix(color, HERO.base, 0.5)} 100%)`,
      }]}
    >
      {!!code && <Txt display weight={700} size={128} numberOfLines={1} style={s.watermark}>{code}</Txt>}
      {photo ? (
        <Image source={photo} style={s.photo} contentFit="contain" contentPosition="bottom" transition={160} accessibilityLabel={p.fullName} />
      ) : (
        <View style={s.noPhoto}><Txt display weight={700} size={64} style={{ color: HERO.soft }}>{initials(p.name)}</Txt></View>
      )}
      <View style={s.scrim} />
      <View style={s.heroText}>
        <Txt display weight={700} size={31} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} style={s.heroName} accessibilityRole="header">
          {p.fullName}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <View style={[s.swatch, { backgroundColor: accent }]} />
          <Txt size={14} weight={600} numberOfLines={1} style={{ color: HERO.soft, flexShrink: 1 }}>
            {team?.name ?? 'No IPL team'} · {ROLE_NAME[p.role]}
          </Txt>
        </View>
      </View>
      <View style={[s.stripe, { backgroundColor: accent }]} />
      <Pressable onPress={nav.close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [s.close, pressed && { opacity: 0.6 }]}>
        <Icon name="xmark" size={13} weight="bold" color={HERO.ink} />
      </Pressable>
    </View>
  )
}

// ---------------------------------------------------------------- ownership and actions

function Ownership({ p, league, closeAfter }: { p: Player; league: League; closeAfter: () => void }) {
  const t = useTheme()
  const drop = useApp((s) => s.drop)
  const d = getData()
  const owners = ownersOf(league)
  const owner = owners.get(p.idx)
  const team = owner !== undefined ? league.teams[owner] : null
  const season = league.phase === 'season'

  const onDrop = async () => {
    if (!(await confirm({ title: `Drop ${p.name}?`, message: 'He goes on waivers.', ok: 'Drop', destructive: true }))) return
    if (report(drop(p.idx), `Dropped ${p.name}`)) closeAfter()
  }

  let left: ReactNode
  let title: string
  let subtitle: string
  let action: ReactNode = null
  if (team) {
    const mine = team.isUser
    const locked = season && mine && isLocked(d, league, p.idx)
    const starting = team.starters.includes(p.idx)
    left = <TeamBadge team={team} size={36} />
    title = mine ? 'On your team' : team.name
    if (league.phase === 'draft') subtitle = mine ? 'You drafted him' : `Drafted by ${managerName(team)}`
    else if (mine) subtitle = !season ? team.name : locked ? 'Locked: his match this week has started' : starting ? 'In your starting XI' : 'On your bench'
    else subtitle = `${managerName(team)} · ${recordOf(league, team.id)}${season ? (starting ? ' · Starting' : ' · On the bench') : ''}`
    if (season && mine && !locked) action = <Button title="Drop" icon="trash" kind="destructive" onPress={onDrop} />
    if (season && !mine) {
      // the trade sheet replaces the card, so sending the offer can go straight to the chat
      action = <Button title="Trade" icon="arrow.left.arrow.right" kind="tinted" onPress={() => { nav.close(); nav.trade(team.id) }} />
    }
  } else if (league.phase === 'draft') {
    left = <RowIcon name="person.crop.circle.badge.plus" color={t.c.muted} />
    title = 'Available'
    subtitle = 'Not drafted yet'
  } else {
    const mode = addMode(d, league, p.idx, owners)
    const claim = league.claims.find((c) => c.teamId === ME && c.add === p.idx)
    const waiver = mode === 'waiver'
    left = <RowIcon name={waiver ? 'hourglass' : 'person.crop.circle.badge.plus'} color={waiver ? t.c.gold : t.c.accent} />
    title = waiver ? 'On waivers' : 'Free agent'
    subtitle = claim ? `Your $${claim.bid} claim is in` : waiver ? 'Claims are processed when the week ends' : season ? 'Add him straight to your roster' : 'Not on a roster'
    if (mode !== 'none') action = <Button title={waiver ? 'Claim' : 'Add'} icon="plus" kind="filled" onPress={() => nav.add(p.idx)} />
  }

  return (
    <Section inset={64}>
      <Row left={<View style={{ width: 36, alignItems: 'center' }}>{left}</View>} title={title} subtitle={subtitle} right={action} />
      <Row
        left={<View style={{ width: 36, alignItems: 'center' }}><RowIcon name="square.grid.2x2" color={t.c.muted} /></View>}
        title="Eligible"
        right={<View style={{ flexDirection: 'row', gap: 5 }}>{p.elig.map((e) => <SlotBadge key={e} slot={e} />)}</View>}
      />
    </Section>
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
      footer={n > 1 ? 'Only one counts. His first match counts unless you lock in another before it starts.' : 'He has one match this week, so it counts.'}
    >
      <View style={{ padding: 14 }}><MatchPicker pid={p.idx} /></View>
    </Section>
  )
}

// ---------------------------------------------------------------- overview: season numbers

function Season({ p, played }: { p: Player; played: number }) {
  const d = getData()
  const { season, ranks, stats, last3 } = useMemo(() => {
    const profile = scoutingProfile(d, p, played)
    return {
      season: seasonToDate(p, played),
      ranks: playerRanks(d, p, played),
      stats: playerSeasonStats(d, p, played).stats.map(([label, value]) => ({ label, value })),
      last3: profile.currentApps >= 3 ? profile.recentAverage : null,
    }
  }, [d, p, played])
  const rank = (n: number | null) => (n ? `#${n}` : '–')
  return (
    <View>
      <GroupHeader title={`IPL ${d.raw.simSeason} season`} />
      <View style={{ gap: 8 }}>
        <Tiles
          items={[
            { label: 'Total FPTS', value: fmt(season.pts, 1), tone: 'accent' },
            { label: 'FPTS / game', value: season.apps ? fmt(season.avg, 1) : '–' },
            { label: 'Matches', value: String(season.apps) },
            { label: `${ROLE_LABEL[p.role]} rank`, value: rank(ranks.role) },
            { label: 'Overall rank', value: rank(ranks.overall) },
            { label: 'Last 3 avg', value: last3 !== null ? fmt(last3, 1) : '–' },
          ]}
        />
        <StatGrid items={stats} columns={stats.length === 4 ? 2 : 3} />
      </View>
      <GroupNote>
        {season.apps
          ? `Ranks are by total FPTS, among ${ROLE_NAME[p.role].toLowerCase()}s and among all players; ties share a rank. `
          : 'Ranks start once he plays. '}
        Last 3 avg is his FPTS per game over his last three matches.
      </GroupNote>
    </View>
  )
}

// ---------------------------------------------------------------- overview: weekly projections

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
      footer={rows.length ? 'Rough estimates, not promises. Tap a match to see what went into it.' : undefined}
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

// ---------------------------------------------------------------- overview: profile

function Profile({ p }: { p: Player }) {
  const t = useTheme()
  const bio = p.bio
  const age = bio ? playerAge(bio.birthDate) : null
  const item = (icon: SFSymbol, color: string, title: string, value: string | null | undefined) => (
    <Row
      left={<RowIcon name={icon} color={color} />}
      title={title}
      right={<Txt size={15} tone={value ? 'muted' : 'dim'} numberOfLines={2} style={{ maxWidth: '62%', textAlign: 'right' }}>{value || 'Not listed'}</Txt>}
    />
  )
  const openSource = (url: string) => Linking.openURL(url).catch(() => report("Couldn't open the profile link."))
  return (
    <Section title="Profile" inset={58}>
      {item('birthday.cake', t.c.gold, 'Age', age !== null ? `${age} years` : null)}
      {item('globe', t.c.sky, 'Nationality', bio?.nationality)}
      {item('figure.cricket', t.c.bat, 'Batting', bio?.battingStyle)}
      {item('cricket.ball', t.c.bowl, 'Bowling', bio?.bowlingStyle)}
      {bio?.source && (
        <Row
          left={<RowIcon name="safari" color={t.c.accent} />}
          title="Profile source"
          right={<Icon name="arrow.up.right" size={13} color={t.c.dim} weight="semibold" />}
          onPress={() => openSource(bio.source)}
        />
      )}
    </Section>
  )
}

// ---------------------------------------------------------------- outlook

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
        footer={advice.tier
          ? `${advice.tier} is his tier among ${ROLE_NAME[p.role].toLowerCase()}s by expected FPTS: ${size} players per tier, one for each team in this league.`
          : undefined}
      >
        <View style={s.outlook}>
          <View style={s.tags}>
            <Chip label={advice.recommendation} tone={REC_TONE[advice.recommendation]} />
            {advice.tier && <Chip label={advice.tier} />}
          </View>
          <View style={{ gap: 2 }}>
            <Txt display weight={700} size={17}>{identity}</Txt>
            <Txt size={13} tone="muted">
              {profile.sampleSize} IPL {profile.sampleSize === 1 ? 'appearance' : 'appearances'} on record{profile.limited ? ' · limited history' : ''}
            </Txt>
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
      <Section title="Player updates" footer="Automated summaries of the ball-by-ball data. A replay, not live news.">
        {reports.length
          ? reports.map((r) => <ReportRow key={r.key} r={r} name={p.fullName} />)
          : <Row title="No updates yet" subtitle="He isn't in an IPL squad this season." />}
      </Section>
    </>
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
      footer={log.some((e) => e.game) ? 'Tap a match he played to see where his points came from.' : undefined}
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
  hero: { height: HERO.height, overflow: 'hidden' as const },
  watermark: { position: 'absolute' as const, left: 14, top: 6, color: 'rgba(255, 255, 255, 0.09)', letterSpacing: -3 },
  photo: { position: 'absolute' as const, right: -12, bottom: 0, width: 290, height: 290 },
  noPhoto: {
    position: 'absolute' as const, right: 36, top: 40, width: 150, height: 150, borderRadius: 75,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  scrim: {
    position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: 170,
    experimental_backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.6) 100%)',
  },
  heroText: { position: 'absolute' as const, left: 20, right: 20, bottom: 22, gap: 6 },
  heroName: { color: HERO.ink, lineHeight: 35, textShadowColor: 'rgba(0, 0, 0, 0.35)', textShadowRadius: 10 },
  swatch: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.6)' },
  stripe: { position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: 4 },
  close: {
    position: 'absolute' as const, top: 14, right: 14, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
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
