import { View } from 'react-native'
import { ROLE_FILTERS, type RoleFilter } from '@shared/ui/playerList'
import { useTheme } from '@/theme/theme'
import { Pill, roleColor } from '@/ui'

/**
 * Role filter pills (All, WK, BAT, AR, BOWL), each tinted in its role's colour when selected. `fill` lays them out as
 * a full-width row of equal pills (lines up with a Segmented above it); otherwise they go inside the caller's row.
 */
export function RolePills({ value, onChange, fill }: { value: RoleFilter; onChange: (r: RoleFilter) => void; fill?: boolean }) {
  const t = useTheme()
  const pills = ROLE_FILTERS.map((r) => (
    <Pill
      key={r}
      label={r === 'ALL' ? 'All' : r}
      on={value === r}
      color={r === 'ALL' ? t.c.text : roleColor(t, r === 'AR' ? 'ARB' : r)}
      onPress={() => onChange(r)}
      style={fill && { flex: 1, paddingHorizontal: 0 }}
    />
  ))
  return fill ? <View style={{ flexDirection: 'row', gap: 6 }}>{pills}</View> : pills
}
