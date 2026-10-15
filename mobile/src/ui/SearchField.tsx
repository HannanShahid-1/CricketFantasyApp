import { TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import { alpha, useTheme } from '@/theme/theme'
import { Icon } from './Icon'

/** An inline iOS search field (for a list under a fixed header, where the header search bar doesn't fit). */
export function SearchField({ value, onChange, placeholder = 'Search', style }: {
  value: string; onChange: (q: string) => void; placeholder?: string; style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 9, borderRadius: 10, backgroundColor: alpha(t.c.tint, 0.08) }, style]}>
      <Icon name="magnifyingglass" size={15} color={t.c.dim} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.c.dim}
        selectionColor={t.c.accent}
        keyboardAppearance={t.dark ? 'dark' : 'light'}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        accessibilityRole="search"
        style={{ flex: 1, height: '100%', paddingRight: 6, color: t.c.text, fontFamily: t.font.body(400), fontSize: 16 }}
      />
    </View>
  )
}
