import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Dimensions, Keyboard, LayoutAnimation, type KeyboardEvent } from 'react-native'

// Small hooks the chat screens share.

/**
 * Height of the software keyboard over the bottom of the screen (0 when hidden), tracked while the screen is focused.
 * The layout change it causes animates with the keyboard's own curve, as in React Native's KeyboardAvoidingView.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  useFocusEffect(
    useCallback(() => {
      const overlap = (screenY: number) => Math.max(0, Dimensions.get('window').height - screenY)
      const now = Keyboard.metrics()
      setHeight(now ? overlap(now.screenY) : 0)
      const onChange = (e: KeyboardEvent) => {
        if (e.duration) {
          const duration = Math.max(e.duration, 10)
          LayoutAnimation.configureNext({ duration, update: { duration, type: LayoutAnimation.Types[e.easing] ?? LayoutAnimation.Types.keyboard } })
        }
        setHeight(overlap(e.endCoordinates.screenY))
      }
      const subs = [Keyboard.addListener('keyboardWillChangeFrame', onChange), Keyboard.addListener('keyboardWillHide', onChange)]
      return () => subs.forEach((s) => s.remove())
    }, []),
  )
  return height
}

/** Whether the app is in the foreground. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'))
    return () => sub.remove()
  }, [])
  return active
}
