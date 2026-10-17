import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

const KEY = 'seam-home-pins'
export const useHomePrefs = create<{ pinned: number[] }>(() => ({ pinned: [] }))
export function togglePinned(id: number) {
  const old = useHomePrefs.getState().pinned
  const pinned = old.includes(id) ? old.filter((x) => x !== id) : [...old, id]
  useHomePrefs.setState({ pinned })
  AsyncStorage.setItem(KEY, JSON.stringify(pinned)).catch(() => {})
}
export async function loadHomePrefs() {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    const value: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(value) && value.every((x) => typeof x === 'number')) useHomePrefs.setState({ pinned: value })
  } catch { /* Unreadable preferences don't affect saved leagues. */ }
}
