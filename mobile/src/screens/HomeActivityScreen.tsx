import { View } from 'react-native'
import { getData } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import { useLeagues } from '@/data/leagues'
import { openSavedLeague } from './HomeScreen'
import { EmptyState, Row, RowIcon, Screen, Section, Txt } from '@/ui'
import { useTheme } from '@/theme/theme'

export function HomeActivityScreen() {
  const t = useTheme()
  const saved = useLeagues((s) => s.leagues)
  const leagues = saved.filter((l) => l.dataVersion === getData().version)
  return (
    <Screen>
      {leagues.length ? leagues.map((l) => (
        <Section key={l.createdAt} title={l.name}>
          {l.txns.length ? l.txns.slice(0, 5).map((x) => (
            <Row key={x.id} title={`${l.teams[x.teamId].isUser ? 'You' : l.teams[x.teamId].name} · ${x.type === 'waiver-fail' ? 'Waiver claim missed' : x.type === 'autosub' ? 'Auto-sub' : x.type.charAt(0).toUpperCase() + x.type.slice(1)}`}
              subtitle={`${weekLabel(x.week)}${x.adds.length ? ` · ${x.adds.map((p) => getData().players[p].name).join(', ')}` : ''}`}
              left={<RowIcon name="arrow.left.arrow.right" color={t.c.accent} />} chevron onPress={() => void openSavedLeague(l.createdAt, 'activity')} />
          )) : <View style={{ padding: 18 }}><Txt size={14} tone="muted">No league moves yet.</Txt></View>}
        </Section>
      )) : <EmptyState icon="bell" title="You're all caught up" message="Your league activity will appear here." />}
    </Screen>
  )
}
