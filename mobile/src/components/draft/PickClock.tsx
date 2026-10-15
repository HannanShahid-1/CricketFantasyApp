import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import { alpha, useTheme } from '@/theme/theme'
import { Txt } from '@/ui'

/**
 * Your pick countdown: a ring that drains over the pick timer with the seconds left in the middle. The ticking state
 * lives here so the draft room doesn't re-render every second; give it a `key` per pick so each pick restarts it.
 * `paused` freezes it; `onExpire` runs once when it reaches zero.
 */
export function PickClock({ total, paused, onExpire, size = 50, stroke = 4.5 }: {
  total: number; paused: boolean; onExpire: () => void; size?: number; stroke?: number
}) {
  const t = useTheme()
  const [left, setLeft] = useState(total)
  const progress = useRef(new Animated.Value(1)).current
  const expired = useRef(false)

  useEffect(() => {
    if (paused) return
    if (left <= 0) {
      if (!expired.current) {
        expired.current = true
        onExpire()
      }
      return
    }
    // drain the ring smoothly through this second, then tick the label
    const anim = Animated.timing(progress, { toValue: (left - 1) / total, duration: 1000, easing: Easing.linear, useNativeDriver: true })
    anim.start()
    const id = setTimeout(() => setLeft((x) => x - 1), 1000)
    return () => {
      clearTimeout(id)
      anim.stop()
    }
  }, [left, paused, total, progress, onExpire])

  const urgent = left <= 10
  const color = urgent ? t.c.live : t.c.accent
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: paused ? 0.55 : 1 }}
      accessibilityRole="timer"
      accessibilityLabel={`${left} seconds left to pick`}
    >
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: alpha(t.c.tint, 0.12) }} />
      <Ring progress={progress} size={size} stroke={stroke} color={color} />
      <Txt num weight={700} size={size * 0.34} style={{ color: urgent ? t.c.live2 : t.c.text }}>{Math.max(0, left)}</Txt>
    </View>
  )
}

/**
 * A clockwise arc from 12 o'clock covering `progress` (0–1) of the circle, without SVG: each half of the circle is a
 * half-coloured ring clipped to that half and rotated into view.
 */
function Ring({ progress, size, stroke, color }: { progress: Animated.Value; size: number; stroke: number; color: string }) {
  const half = size / 2
  const ring = { position: 'absolute' as const, top: 0, width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: 'transparent' }
  const right = progress.interpolate({ inputRange: [0, 0.5], outputRange: ['-180deg', '0deg'], extrapolate: 'clamp' })
  const left = progress.interpolate({ inputRange: [0.5, 1], outputRange: ['-180deg', '0deg'], extrapolate: 'clamp' })
  return (
    <>
      {/* right half: 12 → 6 o'clock */}
      <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[ring, { left: -half, borderTopColor: color, borderRightColor: color, transform: [{ rotate: right }, { rotate: '45deg' }] }]} />
      </View>
      {/* left half: 6 → 12 o'clock */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[ring, { left: 0, borderBottomColor: color, borderLeftColor: color, transform: [{ rotate: left }, { rotate: '45deg' }] }]} />
      </View>
    </>
  )
}
