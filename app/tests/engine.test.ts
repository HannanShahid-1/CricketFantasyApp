// Engine regression tests: run with `npm test`. They load the real Cricsheet data from public/ and play whole
// simulated seasons, so they check rules end to end. The engine is random (AI picks, bot trades), so tests
// assert invariants that must hold on every run rather than exact numbers.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { dmChannel, emptyChat, markRead, post, toggleReaction, unreadCount } from '../src/engine/chat'
import type { Data } from '../src/engine/data'
import { loadData } from '../src/loadData'
import { matchProjection, restOfSeason } from '../src/engine/data'
import { matchupAdjustment } from '../src/engine/matchupForecast'
import {
  addMode, beginReplay, botTradeVerdict, canFillLineup, chooseDraftPick, countedMatch, createLeague, currentWeek, dropPlayer,
  freeAgentAdd, isLocked, isOffRoster, lineupProblem, lockedPick, makePick, optimizeLineup, overLimit, placeClaim, playNext,
  proposeTrade, respondTrade, reviewTrade, ROSTER_SIZE, setMatchPick, slotLocked, SLOTS, teamOnClock,
  TRADE_DEADLINE_WEEK, tradeProblem, upgradeLeague, weekMatches, withdrawTrade, type League,
} from '../src/engine/league'
import { BOT_AVATARS, USER_AVATARS } from '../src/engine/avatars'
import { applyMove, swapTargets } from '../src/ui/lineup'
import { computeLines } from '../src/engine/scoring'
import { FLAG_LEGBYE, FLAG_NOBALL, type RawMatch } from '../src/engine/types'

let d: Data

