import { memo, useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { getData } from '@shared/store'
import type { BallEvent } from '@shared/ui/scorecard'
import { alpha, useTheme, type Theme } from '@/theme/theme'
import { Txt, type Weight } from '@/ui'

// Building blocks of the match screens: the live replay and the scorecard.

function ballColors(t: Theme, cls: BallEvent['cls']) {
  switch (cls) {
    case 'b4': return { bg: alpha(t.c.sky, 0.18), fg: t.c.sky, border: alpha(t.c.sky, 0.5) }
    case 'b6': return { bg: alpha(t.c.accent, 0.2), fg: t.c.accent, border: alpha(t.c.accent, 0.6) }
    case 'bw': return { bg: t.c.live, fg: t.c.liveInk, border: 'transparent' }
    case 'bx': return { bg: alpha(t.c.tint, 0.08), fg: t.c.gold, border: alpha(t.c.gold, 0.4) }
    default: return { bg: alpha(t.c.tint, 0.08), fg: t.c.muted, border: t.c.line2 }
  }
}

/**
 * One delivery as a circle: a dot, runs, 4 (sky), 6 (accent), W (live red) or an extra (gold). With `pop` it springs
 * in when it first appears (the newest ball of the over).
 */
export const BallChip = memo(function BallChip({ e, size = 30, pop = false }: { e: BallEvent; size?: number; pop?: boolean }) {
  const t = useTheme()
  const popOnMount = useRef(pop).current
  const v = useRef(new Animated.Value(popOnMount ? 0 : 1)).current
  useEffect(() => {
    if (!popOnMount) return
    const anim = Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 14 })
    anim.start()
    return () => anim.stop()
  }, [popOnMount, v])
  const motion = useMemo(() => ({
    opacity: v.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
  }), [v])
  const c = ballColors(t, e.cls)
  return (
    <Animated.View
      accessible
      accessibilityLabel={e.desc}
      style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }, motion]}
    >
      <Txt display weight={700} size={size * 0.4} numberOfLines={1} style={{ color: c.fg }}>{e.short}</Txt>
    </Animated.View>
  )
})

/** A score that flashes the accent colour (with a glow and a slight pop) whenever it changes: live points. */
export const FlashNum = memo(function FlashNum({ value, size, color, weight = 700, align = 'right', dim, style }: {
  value: string; size: number; color: string; weight?: Weight; align?: 'left' | 'right' | 'center'; dim?: boolean; style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const v = useRef(new Animated.Value(0)).current
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    v.setValue(1)
    const anim = Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true })
    anim.start()
    return () => anim.stop()
  }, [value, v])
  const scale = useMemo(() => v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }), [v])
  const text = { textAlign: align }
  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: dim ? 0.45 : 1 }, style]}>
      <Txt num weight={weight} size={size} style={[text, { color }]}>{value}</Txt>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: v }]}>
        <Txt num weight={weight} size={size} style={[text, { color: t.c.accent, textShadowColor: alpha(t.c.accent, 0.8), textShadowRadius: 12 }]}>{value}</Txt>
      </Animated.View>
    </Animated.View>
  )
})

/** An IPL team in a score header: its colour bar and code, e.g. ▌CSK. */
export function TeamMark({ code, size = 15 }: { code: string; size?: number }) {
  const t = useTheme()
  const team = getData().teams[code]
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 4, height: size + 2, borderRadius: 2, backgroundColor: team ? t.team(team.color) : t.c.dim }} />
      <Txt display weight={700} size={size}>{code}</Txt>
    </View>
  )
}

/** The LIVE capsule; its dot pulses while the match is playing. */
export function LiveBadge({ pulsing }: { pulsing: boolean }) {
  const t = useTheme()
  const v = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!pulsing) {
      v.setValue(1)
      return
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.2, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulsing, v])
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: alpha(t.c.live, 0.16) }}>
      <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.c.live, opacity: v }} />
      <Txt size={11.5} weight={700} style={{ color: t.c.live2, letterSpacing: 0.4 }}>LIVE</Txt>
    </View>
  )
}
