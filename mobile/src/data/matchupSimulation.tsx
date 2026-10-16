import { useIsFocused } from 'expo-router'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { currentWeek, type League } from '@shared/engine/league'
import { matchProjection } from '@shared/engine/data'
import { getData, useApp } from '@shared/store'
import { liveFantasyScore } from '@shared/ui/matchupSimulation'
import { isNextMatch, REPLAY_SPEEDS, replayState } from '@shared/ui/replay'
import { ballEvents } from '@shared/ui/scorecard'

export function useSimulation(league: League) {
  const d = getData()
  const [k, setK] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const focused = useIsFocused()
  const mi = league.replayMatch === league.played ? league.replayMatch : null
  const m = mi === null ? null : d.matches[mi]
  const evs = useMemo(() => m ? ballEvents(d, m.raw) : [], [d, m])
  const total = evs.length
  const st = useMemo(() => m ? replayState(d, m, evs, k) : null, [d, m, evs, k])
  const baselines = useMemo(() => new Map(m ? d.pool.filter((p) => m.teams.includes(p.team)).map((p) => [p.idx, matchProjection(d, p, m.mi, m.mi).total]) : []), [d, m])
  const scores = useMemo(() => new Map(m && st ? [...baselines].map(([pid, baseline]) => [pid, liveFantasyScore(d, m, pid, st, baseline)]) : []), [d, m, st, baselines])
  useEffect(() => {
    if (!m || !focused || !playing || k >= total) return
    const ms = REPLAY_SPEEDS[speed].ms
    const step = Math.max(1, Math.round(60 / ms))
    const timer = setInterval(() => setK((n) => Math.min(total, n + step)), ms * step)
    return () => clearInterval(timer)
  }, [m, focused, playing, speed, total, k >= total])
  const recorded = useRef<number | null>(null)
  useEffect(() => {
    if (!m || !st?.finished || recorded.current === m.mi) return
    recorded.current = m.mi
    setPlaying(false)
    const store = useApp.getState()
    if (store.league && isNextMatch(store.league, m.mi)) {
      store.simMatch()
      store.notify(`${m.teams.join(' v ')} complete`, 'info')
    }
  }, [m, st?.finished])
  const start = useCallback(() => {
    const store = useApp.getState()
    if (!store.league) return
    const week = currentWeek(d, store.league)
    const running = store.league.replayMatch === store.league.played
    const err = store.beginReplay()
    if (err) return store.notify(err, 'bad')
    if (!running) { setK(0); recorded.current = null }
    store.setViewWeek(week)
    setPlaying(true)
  }, [d])
  return { m, st, scores, k, total, speed, setSpeed, playing, start, toggle: () => setPlaying((v) => !v), finish: () => setK(total) }
}

type Simulation = ReturnType<typeof useSimulation>
export const SimulationContext = createContext<Simulation | null>(null)
export const useMatchupSimulation = () => useContext(SimulationContext)
