import type { ReactNode } from 'react'
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from '@/theme/theme'

/**
 * Scrolling page under a native large-title header. Insets for the header and tab bar are automatic, so content
 * scrolls under both (Liquid Glass) and the large title collapses on scroll.
 */
export function Screen({ children, gap = 24, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap }, style]}
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  )
}
