import { create } from 'zustand'
import { persist, type PersistStorage } from 'zustand/middleware'
import {
  dmChannel, LEAGUE_CHANNEL, lastMessage, markRead, readCursor, toggleReaction, type ChannelId,
} from './engine/chat'
import type { Data } from './engine/data'
import {
  beginReplay, botTradeVerdict, chooseDraftPick, createLeague, currentWeek, dropPlayer, freeAgentAdd, lineupProblem, makePick,
  optimizeLineup, placeClaim, playNext, proposeTrade, respondTrade, reviewTrade, say, setMatchPick, teamOnClock,
  withdrawTrade,
  type League, type LeagueOptions,
} from './engine/league'

let DATA: Data | null = null
export const setData = (d: Data) => {
  DATA = d
}
export const getData = (): Data => {
  if (!DATA) throw new Error('data not loaded')
  return DATA
}

export type Tab = 'matchup' | 'team' | 'players' | 'league' | 'playoffs' | 'fixtures' | 'activity' | 'chat' | 'draft' | 'scoring'

/** the signed-in manager; becomes the account's team id once the league is multiplayer */
export const ME = 0

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
  chatChannel: ChannelId
  /** who is typing in each channel (not saved) */
  typing: Record<ChannelId, number[]>

  setTab: (t: Tab) => void
  setViewWeek: (w: number | null) => void
  openPlayer: (p: number | null) => void
  openMatch: (mi: number | null) => void
  openLive: (mi: number | null) => void
  openTrade: (teamId: number | null) => void
  openAdd: (p: number | null) => void
  notify: (text: string, tone?: 'ok' | 'bad' | 'info') => void
  openChat: (channel?: ChannelId) => void

  newLeague: (o: LeagueOptions) => void
  reset: () => void
  draftPick: (p: number) => void
  draftAuto: () => void
  toggleQueue: (p: number) => void
  setDraftSpeed: (s: League['draft']['speed']) => void

  setStarters: (starters: (number | null)[]) => string | null
  /** lock in which of a player's matches counts this week (null = back to his first match) */
  lockMatch: (p: number, mi: number | null) => string | null
  optimize: () => string | null
  toggleAutoSub: () => void
  toggleAutoLineup: () => void
  faAdd: (add: number, drop: number | null) => string | null
  claim: (add: number, drop: number | null, bid: number) => string | null
  cancelClaim: (id: number) => void
  drop: (p: number) => string | null
  proposeTrade: (to: number, give: number[], get: number[], note?: string) => string | null
  respondTrade: (id: number, accept: boolean) => string | null
  withdrawTrade: (id: number) => void
  reviewTrade: (id: number, approve: boolean) => string | null

  sendMessage: (channel: ChannelId, text: string) => void
  react: (msgId: number, emoji: string) => void
  markRead: (channel: ChannelId) => void

  // actions taken by the simulated managers (see bots.ts)
  botSay: (teamId: number, channel: ChannelId, text: string) => void
  botRead: (teamId: number, channel: ChannelId) => void
  botReact: (teamId: number, msgId: number, emoji: string) => void
  botAnswerTrade: (id: number) => void
  /** time passes in the sim: every AI manager catches up on the league chat and their DM with you */
  botsReadAll: () => void
  setTyping: (channel: ChannelId, teamId: number, on: boolean) => void

  beginReplay: () => string | null
  simMatch: () => void
  simWeek: () => void
  simTo: (week: number) => void
}

const clone = (l: League): League => structuredClone(l)

type Saved = Pick<AppState, 'league' | 'tab' | 'chatChannel'>

/** Where the league is saved: localStorage on the web. The iPhone app plugs in AsyncStorage with `setStorage`,
 *  then calls `useApp.persist.rehydrate()`. */
export interface KeyValueStorage {
  getItem: (key: string) => string | null | Promise<string | null>
  setItem: (key: string, value: string) => unknown
  removeItem: (key: string) => unknown
}
let kv: KeyValueStorage | null = typeof localStorage === 'undefined' ? null : localStorage
export const setStorage = (s: KeyValueStorage) => {
  kv = s
}

const parse = (raw: string | null) => (raw ? JSON.parse(raw) : null)

/** Saved storage, but only written when something that is saved actually changed. Without this, every typing
 *  indicator, toast or modal would re-serialise the whole league. */
