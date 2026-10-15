import { ActionSheetIOS } from 'react-native'
import { haptic } from './feedback'

/**
 * Pick one of several options from a native action sheet (for choices too long for a segmented control, e.g. a
 * draft slot or an IPL team). The current choice is marked with a check.
 */
export function chooseOption<T>({ title, message, options, value, tint, onChoose }: {
  title: string
  message?: string
  options: { value: T; label: string }[]
  value: T
  tint: string
  onChoose: (v: T) => void
}) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      message,
      options: [...options.map((o) => (o.value === value ? `${o.label}  ✓` : o.label)), 'Cancel'],
      cancelButtonIndex: options.length,
      tintColor: tint,
    },
    (i) => {
      if (i >= options.length || options[i].value === value) return
      haptic.select()
      onChoose(options[i].value)
    },
  )
}
