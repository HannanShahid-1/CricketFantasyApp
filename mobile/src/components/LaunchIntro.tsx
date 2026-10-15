import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native'
import { create } from 'zustand'

// The launch animation, kept short. iOS first shows the native splash (app.json → expo-splash-screen: the icon's ball
// on its coral). This overlay starts as an exact copy of it, so the hand-over is invisible: the ball gives one quick
// spin, then the splash fades away into the app (about half a second). With Reduce Motion on it only fades.

// Keep the native splash up until the overlay has drawn its first frame.
SplashScreen.preventAutoHideAsync().catch(() => {})

/**
 * Brand colours, like the icon (scripts/make-icon.swift), not theme tokens: the native splash can't follow the theme.
 * Must match the expo-splash-screen settings in app.json.
 */
const SPLASH = { coral: '#dc5f57', ball: 156 }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BALL_IMAGE = require('../../assets/splash-ball.png')

/** Shown on launch; Settings can replay it. */
export const useLaunchIntro = create<{ visible: boolean; run: number; replay: () => void; finish: () => void }>((set) => ({
  visible: true,
  run: 0,
  replay: () => set((s) => ({ visible: true, run: s.run + 1 })),
  finish: () => set({ visible: false }),
}))

let nativeHidden = false

/** `ready`: fonts loaded and the league booted, so the app behind can be shown. */
export function LaunchIntro({ ready }: { ready: boolean }) {
  const { width, height } = useWindowDimensions()
  const v = useRef({ spin: new Animated.Value(0), ball: new Animated.Value(1), fade: new Animated.Value(1) }).current
  const [drawn, setDrawn] = useState(false)
  const [calm, setCalm] = useState<boolean | null>(null)
  const [spun, setSpun] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setCalm, () => setCalm(false))
    const fallback = setTimeout(() => setDrawn(true), 800) // in case the ball's onLoad never comes
    return () => clearTimeout(fallback)
  }, [])

  // swap the native splash for this identical overlay once it's on screen
  useEffect(() => {
    if (!drawn || nativeHidden) return
    requestAnimationFrame(() => {
      nativeHidden = true
      SplashScreen.hideAsync().catch(() => {})
    })
  }, [drawn])

  // one quick spin
  useEffect(() => {
    if (!drawn || calm === null) return
    if (calm) {
      setSpun(true)
      return
    }
    Animated.timing(v.spin, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      .start(() => setSpun(true))
  }, [drawn, calm, v])

  // then fade into the app (the ball grows a touch as it goes)
  useEffect(() => {
    if (!spun || !ready) return
    const native = { duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }
    Animated.parallel([
      Animated.timing(v.fade, { toValue: 0, ...native }),
      ...(calm ? [] : [Animated.timing(v.ball, { toValue: 1.25, ...native })]),
    ]).start(() => useLaunchIntro.getState().finish())
  }, [spun, ready, calm, v])

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.splash, { opacity: v.fade }]} accessibilityLabel="Seam" accessibilityRole="image">
      <StatusBar style="light" />
      <Animated.Image
        source={BALL_IMAGE}
        onLoad={() => setDrawn(true)}
        style={{
          position: 'absolute', left: (width - SPLASH.ball) / 2, top: (height - SPLASH.ball) / 2, width: SPLASH.ball, height: SPLASH.ball,
          transform: [{ scale: v.ball }, { rotate: v.spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] }) }],
        }}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  splash: { backgroundColor: SPLASH.coral },
})
