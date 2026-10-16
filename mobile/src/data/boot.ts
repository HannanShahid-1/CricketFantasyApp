import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import { startBots } from '@shared/bots'
import { buildData, type PlayerBio, type PlayerMedia } from '@shared/engine/data'
import { chooseDraftPick, createLeague, makePick, teamOnClock, upgradeLeague } from '@shared/engine/league'
import type { RawData } from '@shared/engine/types'
import { getData, setCloner, setData, setStorage, useApp, type KeyValueStorage } from '@shared/store'
import { loadThemeChoice } from '@/theme/theme'
import { loadPrefs } from './prefs'

/* eslint-disable @typescript-eslint/no-require-imports */
const raw = require('../../../app/public/data/ipl.json') as RawData
const media = require('../../../app/public/data/player-media.json') as PlayerMedia
const bios = require('../../../app/public/data/player-bios.json') as Record<string, PlayerBio>
/* eslint-enable @typescript-eslint/no-require-imports */

let booted: Promise<void> | null = null

/** The league is plain JSON (it is saved as JSON), and this is far faster on Hermes than its structuredClone polyfill. */
const jsonClone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

/**
 * AsyncStorage, saving at most every half second: the AI managers change the league several times a second while
 * they chat, and each save writes the whole league. Anything waiting is written as soon as Seam leaves the screen.
 */
function batchedStorage(): KeyValueStorage {
  let waiting: [string, string] | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (!waiting) return
    const [key, value] = waiting
    waiting = null
    AsyncStorage.setItem(key, value).catch(() => {})
  }
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') flush()
  })
  return {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => {
      waiting = [key, value]
      timer ??= setTimeout(flush, 500)
    },
    removeItem: (key) => {
      if (waiting?.[0] === key) waiting = null
      return AsyncStorage.removeItem(key)
    },
  }
}

/** Same start-up as the web App.tsx, with the phone's storage instead of localStorage. */
export function boot(): Promise<void> {
  booted ??= (async () => {
    const d = buildData(raw, media, bios)
    setData(d)
    setStorage(batchedStorage())
    setCloner(jsonClone)
    await Promise.all([useApp.persist.rehydrate(), loadThemeChoice(), loadPrefs()])
    const l = useApp.getState().league
    if (l && l.dataVersion !== d.version) useApp.getState().reset()
    else if (l) useApp.setState({ league: upgradeLeague(l) })
    startBots()
  })()
  return booted
}

/** Prototype shortcut until the draft room is ported: a league with every pick made by the AI. */
export function quickStartLeague() {
  const d = getData()
  const l = createLeague(d, { name: 'Floodlights League', teamName: 'Seam Bowlers XI', numTeams: 8, draftSlot: 'random', timer: 0, speed: 'instant' })
  while (teamOnClock(l) !== null) makePick(d, l, chooseDraftPick(d, l, teamOnClock(l)!))
  useApp.setState({ league: l, viewWeek: null })
}
