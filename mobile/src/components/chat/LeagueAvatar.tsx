import { View } from 'react-native'
import { alpha, useTheme } from '@/theme/theme'
import { Icon } from '@/ui'

/** The league channel's avatar: a cricket ball on an accent tile, shaped like a TeamBadge. */
export function LeagueAvatar({ size = 48 }: { size?: number }) {
  const t = useTheme()
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.28, backgroundColor: alpha(t.c.accent, 0.18),
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon name="cricket.ball.fill" size={size * 0.52} color={t.c.accent} />
    </View>
  )
}