beforeAll(async () => {
  // the app fetches /data/*.json; serve them from public/
  globalThis.fetch = (async (url: string) => {
    const file = join(__dirname, '../public', String(url).replace(/^\//, ''))
    return new Response(readFileSync(file))
  }) as typeof fetch
  d = await loadData()
})

function drafted(numTeams = 8): League {
  const l = createLeague(d, { name: 'Test', teamName: 'Me', numTeams, draftSlot: 'random', timer: 0, speed: 'instant' })
  while (teamOnClock(l) !== null) makePick(d, l, chooseDraftPick(d, l, teamOnClock(l)!))
  return l
}

function playSeason(l: League, eachWeek?: (l: League, week: number) => void) {
  let last = 0
  while (l.phase === 'season' && l.played < d.matches.length) {
    const w = currentWeek(d, l)
    if (w !== last) {
      last = w
      eachWeek?.(l, w)
    }
    playNext(d, l)
  }
}

/** a week-1 player on my roster with 2+ matches, placed in the lineup. Auto-sub is turned off so he stays put
 *  even if he's left out of an XI (that's auto-sub's own test). */
function twoMatchStarter(l: League) {
  const me = l.teams[0]
  me.autoSub = false
  const p = me.roster.find((x) => weekMatches(d, x, 1).length > 1)!
  if (!me.starters.includes(p)) me.starters[SLOTS.findIndex((s) => d.players[p].elig.includes(s))] = p
  return p
}

describe('season simulation', () => {
  it('plays full 8- and 10-team seasons with valid rosters and results', () => {
    for (const n of [8, 10]) {
      const l = drafted(n)
      playSeason(l)
      expect(l.phase).toBe('complete')
      expect(l.champion).not.toBeNull()
      expect(Object.keys(l.results)).toHaveLength(8)
      const seen = new Set<number>()
      for (const t of l.teams) {
        expect(t.roster).toHaveLength(15)
        for (const p of t.roster) {
          expect(seen.has(p)).toBe(false)
          seen.add(p)
        }
      }
    }
  })

  it("scores each starter's one counted match, never more", () => {
    const l = drafted()
    playSeason(l, (l, w) => {
      for (const t of l.teams) for (const p of t.roster) {
        const mis = weekMatches(d, p, w)
        if (mis.length > 1 && Math.random() < 0.5) expect(setMatchPick(d, l, t.id, p, mis[1])).toBeNull()
      }
    })
    for (const [wk, r] of Object.entries(l.results)) {
      for (const t of l.teams) {
        let s = 0
        r.starters[t.id].forEach((p, i) => {
          const c = r.counted![t.id][i]
          if (p === null || c === null) return
          expect(weekMatches(d, p, Number(wk))).toContain(c)
          s += d.players[p].games.get(c)?.pts.total ?? 0
        })
        expect(r.scores[t.id]).toBeCloseTo(s, 2)
      }
    }
  })

  it('auto-subs only replace starters missing from the XI, with players whose match has not started', () => {
    const l = drafted(10)
    playSeason(l)
    for (const t of l.txns.filter((x) => x.type === 'autosub')) {
      const [add] = t.adds
      const [drop] = t.drops
      expect(d.matches[t.played].xi.has(drop)).toBe(false)
      const r = l.results[t.week]
      const i = r.starters[t.teamId].indexOf(add)
      if (i >= 0) expect(r.counted![t.teamId][i]!).toBeGreaterThanOrEqual(t.played)
    }
  })
})

describe('one match counts (lock-in)', () => {
  it("defaults to the player's first match", () => {
    const l = drafted()
    const p = twoMatchStarter(l)
    expect(countedMatch(d, l, 0, p, 1)).toBe(weekMatches(d, p, 1)[0])
  })

  it('locks a later match before his first match, then freezes the choice', () => {
    const l = drafted()
    const p = twoMatchStarter(l)
    const [m1, m2] = weekMatches(d, p, 1)
    expect(setMatchPick(d, l, 0, p, m2)).toBeNull()
    expect(countedMatch(d, l, 0, p, 1)).toBe(m2)
    while (l.played <= m1) playNext(d, l)
    expect(setMatchPick(d, l, 0, p, m1)).toMatch(/too late/i) // no switching back after seeing match 1
    expect(slotLocked(d, l, 0, p)).toBe(false) // still movable until match 2 starts
    while (currentWeek(d, l) === 1) playNext(d, l)
    const r = l.results[1]
    expect(r.counted![0][r.starters[0].indexOf(p)]).toBe(m2) // match 1's points never counted
  })

  it('switching back to the first match clears the lock; locks reset each week', () => {
    const l = drafted()
    const p = twoMatchStarter(l)
    const [m1, m2] = weekMatches(d, p, 1)
    setMatchPick(d, l, 0, p, m2)
    setMatchPick(d, l, 0, p, m1)
    expect(lockedPick(l, 0, p, 1)).toBeUndefined()
    setMatchPick(d, l, 0, p, m2)
    while (currentWeek(d, l) === 1) playNext(d, l)
    expect(l.teams[0].picks).toBeUndefined()
  })

  it('blocks hindsight lineup moves', () => {
    const l = drafted()
    // play until some bench player's counted match is over and some starter's has begun
    while (l.played < 8) playNext(d, l)
    const me = l.teams[0]
    const benchDone = me.roster.find((p) => !me.starters.includes(p) && slotLocked(d, l, 0, p))
    if (benchDone !== undefined) {
      const slot = SLOTS.findIndex((s, i) => d.players[benchDone].elig.includes(s) && !slotLocked(d, l, 0, me.starters[i]!))
      if (slot >= 0) {
        const next = [...me.starters]
        next[slot] = benchDone
        expect(lineupProblem(d, l, 0, next)).toMatch(/can't come in/)
      }
    }
    const lockedStarter = me.starters.find((p) => p !== null && slotLocked(d, l, 0, p))
    expect(lockedStarter).toBeDefined()
    expect(lineupProblem(d, l, 0, me.starters.map((p) => (p === lockedStarter ? null : p)))).toMatch(/locked/)
  })

  it("rejects picks for one-match players and other managers' players", () => {
    const l = drafted()
    l.played = d.gameweeks[1].mis[0] // start of week 2: weeks after the opener have one-match teams
    const w = currentWeek(d, l)
    const single = l.teams[0].roster.find((p) => weekMatches(d, p, w).length === 1)
    if (single !== undefined) expect(setMatchPick(d, l, 0, single, null)).toMatch(/one match/)
    expect(setMatchPick(d, l, 0, l.teams[1].roster[0], null)).toMatch(/not on this roster/)
  })
})

describe('trades and the commissioner', () => {
  function legalPair(l: League): [number, number] {
    for (const p of l.teams[0].roster) for (const q of l.teams[1].roster) if (!tradeProblem(d, l, 0, 1, [p], [q])) return [p, q]
    throw new Error('no legal 1-for-1 trade found')
  }

  it('accept → review → commissioner approves → players move', () => {
    const l = drafted()
    const [p, q] = legalPair(l)
    const t = proposeTrade(d, l, 0, 1, [p], [q]).trade!
    expect(t.status).toBe('pending')
    expect(respondTrade(d, l, t.id, true)).toBeNull()
    expect(t.status).toBe('review')
    expect(reviewTrade(d, l, t.id, true, 3)).toMatch(/only the commissioner/i)
    expect(reviewTrade(d, l, t.id, true, 0)).toBeNull()
    expect(t.status).toBe('approved')
    expect(l.teams[0].roster).toContain(q)
    expect(l.teams[1].roster).toContain(p)
  })

  it('veto keeps rosters; review auto-approves when the next match starts', () => {
    const l = drafted()
    const [p, q] = legalPair(l)
    const a = proposeTrade(d, l, 0, 1, [p], [q]).trade!
    respondTrade(d, l, a.id, true)
    reviewTrade(d, l, a.id, false, 0)
    expect(a.status).toBe('vetoed')
    expect(l.teams[0].roster).toContain(p)
    const b = proposeTrade(d, l, 0, 1, [p], [q]).trade!
    respondTrade(d, l, b.id, true)
    playNext(d, l)
    expect(b.status).toBe('approved')
  })

  it('withdraw, decline and end-of-week expiry close offers; chat records every step', () => {
    const l = drafted()
    const [p, q] = legalPair(l)
    const a = proposeTrade(d, l, 0, 1, [p], [q]).trade!
    withdrawTrade(d, l, a.id)
    const b = proposeTrade(d, l, 0, 1, [p], [q]).trade!
    respondTrade(d, l, b.id, false)
    const c = proposeTrade(d, l, 0, 1, [p], [q]).trade!
    while (currentWeek(d, l) === 1) playNext(d, l)
    expect([a.status, b.status, c.status]).toEqual(['withdrawn', 'declined', 'expired'])
    // only these three trades: the AI may also send its own offer in this DM at the end of the week
    const ours = new Set([a.id, b.id, c.id])
    const stages = l.chat.messages
      .filter((m) => m.channel === dmChannel(0, 1) && m.event?.type === 'trade' && ours.has(m.event.tradeId))
      .map((m) => (m.event as { stage: string }).stage)
    expect(stages).toEqual(['proposed', 'withdrawn', 'proposed', 'declined', 'proposed', 'expired'])
  })

  it('empty-sided or deadline-breaking offers are refused', () => {
    const l = drafted()
    const [p] = legalPair(l)
    expect(proposeTrade(d, l, 0, 1, [p], []).error).toMatch(/at least one player/)
    while (currentWeek(d, l) < 5) playNext(d, l)
    const [x, y] = [l.teams[0].roster[0], l.teams[1].roster[0]]
    expect(tradeProblem(d, l, 0, 1, [x], [y])).toMatch(/deadline/)
  })
})

describe('trading players who have already played (off roster)', () => {
  /** Play week 1 until one of my starters' counting match is over, with more of the week still to come. */
  function lockedStarter(l: League): number {
    l.teams[0].autoSub = false
    while (currentWeek(d, l) === 1) {
      const p = l.teams[0].starters.find((x) => x !== null && slotLocked(d, l, 0, x))
      if (p != null && d.matches[l.played].gw === 1) return p
      playNext(d, l)
    }
    throw new Error('no starter played early in week 1')
  }
  /** Propose, accept and approve; returns the offer. */
  function trade(l: League, from: number, to: number, give: number[], get: number[]) {
    const t = proposeTrade(d, l, from, to, give, get).trade!
    expect(t).toBeDefined()
    respondTrade(d, l, t.id, true)
    if (t.status === 'review') reviewTrade(d, l, t.id, true, l.commissionerId)
    return t
  }
  const partner = (l: League, p: number) => l.teams[1].roster.find((x) => !tradeProblem(d, l, 0, 1, [p], [x]))!

  it('a starter who has played stays in the old lineup this week, his points count there, and his slot is frozen', () => {
    const l = drafted()
    const p = lockedStarter(l)
    const slot = l.teams[0].starters.indexOf(p)
    expect(trade(l, 0, 1, [p], [partner(l, p)]).status).toBe('approved')
    expect(l.teams[0].roster).not.toContain(p)
    expect(l.teams[1].roster).toContain(p)
    expect(l.teams[0].starters[slot]).toBe(p)
    expect(isOffRoster(l, 0, p)).toBe(true)
    // nobody can reuse his slot this week, and his new team can't start him until next week
    const bench = l.teams[0].roster.find((x) => !l.teams[0].starters.includes(x) && d.players[x].elig.includes(SLOTS[slot]))
    if (bench !== undefined) {
      const next = [...l.teams[0].starters]
      next[slot] = bench
      expect(lineupProblem(d, l, 0, next)).toMatch(/locked/)
    }
    expect(l.teams[1].starters).not.toContain(p)
    const j = l.teams[1].starters.findIndex((x, i) => x !== null && !slotLocked(d, l, 1, x) && d.players[p].elig.includes(SLOTS[i]))
    if (j >= 0) {
      const theirs = [...l.teams[1].starters]
      theirs[j] = p
      expect(lineupProblem(d, l, 1, theirs)).toMatch(/can't come in/)
    }
    while (currentWeek(d, l) === 1) playNext(d, l)
    expect(l.results[1].starters[0]).toContain(p)
    expect(l.results[1].starters[1]).not.toContain(p)
    // the week is over: he leaves my lineup and the slot is refilled from my roster
    expect(l.teams[0].starters).not.toContain(p)
    expect(l.teams[0].starters.every((x) => x === null || l.teams[0].roster.includes(x))).toBe(true)
    expect(l.teams[0].offRoster).toBeUndefined()
  })

  it('traded back the same week, he is an ordinary starter again', () => {
    const l = drafted()
    const p = lockedStarter(l)
    const slot = l.teams[0].starters.indexOf(p)
    trade(l, 0, 1, [p], [partner(l, p)])
    const mine = l.teams[0].roster.find((x) => !tradeProblem(d, l, 0, 1, [x], [p]))!
    expect(trade(l, 0, 1, [mine], [p]).status).toBe('approved')
    expect(l.teams[0].roster).toContain(p)
    expect(l.teams[0].starters[slot]).toBe(p)
    expect(isOffRoster(l, 0, p)).toBe(false)
  })
})

describe('uneven trades and the roster limit', () => {
  /** A 1-for-2 from me to team 1 at the start of week 1 (nobody locked yet). */
  function oneForTwo(l: League) {
    const B = l.teams[1]
    for (const p of l.teams[0].roster) for (const q of B.roster) for (const r of B.roster) {
      if (q < r && !tradeProblem(d, l, 0, 1, [p], [q, r])) {
        const t = proposeTrade(d, l, 0, 1, [p], [q, r]).trade!
        respondTrade(d, l, t.id, true)
        reviewTrade(d, l, t.id, true, 0)
        expect(t.status).toBe('approved')
        return
      }
    }
    throw new Error('no legal 1-for-2 found')
  }

  it('goes through over the limit; until you drop, your lineup and adds are frozen', () => {
    const l = drafted()
    const me = l.teams[0]
    me.autoLineup = false
    oneForTwo(l)
    expect(me.roster).toHaveLength(ROSTER_SIZE + 1)
    expect(overLimit(l, 0)).toBe(1)
    expect(l.teams[1].roster).toHaveLength(ROSTER_SIZE - 1)
    expect(lineupProblem(d, l, 0, [...me.starters])).toMatch(/over the/)
    expect(optimizeLineup(d, l, 0)).toMatch(/over the/)
    const fa = d.pool.find((x) => addMode(d, l, x.idx) === 'free')!.idx
    expect(freeAgentAdd(d, l, 0, fa, me.roster[0])).toMatch(/over the/)
    expect(placeClaim(l, 0, fa, me.roster[0], 0)).toMatch(/over the/)
    const spare = me.roster.find((x) => !me.starters.includes(x))!
    expect(dropPlayer(d, l, 0, spare)).toBeNull()
    expect(overLimit(l, 0)).toBe(0)
    expect(lineupProblem(d, l, 0, [...me.starters])).toBeNull()
  })

  it('anyone still over the limit when the week ends loses their least valuable bench players', () => {
    const l = drafted()
    l.teams[0].autoLineup = false
    oneForTwo(l)
    while (currentWeek(d, l) === 1) playNext(d, l)
    const me = l.teams[0]
    expect(me.roster).toHaveLength(ROSTER_SIZE)
    expect(canFillLineup(d, me.roster)).toBe(true)
    expect(me.starters.every((x) => x !== null && me.roster.includes(x))).toBe(true)
    expect(l.txns.some((t) => t.teamId === 0 && t.type === 'drop' && /roster limit/.test(t.note ?? ''))).toBe(true)
  })

  it('AI managers drop down straight away, and count the players they would have to cut', () => {
    const l = drafted()
    const ros = (p: number) => restOfSeason(d, d.players[p], l.played)
    const B = l.teams[1]
    // three of my least valuable players for their best: not worth the two players they'd have to cut
    const junk = [...l.teams[0].roster].sort((a, b) => ros(a) - ros(b)).slice(0, 3)
    const star = [...B.roster].sort((a, b) => ros(b) - ros(a))[0]
    const offer = proposeTrade(d, l, 0, 1, junk, [star]).trade
    if (offer) expect(botTradeVerdict(d, l, offer).accept).toBe(false)
    // a 2-for-1 they accept leaves them at 16 for a moment: they drop one right away
    for (const p of l.teams[0].roster) for (const q of l.teams[0].roster) for (const r of B.roster) {
      if (p < q && !tradeProblem(d, l, 0, 1, [p, q], [r])) {
        const t = proposeTrade(d, l, 0, 1, [p, q], [r]).trade!
        respondTrade(d, l, t.id, true)
        reviewTrade(d, l, t.id, true, 0)
        expect(B.roster).toHaveLength(ROSTER_SIZE)
        expect(l.txns.some((x) => x.teamId === 1 && x.type === 'drop')).toBe(true)
        return
      }
    }
  })

  it('random uneven trades, including players who have played, never break a week', () => {
    for (let run = 0; run < 3; run++) {
      const l = drafted()
      const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
      const some = (xs: number[]) => [...xs].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3))
      let week = 0
      while (l.phase === 'season' && l.played < d.matches.length) {
        if (currentWeek(d, l) !== week) {
          week = currentWeek(d, l)
          // every week starts clean: rosters within the limit, lineups only from the roster, each player once
          const seen = new Set<number>()
          for (const t of l.teams) {
            expect(t.roster.length).toBeLessThanOrEqual(ROSTER_SIZE)
            expect(t.offRoster).toBeUndefined()
            for (const p of t.starters) if (p !== null) expect(t.roster).toContain(p)
            for (const p of t.roster) {
              expect(seen.has(p)).toBe(false)
              seen.add(p)
            }
          }
        }
        if (week < TRADE_DEADLINE_WEEK && Math.random() < 0.35) {
          const a = pick(l.teams)
          const b = pick(l.teams.filter((t) => t.id !== a.id))
          const give = some(a.roster)
          const get = some(b.roster)
          if (!tradeProblem(d, l, a.id, b.id, give, get)) {
            const t = proposeTrade(d, l, a.id, b.id, give, get).trade!
            respondTrade(d, l, t.id, true)
            if (t.status === 'review') reviewTrade(d, l, t.id, true, l.commissionerId)
          }
        }
        playNext(d, l)
      }
      expect(l.phase).toBe('complete')
      for (const [wk, r] of Object.entries(l.results)) {
        // no player counts for two teams in the same week, and every score is one counted match per starter
        const counted = new Set<number>()
        for (const t of l.teams) {
          let s = 0
          r.starters[t.id].forEach((p, i) => {
            const c = r.counted![t.id][i]
            if (p === null || c === null) return
            expect(counted.has(p)).toBe(false)
            counted.add(p)
            expect(weekMatches(d, p, Number(wk))).toContain(c)
            s += d.players[p].games.get(c)?.pts.total ?? 0
          })
          expect(r.scores[t.id]).toBeCloseTo(s, 2)
        }
      }
    }
  })
})

describe('chat', () => {
  it('tracks unread counts, read cursors and reactions', () => {
    const c = emptyChat()
    const ch = dmChannel(3, 0)
    expect(ch).toBe(dmChannel(0, 3))
    const m1 = post(c, { channel: ch, author: 3, date: '2026-03-28', week: 1, text: 'hi' })
    post(c, { channel: ch, author: 3, date: '2026-03-28', week: 1, text: 'trade?' })
    expect(unreadCount(c, ch, 0)).toBe(2)
    expect(unreadCount(c, ch, 3)).toBe(0) // your own messages are read
    markRead(c, ch, 0, m1.id)
    expect(unreadCount(c, ch, 0)).toBe(1)
    markRead(c, ch, 0)
    expect(unreadCount(c, ch, 0)).toBe(0)
    toggleReaction(c, m1.id, 0, '🔥')
    expect(c.messages[0].reactions).toEqual({ '🔥': [0] })
    toggleReaction(c, m1.id, 0, '🔥')
    expect(c.messages[0].reactions).toEqual({})
  })
})

describe('scoring', () => {
  it("charges a no-ball's own run to the bowler but not the leg-byes run off it", () => {
    // one ball: no-ball + 2 leg-byes = 3 extras; bowler is charged only the no-ball's 1
    const match = {
      squads: { A: [1], B: [2] },
      innings: [{ team: 'A', balls: [[0, 1, 2, 0, 3, FLAG_NOBALL | FLAG_LEGBYE]] }],
    } as unknown as RawMatch
    expect(computeLines(match).get(2)!.rc).toBe(1)
  })
})

describe('matchup swap choices', () => {
  function fixture() {
    const l = createLeague(d, { name: 'Swap check', teamName: 'Me', numTeams: 8, draftSlot: 'random', timer: 0, speed: 'instant' })
    l.phase = 'season'
    l.teams[0].starters = SLOTS.map(() => null)
    l.teams[0].roster = []
    return l
  }
  it('allows eligible BAT/FLEX and bench swaps, but checks eligibility in both directions', () => {
    const l = fixture(), me = l.teams[0]
    const [bat, otherBat] = d.pool.filter((p) => p.role === 'BAT')
    const bowler = d.pool.find((p) => p.role === 'BOWL')!
    const batSlot = SLOTS.indexOf('BAT'), flexSlot = SLOTS.indexOf('FLEX')
    me.roster = [bat.idx, otherBat.idx, bowler.idx]
    me.starters[batSlot] = bat.idx
    me.starters[flexSlot] = bowler.idx
    const blocked = swapTargets(d, l, 0, 1, batSlot)
    expect(blocked).not.toContainEqual({ kind: 'slot', i: flexSlot })
    expect(blocked).toContainEqual({ kind: 'bench', p: otherBat.idx })
    me.starters[flexSlot] = otherBat.idx
    expect(swapTargets(d, l, 0, 1, batSlot)).toContainEqual({ kind: 'slot', i: flexSlot })
    for (const to of swapTargets(d, l, 0, 1, batSlot)) {
      expect(lineupProblem(d, l, 0, applyMove(me.starters, { kind: 'slot', i: batSlot }, to))).toBeNull()
    }
  })
  it('hides locked bench replacements, locks the source and disallows past/future week edits', () => {
    const l = fixture(), me = l.teams[0]
    const lockedBat = d.pool.find((p) => p.role === 'BAT' && d.matches[0].teams.includes(p.team))!
    const unlockedBat = d.pool.find((p) => p.role === 'BAT' && !d.matches[0].teams.includes(p.team))!
    const slot = SLOTS.indexOf('BAT')
    me.roster = [lockedBat.idx, unlockedBat.idx]
    me.starters[slot] = unlockedBat.idx
    l.played = 1
    expect(swapTargets(d, l, 0, 1, slot)).not.toContainEqual({ kind: 'bench', p: lockedBat.idx })
    me.starters[slot] = lockedBat.idx
    expect(swapTargets(d, l, 0, 1, slot)).toEqual([])
    expect(swapTargets(d, l, 0, 2, slot)).toEqual([])
    l.phase = 'complete'
    expect(swapTargets(d, l, 0, 1, slot)).toEqual([])
  })
})

describe('in-place match simulation', () => {
  it('locks the live fixture without revealing results, then records it once through the existing engine', () => {
    const l = drafted()
    const me = l.teams[0]
    me.autoSub = false
    const p = d.pool.find((p) => d.teamMis[p.team][0] === 0 && p.elig.includes('BAT'))!
    const slot = SLOTS.indexOf('BAT')
    me.roster = [p.idx, ...me.roster.filter((id) => id !== p.idx)].slice(0, ROSTER_SIZE)
    me.starters = SLOTS.map(() => null)
    me.starters[slot] = p.idx
    const direct = structuredClone(l)
    expect(beginReplay(d, l)).toBeNull()
    expect(l.played).toBe(0)
    expect(l.results).toEqual({})
    expect(l.replayMatch).toBe(0)
    expect(isLocked(d, l, p.idx)).toBe(true)
    expect(slotLocked(d, l, 0, p.idx)).toBe(true)
    expect(lineupProblem(d, l, 0, SLOTS.map(() => null))).toMatch(/locked/)
    expect(beginReplay(d, l)).toBeNull()
    playNext(d, l)
    playNext(d, direct)
    expect(l.played).toBe(1)
    expect(l.replayMatch).toBeNull()
    expect(l.teams.map((t) => t.starters)).toEqual(direct.teams.map((t) => t.starters))
  })
})

describe('team profile pictures', () => {
  it('gives every team its own picture: AI managers theirs, you a random one', () => {
    const l = createLeague(d, { name: 'Test', teamName: 'Me', numTeams: 10, draftSlot: 'random', timer: 0, speed: 'instant' })
    const pics = l.teams.map((t) => t.avatar)
    expect(new Set(pics).size).toBe(l.teams.length)
    expect(USER_AVATARS).toContain(l.teams[0].avatar)
    for (const t of l.teams.slice(1)) expect(t.avatar).toBe(BOT_AVATARS[t.owner.replace('AI · ', '')])
  })

  it('fills in pictures for leagues saved before they existed, the same way every load', () => {
    const l = createLeague(d, { name: 'Test', teamName: 'Me', numTeams: 8, draftSlot: 'random', timer: 0, speed: 'instant' })
    const old = structuredClone(l)
    for (const t of old.teams) delete (t as { avatar?: string }).avatar
    const a = upgradeLeague(old)
    expect(a.teams.slice(1).map((t) => t.avatar)).toEqual(l.teams.slice(1).map((t) => t.avatar))
    expect(USER_AVATARS).toContain(a.teams[0].avatar)
    expect(upgradeLeague(old).teams[0].avatar).toBe(a.teams[0].avatar)
  })
})

describe('forecast caches', () => {
  it('give the same projections whatever order the cutoffs are asked for in', () => {
    const p = d.pool.find((p) => p.games.size > 5)!
    const mi = d.teamMis[p.team].at(-1)!
    for (let c = 0; c <= mi; c++) matchProjection(d, p, mi, c)
    // a fresh copy starts with empty caches; build its snapshots out of order, later cutoffs first
    const fresh = structuredClone(d), q = fresh.players[p.idx]
    for (const c of [mi, 0, Math.floor(mi / 2), mi - 1, 3, Math.floor(mi / 2) + 1]) {
      expect(matchProjection(fresh, q, mi, c)).toEqual(matchProjection(d, p, mi, c))
      expect(restOfSeason(fresh, q, c)).toBe(restOfSeason(d, p, c))
    }
    // the 'learned' mode's fitted weights are built on first use
    const learned = matchupAdjustment(fresh, q, mi, 20, 10, 'learned')
    expect(learned).toEqual(matchupAdjustment(d, p, mi, 20, 10, 'learned'))
    expect(learned.components.every((c) => Number.isFinite(c.points))).toBe(true)
  })
})
