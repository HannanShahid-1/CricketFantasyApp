import { SymbolView, type SFSymbol } from 'expo-symbols'
import type { ColorValue, StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@/theme/theme'

export type { SFSymbol }

/** An SF Symbol, tinted with a theme colour (default: muted). */
export function Icon({ name, size = 17, color, weight = 'medium', style }: {
  name: SFSymbol; size?: number; color?: ColorValue; weight?: 'regular' | 'medium' | 'semibold' | 'bold'; style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  return <SymbolView name={name} size={size} weight={weight} tintColor={color ?? t.c.muted} style={[{ width: size, height: size }, style]} />
}
