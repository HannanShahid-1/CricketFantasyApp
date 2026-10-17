import { Image } from 'expo-image'
import { View } from 'react-native'
import { type Competition } from '@/data/competitions'
import { useTheme } from '@/theme/theme'

/** A consistent dark backing keeps the official white wordmarks readable in every theme. */
export function CompetitionLogo({ competition, width = 96, height = 56 }: { competition: Competition; width?: number; height?: number }) {
  const t = useTheme()
  return (
    <View style={{ width, height, borderRadius: 10, backgroundColor: t.c.teamInk, padding: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={competition.logo} contentFit="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel={`${competition.short} logo`} />
    </View>
  )
}
