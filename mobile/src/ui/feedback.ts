import * as Haptics from 'expo-haptics'
import { Alert } from 'react-native'
import { useApp } from '@shared/store'

/** Light taptic feedback. Fire-and-forget: a missing taptic engine (simulator) is fine. */
export const haptic = {
  /** picking something: a lineup slot, a segment, a toggle */
  select: () => void Haptics.selectionAsync().catch(() => {}),
  /** a button that changes the league */
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  /** a big moment, e.g. a wicket in a live match */
  heavy: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
}

/** Native confirmation alert. Resolves true when the user picks the confirm button. */
export function confirm({ title, message, ok, destructive }: { title: string; message?: string; ok: string; destructive?: boolean }) {
  return new Promise<boolean>((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  )
}

/**
 * Report the result of a league action (store actions return an error string or null): error haptic + red toast,
 * or success haptic + optional confirmation toast. Returns true on success.
 */
export function report(err: string | null | undefined, ok?: string): boolean {
  const { notify } = useApp.getState()
  if (err) {
    haptic.error()
    notify(err, 'bad')
    return false
  }
  haptic.success()
  if (ok) notify(ok, 'ok')
  return true
}
