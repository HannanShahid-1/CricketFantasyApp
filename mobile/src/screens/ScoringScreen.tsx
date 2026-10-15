import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { ROLE_NAME } from '@shared/engine/data'
import { fmt, SCORING_RULES } from '@shared/engine/scoring'
import type { Role } from '@shared/engine/types'
import { getData, useApp } from '@shared/store'
import { fmtDate } from '@shared/ui/format'
import type { RoleFilter } from '@shared/ui/playerList'
import { scoringStats, type Appearance } from '@shared/ui/scoringStats'
import { RolePills } from '@/components/RolePills'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { EmptyState, GroupHeader, PlayerLine, PlayerLink, roleColor, Row, RowIcon, Screen, Section, type SFSymbol, Tiles, Txt } from '@/ui'

// How points are scored, the one-match-a-week rule, and how the rules have played out so far this season. Stats only
// use matches already played in the league, so nothing here gives away results still to come.

const RULE_GROUPS: { key: keyof typeof SCORING_RULES; title: string }[] = [
  { key: 'batting', title: 'Batting' },
  { key: 'bowling', title: 'Bowling' },
  { key: 'fielding', title: 'Fielding' },
]

const WEEK_RULES: { icon: SFSymbol; title: string; text: string }[] = [
  {
    icon: '1.circle.fill',
    title: 'One match counts each week',
    text: 'If a player has two matches in a gameweek, his first one counts unless you lock in the other on My Team or his player card.',
  },
  {
    icon: 'lock.fill',
    title: 'Choose before he plays',
    text: "You have to choose before his first match starts. After that the choice is closed.",
  },
  {
    icon: 'pin.fill',
    title: 'Fixed once his match starts',
    text: "A player is fixed in your lineup once the match that counts for him begins, so a bench player whose match has been played can't be moved in.",
  },
  {
    icon: 'arrow.triangle.2.circlepath',
    title: 'Auto-sub',
    text: "If he isn't in the XI for his counting match, auto-sub swaps in a bench player whose own counting match hasn't started.",
  },
]

const ROLES: Role[] = ['WK', 'BAT', 'ARB', 'ARW', 'BOWL']
const inFilter = (role: Role, f: RoleFilter) => f === 'ALL' || (f === 'AR' ? role === 'ARB' || role === 'ARW' : role === f)
/** an average this high fills the role bar */
const BAR_MAX = 25
const TOP_N = 8

export function ScoringScreen() {
  const t = useTheme()
  const d = getData()
  const played = useApp((s) => s.league!.played)
  const stats = useMemo(() => scoringStats(d, played), [d, played])
  const [filter, setFilter] = useState<RoleFilter>('ALL')
  const top = useMemo(
    () => stats.apps.filter((x) => inFilter(d.players[x.p].role, filter)).slice(0, TOP_N),
    [d, stats, filter],
  )

  return (
    <Screen>
      <Txt tone="muted" size={14}>Option 1 · Standard: football-sized decimal scoring.</Txt>
      <Section title="How weeks work" inset={58}>
        {WEEK_RULES.map((r) => (
          <Row
            key={r.title}
            left={<RowIcon name={r.icon} color={t.c.accent} />}
            title={r.title}
            subtitle={<Txt size={13} tone="muted" style={{ lineHeight: 18 }}>{r.text}</Txt>}
            style={{ alignItems: 'flex-start' }}
          />
        ))}
      </Section>
      {RULE_GROUPS.map((g) => (
        <Section key={g.key} title={g.title}>
          {SCORING_RULES[g.key].map(([label, value]) => <RuleRow key={label} label={label} value={value} />)}
        </Section>
      ))}

      {stats.apps.length === 0 ? (
        <EmptyState icon="chart.bar" title="No matches played yet" message="Once the season starts, this shows how the rules have played out." />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <GroupHeader title={`IPL ${d.raw.simSeason} so far`} />
            <Tiles
              items={[
                { label: 'Median score', value: fmt(stats.median, 1), tone: 'accent' },
                { label: 'Player-matches', value: String(stats.apps.length) },
                { label: 'Matches', value: String(played) },
              ]}
            />
          </View>
          <Section title="Average by role" footer="Points per appearance.">
            {ROLES.filter((r) => stats.byRole[r]).map((r) => <RoleAverage key={r} role={r} avg={stats.byRole[r]!.avg} />)}
          </Section>
          <View style={{ gap: 8 }}>
            <GroupHeader title="Biggest single-match scores" />
            <RolePills value={filter} onChange={setFilter} fill />
            <Section inset={16 + 36 + 12}>
              {top.length ? top.map((x) => <TopScore key={`${x.p}-${x.mi}`} x={x} />) : [<Row key="none" title="No appearances yet" />]}
            </Section>
          </View>
        </>
      )}
    </Screen>
  )
}