let lastSaved: Saved | null = null
const storage: PersistStorage<Saved> = {
  getItem: (name) => {
    try {
      const raw = kv?.getItem(name) ?? null
      return raw instanceof Promise ? raw.then(parse).catch(() => null) : parse(raw)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    const s = value.state
    if (lastSaved && lastSaved.league === s.league && lastSaved.tab === s.tab && lastSaved.chatChannel === s.chatChannel) return
    lastSaved = s
    try {
      const r = kv?.setItem(name, JSON.stringify(value))
      if (r instanceof Promise) r.catch(() => {})
    } catch {
      // storage full or blocked: the league keeps working for this session
    }
  },
  removeItem: (name) => {
    kv?.removeItem(name)
  },
}

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
      // chat-only changes copy just the chat, so rosters/results keep their identity and memoised views stay valid
      const mutateChat = (fn: (l: League, d: Data) => void) => {
        const cur = get().league
        if (!cur) return
        const l = { ...cur, chat: structuredClone(cur.chat) }
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
        chatChannel: LEAGUE_CHANNEL,
        typing: {},

        setTab: (tab) => set({ tab }),
        setViewWeek: (viewWeek) => set({ viewWeek }),
        openPlayer: (playerModal) => set({ playerModal }),
        openMatch: (matchModal) => set({ matchModal }),
        openLive: (liveMatch) => set({ liveMatch }),
        openTrade: (tradeWith) => set({ tradeWith }),
        openAdd: (addTarget) => set({ addTarget }),
        notify: (text, tone = 'ok') => set({ toast: { id: Date.now(), text, tone } }),
        openChat: (channel) => set((s) => ({ tab: 'chat', chatChannel: channel ?? s.chatChannel })),

        newLeague: (o) => set({ league: createLeague(getData(), o), tab: 'matchup', viewWeek: null, chatChannel: LEAGUE_CHANNEL, typing: {} }),
        reset: () => set({ league: null, tab: 'matchup', viewWeek: null, liveMatch: null, playerModal: null, chatChannel: LEAGUE_CHANNEL, typing: {} }),

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

        setStarters: (starters) => {
          let err: string | null = null
          mutate((l, d) => {
            err = lineupProblem(d, l, ME, starters)
            if (!err) l.teams[ME].starters = starters
          })
          return err
        },
        lockMatch: (p, mi) => {
          let err: string | null = null
          mutate((l, d) => {
            err = setMatchPick(d, l, ME, p, mi)
          })
          return err
        },
        optimize: () => {
          let err: string | null = null
          mutate((l, d) => {
            err = optimizeLineup(d, l, ME)
          })
          return err
        },
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
        proposeTrade: (to, give, gett, note) => {
          let err: string | null = null
          mutate((l, d) => {
            err = proposeTrade(d, l, ME, to, give, gett, note).error ?? null
          })
          return err
        },
        respondTrade: (id, accept) => {
          let err: string | null = null
          mutate((l, d) => {
            err = respondTrade(d, l, id, accept)
          })
          return err
        },
        withdrawTrade: (id) => mutate((l, d) => withdrawTrade(d, l, id)),
        reviewTrade: (id, approve) => {
          let err: string | null = null
          mutate((l, d) => {
            err = reviewTrade(d, l, id, approve, ME)
          })
          return err
        },

        sendMessage: (channel, text) => {
          const body = text.trim().slice(0, 1000)
          if (!body) return
          mutateChat((l, d) => void say(d, l, channel, ME, { text: body }))
        },
        react: (msgId, emoji) => mutateChat((l) => toggleReaction(l.chat, msgId, ME, emoji)),
        markRead: (channel) => {
          const l = get().league
          if (!l) return
          const last = lastMessage(l.chat, channel)
          if (!last || (readCursor(l.chat, channel, ME)?.id ?? 0) >= last.id) return
          mutateChat((x) => void markRead(x.chat, channel, ME))
        },

        botSay: (teamId, channel, text) => mutateChat((l, d) => void say(d, l, channel, teamId, { text })),
        botRead: (teamId, channel) => {
          const l = get().league
          const last = l && lastMessage(l.chat, channel)
          if (!last || (readCursor(l.chat, channel, teamId)?.id ?? 0) >= last.id) return
          mutateChat((x) => void markRead(x.chat, channel, teamId))
        },
        botReact: (teamId, msgId, emoji) => mutateChat((l) => toggleReaction(l.chat, msgId, teamId, emoji)),
        botAnswerTrade: (id) =>
          mutate((l, d) => {
            const t = l.trades.find((x) => x.id === id)
            if (!t || t.status !== 'pending' || l.teams[t.to].isUser) return
            const v = botTradeVerdict(d, l, t)
            say(d, l, dmChannel(t.from, t.to), t.to, { text: v.text })
            respondTrade(d, l, id, v.accept)
          }),
        botsReadAll: () =>
          mutateChat((l) => {
            for (const t of l.teams) {
              if (t.isUser) continue
              markRead(l.chat, LEAGUE_CHANNEL, t.id)
              markRead(l.chat, dmChannel(t.id, ME), t.id)
            }
          }),
        setTyping: (channel, teamId, on) =>
          set((s) => {
            const cur = s.typing[channel] ?? []
            const next = on ? (cur.includes(teamId) ? cur : [...cur, teamId]) : cur.filter((x) => x !== teamId)
            return { typing: { ...s.typing, [channel]: next } }
          }),

        beginReplay: () => {
          let err: string | null = null
          mutate((l, d) => { err = beginReplay(d, l) })
          return err
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
      partialize: (s) => ({ league: s.league, tab: s.tab, chatChannel: s.chatChannel }),
      storage,
    },
  ),
)
