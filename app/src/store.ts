import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Data } from './engine/data'
import {
  bestLineup, chooseDraftPick, createLeague, currentWeek, dropPlayer, evaluateTrade, executeTrade,
  freeAgentAdd, makePick, placeClaim, playNext, teamOnClock,
  type League, type LeagueOptions, type TradeVerdict,
} from './engine/league'

let DATA: Data | null = null
export const setData = (d: Data) => {
  DATA = d
}
export const getData = (): Data => {
  if (!DATA) throw new Error('data not loaded')
  return DATA
}

export type Tab = 'matchup' | 'team' | 'players' | 'league' | 'playoffs' | 'fixtures' | 'activity' | 'draft' | 'scoring'

interface AppState {
  league: League | null
  tab: Tab
  viewWeek: number | null
  playerModal: number | null
  matchModal: number | null
  liveMatch: number | null
  tradeWith: number | null
  addTarget: number | null
  toast: { id: number; text: string; tone: 'ok' | 'bad' | 'info' } | null

  setTab: (t: Tab) => void
  setViewWeek: (w: number | null) => void
  openPlayer: (p: number | null) => void
  openMatch: (mi: number | null) => void
  openLive: (mi: number | null) => void
  openTrade: (teamId: number | null) => void
  openAdd: (p: number | null) => void
  notify: (text: string, tone?: 'ok' | 'bad' | 'info') => void

  newLeague: (o: LeagueOptions) => void
  reset: () => void
  draftPick: (p: number) => void
  draftAuto: () => void
  toggleQueue: (p: number) => void
  setDraftSpeed: (s: League['draft']['speed']) => void

  setStarters: (starters: (number | null)[]) => void
  optimize: () => void
  toggleAutoSub: () => void
  toggleAutoLineup: () => void
  faAdd: (add: number, drop: number | null) => string | null
  claim: (add: number, drop: number | null, bid: number) => string | null
  cancelClaim: (id: number) => void
  drop: (p: number) => string | null
  checkTrade: (otherId: number, give: number[], get: number[]) => TradeVerdict
  trade: (otherId: number, give: number[], get: number[]) => TradeVerdict

  simMatch: () => void
  simWeek: () => void
  simTo: (week: number) => void
}

const clone = (l: League): League => structuredClone(l)

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const mutate = (fn: (l: League, d: Data) => void) => {
        const cur = get().league
        if (!cur) return
        const l = clone(cur)
        fn(l, getData())
        set({ league: l })
      }
      return {
        league: null,
        tab: 'matchup',
        viewWeek: null,
        playerModal: null,
        matchModal: null,
        liveMatch: null,
        tradeWith: null,
        addTarget: null,
        toast: null,

        setTab: (tab) => set({ tab }),
        setViewWeek: (viewWeek) => set({ viewWeek }),
        openPlayer: (playerModal) => set({ playerModal }),
        openMatch: (matchModal) => set({ matchModal }),
        openLive: (liveMatch) => set({ liveMatch }),
        openTrade: (tradeWith) => set({ tradeWith }),
        openAdd: (addTarget) => set({ addTarget }),
        notify: (text, tone = 'ok') => set({ toast: { id: Date.now(), text, tone } }),

        newLeague: (o) => set({ league: createLeague(getData(), o), tab: 'matchup', viewWeek: null }),
        reset: () => set({ league: null, tab: 'matchup', viewWeek: null, liveMatch: null, playerModal: null }),

        draftPick: (p) =>
          mutate((l, d) => {
            if (teamOnClock(l) === null) return
            makePick(d, l, p)
          }),
        draftAuto: () =>
          mutate((l, d) => {
            const t = teamOnClock(l)
            if (t === null) return
            makePick(d, l, chooseDraftPick(d, l, t, { useQueue: l.teams[t].isUser, noise: l.teams[t].isUser ? 0 : undefined }))
          }),
        toggleQueue: (p) =>
          mutate((l) => {
            l.draft.queue = l.draft.queue.includes(p) ? l.draft.queue.filter((x) => x !== p) : [...l.draft.queue, p]
          }),
        setDraftSpeed: (s) => mutate((l) => void (l.draft.speed = s)),

        setStarters: (starters) => mutate((l) => void (l.teams[0].starters = starters)),
        optimize: () =>
          mutate((l, d) => {
            l.teams[0].starters = bestLineup(d, l, l.teams[0], currentWeek(d, l), true).starters
          }),
        toggleAutoSub: () => mutate((l) => void (l.teams[0].autoSub = !l.teams[0].autoSub)),
        toggleAutoLineup: () => mutate((l) => void (l.teams[0].autoLineup = !l.teams[0].autoLineup)),

        faAdd: (add, drop) => {
          let err: string | null = null
          mutate((l, d) => {
            err = freeAgentAdd(d, l, 0, add, drop)
          })
          return err
        },
        claim: (add, drop, bid) => {
          let err: string | null = null
          mutate((l) => {
            err = placeClaim(l, 0, add, drop, bid)
          })
          return err
        },
        cancelClaim: (id) => mutate((l) => void (l.claims = l.claims.filter((c) => c.id !== id))),
        drop: (p) => {
          let err: string | null = null
          mutate((l, d) => {
            err = dropPlayer(d, l, 0, p)
          })
          return err
        },
        checkTrade: (otherId, give, gett) => evaluateTrade(getData(), get().league!, otherId, give, gett),
        trade: (otherId, give, gett) => {
          const v = evaluateTrade(getData(), get().league!, otherId, give, gett)
          if (v.accepted) mutate((l, d) => executeTrade(d, l, otherId, give, gett))
          return v
        },

        simMatch: () => mutate((l, d) => playNext(d, l)),
        simWeek: () =>
          mutate((l, d) => {
            const w = currentWeek(d, l)
            while (l.phase === 'season' && currentWeek(d, l) === w && l.played < d.matches.length) playNext(d, l)
          }),
        simTo: (week) =>
          mutate((l, d) => {
            while (l.phase === 'season' && currentWeek(d, l) <= week && l.played < d.matches.length) playNext(d, l)
          }),
      }
    },
    {
      name: 'cricket-fantasy-league',
      partialize: (s) => ({ league: s.league, tab: s.tab }),
    },
  ),
)