/**
 * A scoring rule. Tiered rules ("200+ +3 · 170–199 +2 · …") list their tiers as capsules under the label;
 * the rest show their points on the right.
 */
function RuleRow({ label, value }: { label: string; value: string }) {
  const s = useStyles(styles)
  const tiers = value.includes(' · ') ? value.split(' · ').map((x) => {
    const i = x.lastIndexOf(' ')
    return { when: x.slice(0, i), pts: x.slice(i + 1) }
  }) : null
  if (!tiers) {
    return (
      <Row
        title={<Txt size={15} style={{ flexShrink: 1 }}>{label}</Txt>}
        right={<Txt num weight={700} size={14.5} tone="accent" style={{ maxWidth: '50%', textAlign: 'right' }}>{value}</Txt>}
      />
    )
  }
  return (
    <Row title={<Txt size={15}>{label}</Txt>}>
      <View style={s.tiers}>
        {tiers.map((x) => (
          <View key={x.when} style={s.tier}>
            <Txt size={12} tone="muted">{x.when}</Txt>
            <Txt num weight={700} size={12.5} tone={x.pts.startsWith('−') ? 'loss' : x.pts === '0' ? 'dim' : 'accent'}>{x.pts}</Txt>
          </View>
        ))}
      </View>
    </Row>
  )
}

function RoleAverage({ role, avg }: { role: Role; avg: number }) {
  const t = useTheme()
  const s = useStyles(styles)
  const color = roleColor(t, role)
  return (
    <Row
      title={<Txt size={15} numberOfLines={1}>{ROLE_NAME[role]}</Txt>}
      right={
        <>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.min(100, (avg / BAR_MAX) * 100)}%`, backgroundColor: color }]} />
          </View>
          <Txt num weight={700} size={15} style={{ width: 40, textAlign: 'right' }}>{fmt(avg, 1)}</Txt>
        </>
      }
    />
  )
}

function TopScore({ x }: { x: Appearance }) {
  const s = useStyles(styles)
  const d = getData()
  const p = d.players[x.p]
  const m = d.matches[x.mi]
  const opp = m.teams[0] === p.team ? m.teams[1] : m.teams[0]
  return (
    <PlayerLink pid={p.idx} style={s.top}>
      <PlayerLine
        p={p}
        size={36}
        sub={`v ${opp} · ${fmtDate(m.raw.date, false)}`}
        right={<Txt num weight={700} size={19} tone="accent">{fmt(x.pts)}</Txt>}
      />
    </PlayerLink>
  )
}

const styles = (t: Theme) => ({
  tiers: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginTop: 6 },
  tier: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, height: 24, paddingHorizontal: 8, borderRadius: 7, backgroundColor: alpha(t.c.tint, 0.06) },
  track: { width: 90, height: 6, borderRadius: 3, overflow: 'hidden' as const, backgroundColor: alpha(t.c.tint, 0.1) },
  fill: { height: '100%' as const, borderRadius: 3 },
  top: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 56, justifyContent: 'center' as const },
})
