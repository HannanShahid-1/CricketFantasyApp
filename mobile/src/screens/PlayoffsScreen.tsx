import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { LAST_WEEK, managerName, REG_WEEKS } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, useApp } from '@shared/store'
import { playoffBracket, type BracketGame, type BracketSlot } from '@shared/ui/bracket'
import { fmtDate, weekLabel } from '@shared/ui/format'
import { useGameLeague } from '@/data/gameLeague'
import { nav } from '@/nav'
import { alpha, mix, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Chip, GroupHeader, Icon, Screen, TeamBadge, Txt } from '@/ui'

// The playoff bracket: semifinals, then the final (gold), 3rd place, and the consolation games. Projected from the
// standings until the regular season ends. Tap a game that's been set to open its week in Matchup.

export function PlayoffsScreen() {
  const league = useGameLeague()!
  const b = useMemo(() => playoffBracket(getData(), league), [league])
  const [sf1, sf2, final, third] = b.championship

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        {!b.seeded && <Chip label="PROJECTED" tone="gold" icon="sparkles" />}
        <Txt tone="muted" size={14} style={{ lineHeight: 20 }}>
          {b.seeded
            ? `Semifinals in Week ${REG_WEEKS + 1}, the final in Week ${LAST_WEEK}.`
            : `If the season ended today${b.weeksPlayed ? ` (after ${weekLabel(b.weeksPlayed)})` : ''}. The top four after ${weekLabel(REG_WEEKS)} make the semifinals.`}
        </Txt>
      </View>
      {league.champion !== null && <Champion teamId={league.champion} />}
      <View>
        <GroupHeader title="Championship" />
        <View style={{ gap: 10 }}>
          <GameCard g={sf1} />
          <GameCard g={sf2} />
          <Advance />
          <GameCard g={final} />
          <GameCard g={third} />
        </View>
      </View>
      <View>
        <GroupHeader title="Consolation" />
        <View style={{ gap: 10 }}>
          {b.consolation.map((g) => <GameCard key={g.label} g={g} />)}
        </View>
      </View>
    </Screen>
  )
}

/** The link between the semifinals and the final. */
function Advance() {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 2 }}>
      <Icon name="arrow.down" size={11} color={t.c.dim} weight="semibold" />
      <Txt size={12} tone="dim">Winners meet in the final</Txt>
    </View>
  )
}

function Champion({ teamId }: { teamId: number }) {
  const s = useStyles(styles)
  const t = useTheme()
  const team = useApp((st) => st.league!.teams[teamId])
  return (
    <View style={s.champion}>
      <Icon name="trophy.fill" size={34} color={t.c.gold} />
      <Txt up size={12} weight={700} tone="gold">League champion</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TeamBadge team={team} size={44} />
        <Txt display weight={700} size={24} numberOfLines={1} style={{ flexShrink: 1 }}>{team.name}</Txt>
      </View>
      <Txt tone="muted" size={14}>{team.isUser ? 'You won the league.' : `${managerName(team)} lifts the trophy.`}</Txt>
    </View>
  )
}

/** One playoff game: label, status, and both sides with seeds and scores. */
function GameCard({ g }: { g: BracketGame }) {
  const t = useTheme()
  const s = useStyles(styles)
  const gold = g.decidesTitle
  const gw = getData().gameweeks[g.week - 1]
  const body = (
    <>
      <View style={s.head}>
        <Txt up size={11.5} weight={700} numberOfLines={1} style={{ flex: 1, color: gold ? t.c.gold : t.c.muted }}>
          {g.label} · {fmtDate(gw.start, false)} – {fmtDate(gw.end, false)}
        </Txt>
        {g.status === 'final' ? <Chip label="FINAL" /> : g.status === 'live' ? <Chip label="LIVE" tone="live" /> : null}
        {g.m && <Icon name="chevron.right" size={12} color={t.c.dim} weight="semibold" />}
      </View>
      <Side slot={g.a} g={g} />
      <View style={s.sep} />
      <Side slot={g.b} g={g} />
    </>
  )
  const style = [s.card, gold && s.gold]
  if (!g.m) return <View style={style}>{body}</View>
  return (
    <Pressable
      onPress={() => nav.week(g.week)}
      style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityHint={`Opens ${weekLabel(g.week)} in Matchup`}
    >
      {body}
    </Pressable>
  )
}

function Side({ slot, g }: { slot: BracketSlot; g: BracketGame }) {
  const t = useTheme()
  const s = useStyles(styles)
  const league = useGameLeague()!
  const team = slot.teamId !== null ? league.teams[slot.teamId] : null
  const won = g.winner !== null && g.winner === slot.teamId
  const lost = g.winner !== null && !won
  return (
    <View style={[s.side, lost && { opacity: 0.5 }]}>
      <Txt num weight={700} size={13} tone="dim" style={s.seed}>{team ? slot.seed : ''}</Txt>
      {team ? <TeamBadge team={team} size={32} /> : <View style={s.placeholder} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        {team ? (
          <>
            <Txt display weight={700} size={15.5} numberOfLines={1}>{team.name}</Txt>
            <Txt size={12} tone={team.isUser ? 'accent' : 'dim'} weight={team.isUser ? 600 : 400}>{team.isUser ? 'You' : managerName(team)}</Txt>
          </>
        ) : (
          <Txt size={15} tone="dim">{slot.placeholder ?? 'TBD'}</Txt>
        )}
      </View>
      {won && <Icon name={g.decidesTitle ? 'trophy.fill' : 'checkmark.circle.fill'} size={14} color={g.decidesTitle ? t.c.gold : t.c.win} />}
      {slot.score !== null && (
        <Txt num weight={700} size={19} style={{ color: won ? (g.decidesTitle ? t.c.gold : t.c.accent) : t.c.text }}>{fmt(slot.score, 1)}</Txt>
      )}
    </View>
  )
}

const styles = (t: Theme) => ({
  card: { backgroundColor: t.c.panel, borderRadius: t.r.lg, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 4 },
  gold: { backgroundColor: mix(t.c.gold, t.c.panel, 0.07), borderWidth: 1, borderColor: alpha(t.c.gold, 0.4) },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingBottom: 4 },
  side: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 52, paddingVertical: 6 },
  seed: { width: 16, textAlign: 'center' as const },
  placeholder: { width: 32, height: 32, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: t.c.line2 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 16 + 10 + 32 + 10, backgroundColor: t.c.line2 },
  champion: {
    alignItems: 'center' as const, gap: 10, padding: 22, borderRadius: t.r.lg,
    backgroundColor: alpha(t.c.gold, 0.08), borderWidth: 1, borderColor: alpha(t.c.gold, 0.3),
  },
})
