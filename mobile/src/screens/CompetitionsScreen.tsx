import { Stack } from 'expo-router'
import { Pressable, View } from 'react-native'
import { getData } from '@shared/store'
import { CompetitionLogo } from '@/components/CompetitionLogo'
import { COMPETITIONS, IPL } from '@/data/competitions'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Chip, Icon, Screen, Txt } from '@/ui'

export function CompetitionsScreen() {
  const t = useTheme()
  const s = useStyles(styles)
  return (
    <>
      <Stack.Screen options={{ title: 'Choose tournament', unstable_headerRightItems: () => [{ type: 'button', label: 'Done', onPress: nav.close }] }} />
      <Screen gap={22}>
        <View style={{ gap: 5, paddingHorizontal: 2 }}>
          <Txt display size={25} weight={700}>Pick your competition.</Txt>
          <Txt size={14} tone="muted">One home for every cricket season.</Txt>
        </View>
        <View style={{ gap: 9 }}>
          <Txt up weight={600} tone="muted" size={12}>Available now</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={`Create an IPL ${getData().raw.simSeason} league`} onPress={nav.setupIpl} style={({ pressed }) => [s.available, { opacity: pressed ? 0.75 : 1 }]}>
            <CompetitionLogo competition={IPL} width={88} height={60} />
            <View style={{ flex: 1, gap: 5 }}>
              <Txt display size={20} weight={700}>IPL {getData().raw.simSeason}</Txt>
              <Txt size={12} tone="muted">India · T20</Txt>
              <Txt size={12} weight={600} tone="accent">Create league</Txt>
            </View>
            <Icon name="chevron.right" size={15} color={t.c.accent} />
          </Pressable>
        </View>
        <View style={{ gap: 10 }}>
          <Txt up weight={600} tone="muted" size={12}>More cricket, coming soon</Txt>
          <View style={s.grid}>
            {COMPETITIONS.filter((c) => !c.available).map((competition) => (
              <View key={competition.id} accessible accessibilityLabel={`${competition.name}. Coming soon.`} accessibilityState={{ disabled: true }} style={s.future}>
                <CompetitionLogo competition={competition} width={112} height={60} />
                <View style={{ alignItems: 'center', gap: 3 }}>
                  <Txt weight={600} size={15} numberOfLines={1}>{competition.short}</Txt>
                  <Txt size={11} tone="muted">{competition.region} · {competition.format}</Txt>
                </View>
                <View><Chip label="COMING SOON" tone="neutral" /></View>
              </View>
            ))}
          </View>
        </View>
      </Screen>
    </>
  )
}
const styles = (t: Theme) => ({
  available: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, padding: 14, backgroundColor: t.c.panel, borderRadius: t.r.lg, borderWidth: 1, borderColor: alpha(t.c.accent, 0.3) },
  grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12 },
  future: { flexBasis: '46%' as const, flexGrow: 1, minWidth: 140, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 15, gap: 12, backgroundColor: t.c.panel, borderRadius: t.r.lg, borderWidth: 1, borderColor: t.c.line2 },
})
