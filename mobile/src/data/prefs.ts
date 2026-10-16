import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'

// App preferences (per phone, not part of the league). The theme lives in theme.ts.

interface Prefs {
  /**
   * Prototype testing tools: Sim match / Sim week, the Simulate menu and Quick start. Off gives the clean look of the
   * real app, where matches happen at their real times (the season still moves on by watching matches live).
   */
  testingTools: boolean
  /** Experiment: Liquid Glass cards on the Matchup tab (src/ui/glass.tsx). Off is the original look. */
  glassMatchup: boolean
}

const KEY = 'seam-prefs'
const DEFAULTS: Prefs = { testingTools: true, glassMatchup: false }

export const usePrefs = create<Prefs & { setPref: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void }>((set, get) => ({
  ...DEFAULTS,
  setPref: (k, v) => {
    set({ [k]: v } as Partial<Prefs>)
    const { testingTools, glassMatchup } = get()
    AsyncStorage.setItem(KEY, JSON.stringify({ testingTools, glassMatchup } satisfies Prefs)).catch(() => {})
  },
}))

export async function loadPrefs() {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (raw) usePrefs.setState({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) })
  } catch {
    // unreadable prefs: keep the defaults
  }
}
