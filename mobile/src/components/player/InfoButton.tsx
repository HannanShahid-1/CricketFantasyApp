import { Alert, Pressable } from 'react-native'
import { useTheme } from '@/theme/theme'
import { Icon } from '@/ui'

/** ⓘ in a section header: the longer explanation in a native alert. */
export function InfoButton({ title, message }: { title: string; message: string }) {
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
