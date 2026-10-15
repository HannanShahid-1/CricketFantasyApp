import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApp } from '@shared/store'
import { useTheme } from '@/theme/theme'
import { Icon } from './Icon'
import { Txt } from './text'

const SHOW_MS = 2600

/** Shows the store's `notify()` messages as a banner that drops in under the Dynamic Island. */
export function ToastHost() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const toast = useApp((s) => s.toast)
  const [shown, setShown] = useState(toast)
  const y = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!toast) return
    setShown(toast)
    y.setValue(0)
    const anim = Animated.sequence([
      Animated.spring(y, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
      Animated.delay(SHOW_MS),
      Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }),
    ])
    // unmount once it has faded: an invisible banner would still catch taps on the header under it
    anim.start(({ finished }) => finished && setShown(null))
    return () => anim.stop()
  }, [toast, y])

  if (!shown) return null
  const color = shown.tone === 'bad' ? t.c.loss : shown.tone === 'info' ? t.c.sky : t.c.win
  const icon = shown.tone === 'bad' ? 'exclamationmark.circle.fill' : shown.tone === 'info' ? 'info.circle.fill' : 'checkmark.circle.fill'
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', left: 16, right: 16, top: insets.top + 6, alignItems: 'center',
        opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
      }}
    >
      <Pressable
        onPress={() => setShown(null)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 520, paddingVertical: 12, paddingHorizontal: 16,
          borderRadius: 18, backgroundColor: t.c.panel3, borderWidth: 1, borderColor: t.c.line2,
          shadowColor: t.c.shade, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
        }}
      >
        <Icon name={icon} size={18} color={color} />
        <Txt size={14} weight={600} style={{ flexShrink: 1 }}>{shown.text}</Txt>
      </Pressable>
    </Animated.View>
  )
}
