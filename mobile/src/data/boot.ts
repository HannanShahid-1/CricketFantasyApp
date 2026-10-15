import AsyncStorage from '@react-native-async-storage/async-storage'
import { startBots } from '@shared/bots'
import { buildData, type PlayerBio, type PlayerMedia } from '@shared/engine/data'
import { chooseDraftPick, createLeague, makePick, teamOnClock, upgradeLeague } from '@shared/engine/league'
import type { RawData } from '@shared/engine/types'
import { getData, setData, setStorage, useApp } from '@shared/store'
import { loadThemeChoice } from '@/theme/theme'
import { loadPrefs } from './prefs'

/* eslint-disable @typescript-eslint/no-require-imports */
const raw = require('../../../app/public/data/ipl.json') as RawData
const media = require('../../../app/public/data/player-media.json') as PlayerMedia
const bios = require('../../../app/public/data/player-bios.json') as Record<string, PlayerBio>
/* eslint-enable @typescript-eslint/no-require-imports */

let booted: Promise<void> | null = null

/** Same start-up as the web App.tsx, with the phone's storage instead of localStorage. */
export function boot(): Promise<void> {
  booted ??= (async () => {
    const d = buildData(raw, media, bios)
    setData(d)
    setStorage(AsyncStorage)
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
