import { View } from 'react-native'
import { managerName, type FTeam } from '@shared/engine/league'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Icon, Seam, TeamBadge, Txt } from '@/ui'

/** The league champion, once the final is played (Matchup in the final week, and Playoffs). */
export function ChampionCard({ team }: { team: FTeam }) {
  const t = useTheme()
  const s = useStyles(styles)
  return (
    <View style={s.card}>
      <Icon name="trophy.fill" size={34} color={t.c.gold} />
      <Txt up size={12} weight={700} tone="gold">League champion</Txt>
      <Seam style={{ alignSelf: 'stretch' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TeamBadge team={team} size={44} />
        <Txt display weight={700} size={24} numberOfLines={1} style={{ flexShrink: 1 }}>{team.name}</Txt>
      </View>
      <Txt tone="muted" size={14}>{team.isUser ? 'You won the league. Take a lap of honour. 🏆' : `${managerName(team)} lifts the trophy.`}</Txt>
    </View>
  )
}

const styles = (t: Theme) => ({
  card: {
    alignItems: 'center' as const, gap: 10, padding: 22, borderRadius: t.r.lg,
    backgroundColor: alpha(t.c.gold, 0.08), borderWidth: 1, borderColor: alpha(t.c.gold, 0.3),
  },
})
