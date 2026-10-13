// League engine: pure-ish functions that mutate a League object (callers pass a fresh copy).
import {
  matchProjection, restOfSeason,
  type Data, type Player,
} from './data'
import type { SlotType } from './types'
import { dmChannel, emptyChat, LEAGUE_CHANNEL, post, type ChannelId, type ChatEvent, type ChatState, type TradeStage } from './chat'

export const SLOTS: SlotType[] = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'BOWL', 'BOWL', 'BOWL', 'BOWL', 'FLEX', 'FLEX']
export const ROSTER_SIZE = 15
export const REG_WEEKS = 6
export const LAST_WEEK = 8
export const TRADE_DEADLINE_WEEK = 5
export const FAAB_BUDGET = 100

export type Persona = 'balanced' | 'batting' | 'bowling' | 'upside' | 'steady'

export const PERSONA_LABEL: Record<Persona, string> = {
  balanced: 'Balanced',
  batting: 'Bat-first',
  bowling: 'Bowl-first',
  upside: 'Boom-or-bust',
  steady: 'Steady',
}

export interface FTeam {
  id: number
  name: string
  owner: string
  isUser: boolean
  persona: Persona
  color: string
  roster: number[]
  starters: (number | null)[]
  faab: number
  autoSub: boolean
  autoLineup?: boolean
  /** matches locked in for the current week: player → IPL match index (absent = his first match counts) */
  picks?: { week: number; byPlayer: Record<number, number> }
}

export interface Pick {
  overall: number
  round: number
  pick: number
  teamId: number
  player: number
}

export interface DraftState {
  order: number[]
  picks: Pick[]
  rounds: number
  timer: number
  speed: 'normal' | 'fast' | 'instant'
  queue: number[]
  startedAt: number
}

export interface Matchup {
  week: number
  a: number
  b: number
  kind: 'regular' | 'playoff' | 'consolation'
  label?: string
}

export interface WeekResult {
  week: number
  scores: Record<number, number>
  proj: Record<number, number>
  starters: Record<number, (number | null)[]>
  median: number | null
  /** the one match that counted for each starter (parallel to `starters`) */
  counted?: Record<number, (number | null)[]>
}

export interface Txn {
  id: number
  played: number
  week: number
  type: 'add' | 'drop' | 'waiver' | 'trade' | 'autosub' | 'waiver-fail'
  teamId: number
  otherTeamId?: number
  adds: number[]
  drops: number[]
  bid?: number
  note?: string
}

export interface Claim {
  id: number
  teamId: number
  add: number
  drop: number | null
  bid: number
}

export type TradeStatus = 'pending' | 'declined' | 'withdrawn' | 'expired' | 'review' | 'approved' | 'vetoed' | 'failed'

/** A trade offer from one manager to another. `give` moves from → to, `get` moves to → from. */
export interface TradeOffer {
  id: number
  from: number
  to: number
  give: number[]
  get: number[]
  status: TradeStatus
  week: number
  createdAt: number
  /** a pending offer expires at the end of this week */
  expiresWeek: number
  note?: string
  /** why it failed, or who/what resolved it */
  reason?: string
  resolvedAt?: number
}

export interface LeagueSettings {
  /** 'commissioner': accepted trades wait for the commissioner (or the review period) before processing */
  tradeReview: 'commissioner' | 'none'
}

export interface League {
  dataVersion: string
  name: string
  createdAt: number
  numTeams: number
  teams: FTeam[]
  phase: 'draft' | 'season' | 'complete'
  draft: DraftState
  played: number
  schedule: Matchup[]
  results: Record<number, WeekResult>
  claims: Claim[]
  waiverOrder: number[]
  onWaivers: number[]
  txns: Txn[]
  nextId: number
  champion: number | null
  commissionerId: number
  settings: LeagueSettings
  trades: TradeOffer[]
  chat: ChatState
}

/** Fill in fields added after a league was first saved. */
export function upgradeLeague(l: League): League {
  return {
    ...l,
    commissionerId: l.commissionerId ?? 0,
    settings: { tradeReview: l.settings?.tradeReview ?? 'commissioner' },
    trades: l.trades ?? [],
    chat: l.chat ?? emptyChat(),
  }
}

// ---------------------------------------------------------------- setup

const BOT_TEAMS: { name: string; owner: string; persona: Persona; color: string }[] = [
  { name: 'Yorker Kings', owner: 'AI · Ravi', persona: 'bowling', color: '#22c55e' },
  { name: 'Doosra Dynasty', owner: 'AI · Meera', persona: 'balanced', color: '#f97316' },
  { name: 'Powerplay Pirates', owner: 'AI · Arjun', persona: 'batting', color: '#eab308' },
  { name: 'Silly Point Society', owner: 'AI · Kabir', persona: 'upside', color: '#a855f7' },
  { name: 'Reverse Sweepers', owner: 'AI · Zoya', persona: 'steady', color: '#06b6d4' },
  { name: 'Googly Gang', owner: 'AI · Dev', persona: 'bowling', color: '#ec4899' },
  { name: 'Death Over Demons', owner: 'AI · Sana', persona: 'batting', color: '#ef4444' },
  { name: 'Free Hit Frenzy', owner: 'AI · Neel', persona: 'upside', color: '#84cc16' },
  { name: 'The Nightwatchmen', owner: 'AI · Isha', persona: 'steady', color: '#3b82f6' },
]

export interface LeagueOptions {
  name: string
  teamName: string
  numTeams: number
  draftSlot: number | 'random'
  timer: number
  speed: DraftState['speed']
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function createLeague(d: Data, o: LeagueOptions): League {
  const bots = shuffle(BOT_TEAMS).slice(0, o.numTeams - 1)
  const teams: FTeam[] = [
    { id: 0, name: o.teamName || 'My Team', owner: 'You', isUser: true, persona: 'balanced', color: '#2dd4bf', roster: [], starters: SLOTS.map(() => null), faab: FAAB_BUDGET, autoSub: true, autoLineup: true },
    ...bots.map((b, i) => ({ id: i + 1, ...b, isUser: false, roster: [], starters: SLOTS.map(() => null), faab: FAAB_BUDGET, autoSub: true })),
  ]
  let order = shuffle(teams.map((t) => t.id))
  if (o.draftSlot !== 'random') {
    order = order.filter((id) => id !== 0)
    order.splice(o.draftSlot - 1, 0, 0)
  }
  const l: League = {
    dataVersion: d.version,
    name: o.name || 'IPL Draft League',
    createdAt: Date.now(),
    numTeams: o.numTeams,
    teams,
    phase: 'draft',
    draft: { order, picks: [], rounds: ROSTER_SIZE, timer: o.timer, speed: o.speed, queue: [], startedAt: Date.now() },
    played: 0,
    schedule: roundRobin(teams.map((t) => t.id)),
    results: {},
    claims: [],
    waiverOrder: [...order].reverse(),
    onWaivers: [],
    txns: [],
    nextId: 1,
    champion: null,
    commissionerId: 0,
    settings: { tradeReview: 'commissioner' },
    trades: [],
    chat: emptyChat(),
  }
  say(d, l, LEAGUE_CHANNEL, null, { event: { type: 'league-created' } })
  return l
}

function roundRobin(ids: number[]): Matchup[] {
  const t = shuffle(ids)
  const n = t.length
  const out: Matchup[] = []
  for (let r = 0; r < REG_WEEKS; r++) {
    for (let i = 0; i < n / 2; i++) {
      out.push({ week: r + 1, a: t[i], b: t[n - 1 - i], kind: 'regular' })
    }
    // rotate all but first
    t.splice(1, 0, t.pop()!)
  }
  return out
}

// ---------------------------------------------------------------- draft

/** Snake order: the team making overall pick k (0-based). */
export function teamAtPick(l: League, k: number): number {
  const n = l.numTeams
  const i = k % n
  return Math.floor(k / n) % 2 === 0 ? l.draft.order[i] : l.draft.order[n - 1 - i]
}

export function teamOnClock(l: League): number | null {
  const k = l.draft.picks.length
  return k >= l.numTeams * l.draft.rounds ? null : teamAtPick(l, k)
}

export function draftedSet(l: League): Set<number> {
  return new Set(l.draft.picks.map((p) => p.player))
}

export function preseasonValue(p: Player): number {
  return p.prior.perMatch * p.prior.avail * 14
}

/** How many of each requirement a roster still needs */
function needs(d: Data, roster: number[]) {
  const ps = roster.map((i) => d.players[i])
  const wk = ps.filter((p) => p.role === 'WK').length
  const bat = ps.filter((p) => p.elig.includes('BAT')).length
  const bowl = ps.filter((p) => p.elig.includes('BOWL')).length
  return { wk, bat, bowl, needWk: Math.max(0, 1 - wk), needBat: Math.max(0, 5 - bat), needBowl: Math.max(0, 5 - bowl) }
}

export function chooseDraftPick(d: Data, l: League, teamId: number, opts: { useQueue?: boolean; noise?: number } = {}): number {
  const team = l.teams[teamId]
  const taken = draftedSet(l)
  const avail = d.pool.filter((p) => !taken.has(p.idx))
  const nd = needs(d, team.roster)
  const picksLeft = l.draft.rounds - team.roster.length
  const mustFill = nd.needWk + nd.needBat + nd.needBowl >= picksLeft

  const fits = (p: Player) => {
    if (!mustFill) return true
    if (nd.needWk && p.role === 'WK') return true
    if (nd.needBat && p.elig.includes('BAT')) return true
    if (nd.needBowl && p.elig.includes('BOWL')) return true
    return false
  }

  if (opts.useQueue) {
    const q = l.draft.queue.find((i) => !taken.has(i) && fits(d.players[i]))
    if (q !== undefined) return q
  }

  const noise = opts.noise ?? 0.14
  let best = avail[0]
  let bestV = -Infinity
  for (const p of avail) {
    if (!fits(p)) continue
    let v = preseasonValue(p)
    const persona = team.persona
    if (persona === 'batting' && (p.role === 'BAT' || p.role === 'WK' || p.role === 'ARB')) v *= 1.12
    if (persona === 'bowling' && (p.role === 'BOWL' || p.role === 'ARW')) v *= 1.12
    if (persona === 'steady') v *= 0.85 + 0.3 * p.prior.avail
    const nz = persona === 'upside' ? noise * 2 : noise
    v *= 1 + (Math.random() * 2 - 1) * nz
    // positional sanity: avoid hoarding keepers / one-dimensional rosters
    if (p.role === 'WK' && nd.wk >= 2) v *= 0.4
    if (p.role === 'WK' && nd.wk === 0 && team.roster.length >= 4) v *= 1.15
    if (!p.elig.includes('BOWL') && nd.bat >= 8) v *= 0.6
    if (!p.elig.includes('BAT') && nd.bowl >= 8) v *= 0.6
    if (v > bestV) {
      bestV = v
      best = p
    }
  }
  return best.idx
}

export function makePick(d: Data, l: League, player: number) {
  const teamId = teamOnClock(l)
  if (teamId === null) return
  const k = l.draft.picks.length
  l.draft.picks.push({ overall: k + 1, round: Math.floor(k / l.numTeams) + 1, pick: (k % l.numTeams) + 1, teamId, player })
  l.teams[teamId].roster.push(player)
  l.draft.queue = l.draft.queue.filter((q) => q !== player)
  if (teamOnClock(l) === null) finishDraft(d, l)
}

function finishDraft(d: Data, l: League) {
  l.phase = 'season'
  for (const t of l.teams) t.starters = bestLineup(d, l, t, 1).starters
  say(d, l, LEAGUE_CHANNEL, null, { event: { type: 'draft-complete' } })
}

// ---------------------------------------------------------------- calendar

export function currentWeek(d: Data, l: League): number {
  if (l.played >= d.matches.length) return LAST_WEEK
  return d.matches[l.played].gw
}

/** His week has started: at least one of his matches this week has begun. He can't be dropped, traded or
 *  added as a free agent, and the choice of which match counts is closed. */
export function isLocked(d: Data, l: League, p: number, week = currentWeek(d, l)): boolean {
  if (l.played >= d.matches.length) return true
  const pl = d.players[p]
  const mis = d.teamGw[pl.team]?.[week] ?? []
  return mis.some((mi) => mi < l.played)
}

// ---------------------------------------------------------------- one match counts
// Only one of a player's matches counts each week. By default it's his first match. A manager can lock in a
// later one, but only before his first match of the week starts, so nobody picks with hindsight. In the
// lineup a player is fixed once the match that counts for him has started.

/** A player's IPL matches in a gameweek, in order. */
export function weekMatches(d: Data, p: number, week: number): number[] {
  return d.teamGw[d.players[p].team]?.[week] ?? []
}

/** The match a manager explicitly locked in this week, if any. */
export function lockedPick(l: League, teamId: number | null, p: number, week: number): number | undefined {
  if (teamId === null) return undefined
  const picks = l.teams[teamId].picks
  return picks?.week === week ? picks.byPlayer[p] : undefined
}

/** The one match that counts for this player on this team: the locked-in pick, otherwise his first match. */
export function countedMatch(d: Data, l: League, teamId: number | null, p: number, week: number): number | null {
  const mis = weekMatches(d, p, week)
  if (!mis.length) return null
  const r = l.results[week]
  if (r?.counted && teamId !== null) {
    const i = r.starters[teamId]?.indexOf(p) ?? -1
    if (i >= 0) return r.counted[teamId]?.[i] ?? null
  }
  const pick = lockedPick(l, teamId, p, week)
  return pick !== undefined && mis.includes(pick) ? pick : mis[0]
}

/** The match choice is open until his first match of the week starts (and only matters with 2+ matches). */
export function pickOpen(d: Data, l: League, p: number): boolean {
  return l.phase === 'season' && weekMatches(d, p, currentWeek(d, l)).length > 1 && !isLocked(d, l, p)
}

/** Lock in which match counts (null or his first match = back to the default). */
export function setMatchPick(d: Data, l: League, teamId: number, p: number, mi: number | null): string | null {
  const team = l.teams[teamId]
  const week = currentWeek(d, l)
  const mis = weekMatches(d, p, week)
  if (l.phase !== 'season') return 'The season is not in progress.'
  if (!team.roster.includes(p)) return 'He is not on this roster.'
  if (mis.length < 2) return 'He only has one match this week.'
  if (isLocked(d, l, p)) return 'Too late: his first match of the week has started, so his choice is locked.'
  if (mi !== null && !mis.includes(mi)) return 'That match is not in his week.'
  if (team.picks?.week !== week) team.picks = { week, byPlayer: {} }
  if (mi === null || mi === mis[0]) delete team.picks.byPlayer[p]
  else team.picks.byPlayer[p] = mi
  return null
}

/** Fixed in (or out of) the lineup: the match that counts for him has started. */
export function slotLocked(d: Data, l: League, teamId: number, p: number, week = currentWeek(d, l)): boolean {
  if (l.phase !== 'season' || l.played >= d.matches.length) return true
  const cur = currentWeek(d, l)
  if (week !== cur) return week < cur
  const c = countedMatch(d, l, teamId, p, week)
  return c !== null && c < l.played
}

/** A player's week: points (or projection) from his counted match only. */
export function playerWeek(
  d: Data, l: League, teamId: number | null, p: number, week: number, played = l.played,
): { mi: number | null; banked: number; remaining: number; total: number } {
  const mi = countedMatch(d, l, teamId, p, week)
  if (mi === null) return { mi, banked: 0, remaining: 0, total: 0 }
  const pl = d.players[p]
  if (mi < played) {
    const banked = pl.games.get(mi)?.pts.total ?? 0
    return { mi, banked, remaining: 0, total: banked }
  }
  const remaining = matchProjection(d, pl, mi, played).total
  return { mi, banked: 0, remaining, total: remaining }
}

/** Why a new lineup isn't allowed, or null. Guards against moving anyone whose counting match has begun. */
export function lineupProblem(d: Data, l: League, teamId: number, next: (number | null)[]): string | null {
  const team = l.teams[teamId]
  const cur = team.starters
  if (next.length !== SLOTS.length) return 'Invalid lineup.'
  for (let i = 0; i < SLOTS.length; i++) {
    const was = cur[i]
    if (was !== null && next[i] !== was && slotLocked(d, l, teamId, was)) return `${d.players[was].name} is locked: the match that counts for him has started.`
  }
  const seen = new Set<number>()
  for (let i = 0; i < SLOTS.length; i++) {
    const p = next[i]
    if (p === null) continue
    const name = d.players[p].name
    if (seen.has(p)) return `${name} is in the lineup twice.`
    seen.add(p)
    if (!team.roster.includes(p)) return `${name} is not on your roster.`
    if (!d.players[p].elig.includes(SLOTS[i])) return `${name} can't play ${SLOTS[i]}.`
    if (!cur.includes(p) && slotLocked(d, l, teamId, p)) return `${name} can't come in: the match that counts for him has already started.`
  }
  return null
}

// ---------------------------------------------------------------- lineups

/** Max-weight lineup. Greedy over a transversal matroid with augmenting paths = optimal. */
export function bestLineup(d: Data, l: League, team: FTeam, week: number, respectLocks = false): { starters: (number | null)[] } {
  const starters: (number | null)[] = SLOTS.map(() => null)
  const fixed = new Set<number>()
  const lockedBench = new Set<number>()
  if (respectLocks) {
    team.starters.forEach((p, i) => {
      if (p !== null && slotLocked(d, l, team.id, p, week)) {
        starters[i] = p
        fixed.add(i)
      }
    })
    for (const p of team.roster) if (!team.starters.includes(p) && slotLocked(d, l, team.id, p, week)) lockedBench.add(p)
  }
  const used = new Set(starters.filter((x): x is number => x !== null))
  const value = new Map(team.roster.map((p) => [p, playerWeek(d, l, team.id, p, week).total + 0.001 * preseasonValue(d.players[p])]))
  const cands = team.roster.filter((p) => !used.has(p) && !lockedBench.has(p)).sort((a, b) => value.get(b)! - value.get(a)!)

  const assign: (number | null)[] = [...starters]
  const tryAssign = (p: number, visited: Set<number>): boolean => {
    for (let i = 0; i < SLOTS.length; i++) {
      if (fixed.has(i) || visited.has(i) || !d.players[p].elig.includes(SLOTS[i])) continue
      visited.add(i)
      const cur = assign[i]
      if (cur === null || tryAssign(cur, visited)) {
        assign[i] = p
        return true
      }
    }
    return false
  }
  for (const p of cands) {
    const snapshot = [...assign]
    if (!tryAssign(p, new Set())) assign.splice(0, assign.length, ...snapshot)
  }
  // prefer specialists in their own slots: move players so FLEX holds the lowest-value fits (cosmetic)
  return { starters: assign }
}

export function canFillLineup(d: Data, roster: number[]): boolean {
  const assign: (number | null)[] = SLOTS.map(() => null)
  const tryAssign = (p: number, visited: Set<number>): boolean => {
    for (let i = 0; i < SLOTS.length; i++) {
      if (visited.has(i) || !d.players[p].elig.includes(SLOTS[i])) continue
      visited.add(i)
      if (assign[i] === null || tryAssign(assign[i]!, visited)) {
        assign[i] = p
        return true
      }
    }
    return false
  }
  for (const p of roster) tryAssign(p, new Set())
  return assign.every((x) => x !== null)
}

// ---------------------------------------------------------------- sim

function log(l: League, t: Omit<Txn, 'id' | 'played'>) {
  l.txns.unshift({ ...t, id: l.nextId++, played: l.played })
}

/** League calendar day: the day of the next match (or the last one once the season is over). */
export function leagueDate(d: Data, l: League): string {
  return d.matches[Math.min(l.played, d.matches.length - 1)].raw.date
}

/** Post to a chat channel, stamped with the league calendar. */
export function say(
  d: Data, l: League, channel: ChannelId, author: number | null,
  body: { text?: string; event?: ChatEvent }, stamp?: { date: string; week: number },
) {
  return post(l.chat, { channel, author, date: stamp?.date ?? leagueDate(d, l), week: stamp?.week ?? currentWeek(d, l), ...body })
}

/** At the toss: a starter whose counting match is this one but who isn't in the XI is swapped for the best
 *  eligible bench player whose own counting match hasn't started yet. */
function autoSubs(d: Data, l: League, mi: number) {
  const m = d.matches[mi]
  const week = m.gw
  for (const team of l.teams) {
    if (!team.autoSub) continue
    team.starters.forEach((p, slot) => {
      if (p === null) return
      if (countedMatch(d, l, team.id, p, week) !== mi || m.xi.has(p)) return
      let best: number | null = null
      let bestV = 0
      for (const c of team.roster) {
        if (team.starters.includes(c) || !d.players[c].elig.includes(SLOTS[slot])) continue
        const cm = countedMatch(d, l, team.id, c, week)
        if (cm === null || cm < mi || (cm === mi && !m.xi.has(c))) continue
        const v = playerWeek(d, l, team.id, c, week).total
        if (v > bestV) {
          bestV = v
          best = c
        }
      }
      if (best !== null) {
        team.starters[slot] = best
        log(l, { week, type: 'autosub', teamId: team.id, adds: [best], drops: [p], note: `${d.players[p].name} not in XI` })
      }
    })
  }
}

export function playNext(d: Data, l: League) {
  if (l.phase !== 'season' || l.played >= d.matches.length) return
  const mi = l.played
  endReviewPeriod(d, l)
  autoSubs(d, l, mi)
  l.played++
  const week = d.matches[mi].gw
  const lastOfWeek = l.played >= d.matches.length || d.matches[l.played].gw !== week
  if (lastOfWeek) endWeek(d, l, week)
}

function endWeek(d: Data, l: League, week: number) {
  const scores: Record<number, number> = {}
  const proj: Record<number, number> = {}
  const starters: Record<number, (number | null)[]> = {}
  const counted: Record<number, (number | null)[]> = {}
  const firstMi = d.gameweeks[week - 1].mis[0]
  for (const t of l.teams) {
    starters[t.id] = [...t.starters]
    counted[t.id] = t.starters.map((p) => (p === null ? null : countedMatch(d, l, t.id, p, week)))
    let s = 0
    let pj = 0
    t.starters.forEach((p, i) => {
      const mi = counted[t.id][i]
      if (p === null || mi === null) return
      const pl = d.players[p]
      s += pl.games.get(mi)?.pts.total ?? 0
      pj += matchProjection(d, pl, mi, firstMi).total
    })
    scores[t.id] = Math.round(s * 100) / 100
    proj[t.id] = Math.round(pj * 100) / 100
    t.picks = undefined
  }
  let median: number | null = null
  if (week <= REG_WEEKS) {
    const xs = Object.values(scores).sort((a, b) => a - b)
    const n = xs.length
    median = n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2
  }
  l.results[week] = { week, scores, proj, starters, median, counted }
  const stamp = { date: d.matches[l.played - 1].raw.date, week }
  say(d, l, LEAGUE_CHANNEL, null, { event: { type: 'week-result', week } }, stamp)

  if (week === REG_WEEKS) {
    seedPlayoffs(d, l)
    say(d, l, LEAGUE_CHANNEL, null, { event: { type: 'playoffs-set' } }, stamp)
  }
  if (week === REG_WEEKS + 1) setFinals(l)
  if (week === LAST_WEEK) {
    const final = l.schedule.find((m) => m.week === LAST_WEEK && m.label === 'Championship')
    if (final) l.champion = matchupWinner(l, final)
    if (l.champion !== null) say(d, l, LEAGUE_CHANNEL, null, { event: { type: 'champion', teamId: l.champion } }, stamp)
    l.phase = 'complete'
    return
  }
  expireOffers(d, l, week)
  processWaivers(d, l, week, stamp)
  for (const t of l.teams) if (!t.isUser || t.autoLineup) t.starters = bestLineup(d, l, t, week + 1).starters
  botTradeActivity(d, l, week)
}

export function matchupWinner(l: League, m: Matchup): number | null {
  const r = l.results[m.week]
  if (!r) return null
  const a = r.scores[m.a]
  const b = r.scores[m.b]
  if (a === b) return null
  return a > b ? m.a : m.b
}

export interface StandingRow {
  teamId: number
  w: number
  l: number
  t: number
  mw: number
  ml: number
  pf: number
  pa: number
  streak: string
}

export function standings(l: League): StandingRow[] {
  const rows: Record<number, StandingRow> = {}
  for (const t of l.teams) rows[t.id] = { teamId: t.id, w: 0, l: 0, t: 0, mw: 0, ml: 0, pf: 0, pa: 0, streak: '' }
  const streaks: Record<number, string[]> = {}
  for (let w = 1; w <= REG_WEEKS; w++) {
    const r = l.results[w]
    if (!r) continue
    for (const m of l.schedule.filter((x) => x.week === w)) {
      const sa = r.scores[m.a]
      const sb = r.scores[m.b]
      rows[m.a].pf += sa
      rows[m.a].pa += sb
      rows[m.b].pf += sb
      rows[m.b].pa += sa
      if (sa > sb) {
        rows[m.a].w++
        rows[m.b].l++
        ;(streaks[m.a] ??= []).push('W')
        ;(streaks[m.b] ??= []).push('L')
      } else if (sb > sa) {
        rows[m.b].w++
        rows[m.a].l++
        ;(streaks[m.b] ??= []).push('W')
        ;(streaks[m.a] ??= []).push('L')
      } else {
        rows[m.a].t++
        rows[m.b].t++
      }
    }
    if (r.median !== null) {
      for (const t of l.teams) {
        if (r.scores[t.id] > r.median) rows[t.id].mw++
        else if (r.scores[t.id] < r.median) rows[t.id].ml++
      }
    }
  }
  for (const t of l.teams) {
    const s = streaks[t.id] ?? []
    if (s.length) {
      const last = s[s.length - 1]
      let k = 0
      for (let i = s.length - 1; i >= 0 && s[i] === last; i--) k++
      rows[t.id].streak = `${last}${k}`
    }
  }
  return Object.values(rows).sort((a, b) => b.w + b.mw - (a.w + a.mw) || b.pf - a.pf)
}

function seedPlayoffs(_d: Data, l: League) {
  const seeds = standings(l).map((r) => r.teamId)
  const wk = REG_WEEKS + 1
  const add = (a: number, b: number, kind: Matchup['kind'], label: string) => l.schedule.push({ week: wk, a, b, kind, label })
  add(seeds[0], seeds[3], 'playoff', 'Semifinal 1')
  add(seeds[1], seeds[2], 'playoff', 'Semifinal 2')
  add(seeds[4], seeds[7], 'consolation', 'Consolation 1')
  add(seeds[5], seeds[6], 'consolation', 'Consolation 2')
  if (seeds.length >= 10) add(seeds[8], seeds[9], 'consolation', 'Toilet Bowl')
}

function setFinals(l: League) {
  const wk = REG_WEEKS + 1
  const get = (label: string) => l.schedule.find((m) => m.week === wk && m.label === label)!
  const wl = (m: Matchup) => {
    const w = matchupWinner(l, m) ?? m.a
    return [w, w === m.a ? m.b : m.a]
  }
  const [s1w, s1l] = wl(get('Semifinal 1'))
  const [s2w, s2l] = wl(get('Semifinal 2'))
  const [c1w, c1l] = wl(get('Consolation 1'))
  const [c2w, c2l] = wl(get('Consolation 2'))
  const add = (a: number, b: number, kind: Matchup['kind'], label: string) => l.schedule.push({ week: LAST_WEEK, a, b, kind, label })
  add(s1w, s2w, 'playoff', 'Championship')
  add(s1l, s2l, 'playoff', '3rd place')
  add(c1w, c2w, 'consolation', '5th place')
  add(c1l, c2l, 'consolation', '7th place')
  const tb = l.schedule.find((m) => m.week === wk && m.label === 'Toilet Bowl')
  if (tb) add(tb.a, tb.b, 'consolation', 'Toilet Bowl final')
}

// ---------------------------------------------------------------- transactions

export function rosteredBy(l: League): Map<number, number> {
  const m = new Map<number, number>()
  for (const t of l.teams) for (const p of t.roster) m.set(p, t.id)
  return m
}

export type AddMode = 'free' | 'waiver' | 'none'

/** Pass `owned` (from rosteredBy) when calling this for many players. */
export function addMode(d: Data, l: League, p: number, owned = rosteredBy(l)): AddMode {
  if (l.phase !== 'season') return 'none'
  if (owned.has(p)) return 'none'
  if (l.onWaivers.includes(p) || isLocked(d, l, p)) return 'waiver'
  return 'free'
}

function removeFromTeam(team: FTeam, p: number) {
  team.roster = team.roster.filter((x) => x !== p)
  team.starters = team.starters.map((x) => (x === p ? null : x))
  if (team.picks) delete team.picks.byPlayer[p]
}

export function freeAgentAdd(d: Data, l: League, teamId: number, add: number, drop: number | null): string | null {
  const team = l.teams[teamId]
  if (addMode(d, l, add) !== 'free') return 'Player is not a free agent right now'
  if (drop !== null && isLocked(d, l, drop)) return 'That player is locked for this week'
  if (drop === null && team.roster.length >= ROSTER_SIZE) return 'Roster full — choose a player to drop'
  const next = team.roster.filter((x) => x !== drop).concat(add)
  if (!canFillLineup(d, next)) return 'That move would leave you unable to fill a legal lineup'
  if (drop !== null) {
    removeFromTeam(team, drop)
    l.onWaivers.push(drop)
  }
  team.roster.push(add)
  log(l, { week: currentWeek(d, l), type: 'add', teamId, adds: [add], drops: drop !== null ? [drop] : [] })
  say(d, l, LEAGUE_CHANNEL, null, { event: { type: 'txn', teamId, adds: [add], drops: drop !== null ? [drop] : [] } })
  return null
}

export function placeClaim(l: League, teamId: number, add: number, drop: number | null, bid: number): string | null {
  const team = l.teams[teamId]
  if (bid < 0 || bid > team.faab) return `Bid must be between $0 and $${team.faab}`
  l.claims = l.claims.filter((c) => !(c.teamId === teamId && c.add === add))
  l.claims.push({ id: l.nextId++, teamId, add, drop, bid })
  return null
}

function processWaivers(d: Data, l: League, week: number, stamp: { date: string; week: number }) {
  const nextWeek = week + 1
  const owned = rosteredBy(l)
  // bot claims
  const fa = d.pool.filter((p) => !owned.has(p.idx))
  const ros = (p: Player) => restOfSeason(d, p, l.played)
  const faSorted = fa.map((p) => ({ p, v: ros(p) })).sort((a, b) => b.v - a.v).slice(0, 25)
  for (const t of l.teams) {
    if (t.isUser) continue
    const bench = t.roster.map((i) => ({ i, v: ros(d.players[i]) })).sort((a, b) => a.v - b.v)
    let claims = 0
    for (const { p, v } of faSorted) {
      if (claims >= 2) break
      const drop = bench.find((b) => b.v * 1.2 + 4 < v && canFillLineup(d, t.roster.filter((x) => x !== b.i).concat(p.idx)))
      if (!drop) continue
      const gain = v - drop.v
      const aggro = t.persona === 'upside' ? 0.35 : t.persona === 'steady' ? 0.12 : 0.22
      const bid = Math.min(t.faab, Math.max(0, Math.round(gain * aggro * (0.6 + Math.random() * 0.8))))
      l.claims.push({ id: l.nextId++, teamId: t.id, add: p.idx, drop: drop.i, bid })
      bench.splice(bench.indexOf(drop), 1)
      claims++
    }
  }
  const prio = (teamId: number) => l.waiverOrder.indexOf(teamId)
  const sorted = [...l.claims].sort((a, b) => b.bid - a.bid || prio(a.teamId) - prio(b.teamId))
  const won = new Set<number>()
  const results: { teamId: number; add: number; drop: number | null; bid: number }[] = []
  for (const c of sorted) {
    const t = l.teams[c.teamId]
    const takenNow = rosteredBy(l)
    const fail = (why: string) => {
      if (t.isUser) log(l, { week: nextWeek, type: 'waiver-fail', teamId: t.id, adds: [c.add], drops: c.drop !== null ? [c.drop] : [], bid: c.bid, note: why })
    }
    if (won.has(c.add) || takenNow.has(c.add)) {
      fail('Outbid or already claimed')
      continue
    }
    if (c.bid > t.faab) {
      fail('Not enough FAAB')
      continue
    }
    if (c.drop !== null && !t.roster.includes(c.drop)) {
      fail('Drop player no longer on roster')
      continue
    }
    if (c.drop === null && t.roster.length >= ROSTER_SIZE) {
      fail('Roster full')
      continue
    }
    const next = t.roster.filter((x) => x !== c.drop).concat(c.add)
    if (!canFillLineup(d, next)) {
      fail('Would leave an illegal roster')
      continue
    }
    if (c.drop !== null) removeFromTeam(t, c.drop)
    t.roster.push(c.add)
    t.faab -= c.bid
    won.add(c.add)
    l.waiverOrder = l.waiverOrder.filter((x) => x !== t.id).concat(t.id)
    log(l, { week: nextWeek, type: 'waiver', teamId: t.id, adds: [c.add], drops: c.drop !== null ? [c.drop] : [], bid: c.bid })
    results.push({ teamId: t.id, add: c.add, drop: c.drop, bid: c.bid })
  }
  l.claims = []
  l.onWaivers = []
  if (results.length) say(d, l, LEAGUE_CHANNEL, null, { event: { type: 'waivers', week, claims: results } }, stamp)
}

export function dropPlayer(d: Data, l: League, teamId: number, p: number): string | null {
  const team = l.teams[teamId]
  if (isLocked(d, l, p)) return 'That player is locked for this week'
  removeFromTeam(team, p)
  l.onWaivers.push(p)
  l.claims = l.claims.filter((c) => c.drop !== p)
  log(l, { week: currentWeek(d, l), type: 'drop', teamId, adds: [], drops: [p] })
  say(d, l, LEAGUE_CHANNEL, null, { event: { type: 'txn', teamId, adds: [], drops: [p] } })
  return null
}

// ---------------------------------------------------------------- trades
// Lifecycle: pending → accepted → review (commissioner) → approved | vetoed.
// Also: declined, withdrawn, expired (end of week), failed (no longer legal when processed).
// Every step is posted to the managers' DM; review and outcome are posted to the league chat.

const ros = (d: Data, l: League, p: number) => restOfSeason(d, d.players[p], l.played)
const pickOne = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]
export const managerName = (t: FTeam) => (t.isUser ? 'You' : t.owner.replace('AI · ', ''))

/** Why this trade can't happen right now, or null if it's legal. */
export function tradeProblem(
  d: Data, l: League, from: number, to: number, give: number[], get: number[], opts: { ignoreDeadline?: boolean } = {},
): string | null {
  const A = l.teams[from]
  const B = l.teams[to]
  if (l.phase !== 'season') return 'Trades are closed.'
  if (!opts.ignoreDeadline && currentWeek(d, l) >= TRADE_DEADLINE_WEEK) return `The trade deadline has passed (start of Week ${TRADE_DEADLINE_WEEK}).`
  if (!give.length || give.length !== get.length) return 'Pick the same number of players on each side.'
  if (give.some((p) => !A.roster.includes(p)) || get.some((p) => !B.roster.includes(p))) return 'A player in this deal is no longer on the same roster.'
  if ([...give, ...get].some((p) => isLocked(d, l, p))) return 'One of these players is locked for this week.'
  if (!canFillLineup(d, B.roster.filter((x) => !get.includes(x)).concat(give))) return `${B.isUser ? "You" : B.name} can't field a legal lineup after this deal.`
  if (!canFillLineup(d, A.roster.filter((x) => !give.includes(x)).concat(get))) return `${A.isUser ? "You" : A.name} can't field a legal lineup after this deal.`
  return null
}

export function tradeValue(d: Data, l: League, ps: number[]) {
  return ps.reduce((a, p) => a + ros(d, l, p), 0)
}

function tradeEvent(d: Data, l: League, t: TradeOffer, stage: TradeStage, by: number | null, where: { dm?: boolean; league?: boolean } = {}) {
  const event: ChatEvent = { type: 'trade', tradeId: t.id, stage, by }
  if (where.dm ?? true) say(d, l, dmChannel(t.from, t.to), null, { event })
  if (where.league) say(d, l, LEAGUE_CHANNEL, null, { event })
}

function resolve(t: TradeOffer, status: TradeStatus, reason?: string) {
  t.status = status
  t.resolvedAt = Date.now()
  if (reason) t.reason = reason
}

export function proposeTrade(
  d: Data, l: League, from: number, to: number, give: number[], get: number[], note?: string,
): { trade?: TradeOffer; error?: string } {
  const err = tradeProblem(d, l, from, to, give, get)
  if (err) return { error: err }
  const week = currentWeek(d, l)
  const t: TradeOffer = {
    id: l.nextId++, from, to, give: [...give], get: [...get], status: 'pending',
    week, createdAt: Date.now(), expiresWeek: week, note: note?.trim() || undefined,
  }
  l.trades.push(t)
  tradeEvent(d, l, t, 'proposed', from)
  return { trade: t }
}

export function withdrawTrade(d: Data, l: League, id: number) {
  const t = l.trades.find((x) => x.id === id)
  if (!t || t.status !== 'pending') return
  resolve(t, 'withdrawn')
  tradeEvent(d, l, t, 'withdrawn', t.from)
}

/** The receiving manager accepts or declines. Returns an error if an accept can't go through. */
export function respondTrade(d: Data, l: League, id: number, accept: boolean): string | null {
  const t = l.trades.find((x) => x.id === id)
  if (!t || t.status !== 'pending') return 'This offer is no longer open.'
  if (!accept) {
    resolve(t, 'declined')
    tradeEvent(d, l, t, 'declined', t.to)
    return null
  }
  const err = tradeProblem(d, l, t.from, t.to, t.give, t.get)
  if (err) {
    resolve(t, 'failed', err)
    tradeEvent(d, l, t, 'failed', null)
    return err
  }
  tradeEvent(d, l, t, 'accepted', t.to)
  if (l.settings.tradeReview === 'commissioner') {
    t.status = 'review'
    tradeEvent(d, l, t, 'review', null, { dm: false, league: true })
  } else {
    processTrade(d, l, t, null)
  }
  return null
}

/** Commissioner decision on an accepted trade. */
export function reviewTrade(d: Data, l: League, id: number, approve: boolean, by: number): string | null {
  const t = l.trades.find((x) => x.id === id)
  if (!t || t.status !== 'review') return 'This trade is no longer awaiting review.'
  if (by !== l.commissionerId) return 'Only the commissioner can review trades.'
  if (!approve) {
    resolve(t, 'vetoed', 'Vetoed by the commissioner')
    tradeEvent(d, l, t, 'vetoed', by, { league: true })
    return null
  }
  return processTrade(d, l, t, by)
}

function processTrade(d: Data, l: League, t: TradeOffer, by: number | null): string | null {
  const err = tradeProblem(d, l, t.from, t.to, t.give, t.get, { ignoreDeadline: true })
  if (err) {
    resolve(t, 'failed', err)
    tradeEvent(d, l, t, 'failed', null, { league: true })
    return err
  }
  const A = l.teams[t.from]
  const B = l.teams[t.to]
  for (const p of t.give) removeFromTeam(A, p)
  for (const p of t.get) removeFromTeam(B, p)
  A.roster.push(...t.get)
  B.roster.push(...t.give)
  const week = currentWeek(d, l)
  for (const team of [A, B]) if (!team.isUser || team.autoLineup) team.starters = bestLineup(d, l, team, week, true).starters
  log(l, { week, type: 'trade', teamId: t.from, otherTeamId: t.to, adds: t.get, drops: t.give })
  resolve(t, 'approved', by === null ? 'Review period ended' : 'Approved by the commissioner')
  tradeEvent(d, l, t, 'approved', by, { league: true })
  return null
}

/** Accepted trades the commissioner hasn't ruled on go through when the next match starts. */
function endReviewPeriod(d: Data, l: League) {
  for (const t of l.trades) if (t.status === 'review') processTrade(d, l, t, null)
}

function expireOffers(d: Data, l: League, week: number) {
  for (const t of l.trades) {
    if (t.status === 'pending' && t.expiresWeek <= week) {
      resolve(t, 'expired')
      tradeEvent(d, l, t, 'expired', null)
    }
  }
}

const ACCEPT_LINES = ['Pleasure doing business 🤝', 'Deal. Good luck with them.', "Done. Don't make me regret this.", 'Easy yes. Thanks!']

/** How an AI manager answers an offer sent to them. */
export function botTradeVerdict(d: Data, l: League, t: TradeOffer): { accept: boolean; text: string } {
  if (tradeProblem(d, l, t.from, t.to, t.give, t.get)) return { accept: false, text: "Can't make that one work right now, sorry." }
  const bot = l.teams[t.to]
  const gets = tradeValue(d, l, t.give)
  const gives = tradeValue(d, l, t.get)
  const need = bot.persona === 'steady' ? 1.12 : bot.persona === 'upside' ? 0.98 : 1.05
  if (gets >= gives * need) return { accept: true, text: pickOne(ACCEPT_LINES) }
  const gap = Math.round(gives * need - gets)
  return {
    accept: false,
    text: pickOne([
      `Not quite there for me. You're about ${gap} projected points short.`,
      `Close, but I need a bit more. Roughly ${gap} points more value.`,
      `Gonna pass on this one. Sweeten it by ~${gap} and we can talk.`,
    ]),
  }
}

/** A 1-for-1 swap where the receiving side's player is worth lo..hi × the giving side's. */
function findSwap(d: Data, l: League, from: number, to: number, lo: number, hi: number): { give: number[]; get: number[] } | null {
  const A = l.teams[from]
  const B = l.teams[to]
  const cands: { p: number; q: number; v: number }[] = []
  for (const p of A.roster) {
    if (isLocked(d, l, p)) continue
    const vp = ros(d, l, p)
    if (vp < 10) continue
    for (const q of B.roster) {
      if (isLocked(d, l, q) || d.players[q].role === d.players[p].role) continue
      const r = ros(d, l, q) / vp
      if (r < lo || r > hi) continue
      if (tradeProblem(d, l, from, to, [p], [q])) continue
      cands.push({ p, q, v: vp })
    }
  }
  if (!cands.length) return null
  cands.sort((a, b) => b.v - a.v)
  const c = pickOne(cands.slice(0, 8))
  return { give: [c.p], get: [c.q] }
}

/** AI managers make offers to the user and to each other at the end of a week. */
function botTradeActivity(d: Data, l: League, week: number) {
  if (week + 1 >= TRADE_DEADLINE_WEEK) return
  const bots = l.teams.filter((t) => !t.isUser)
  if (Math.random() < 0.6) {
    const bot = pickOne(bots)
    const swap = findSwap(d, l, bot.id, 0, 0.92, 1.1)
    if (swap) {
      const q = d.players[swap.get[0]]
      const note = pickOne([
        'Think this one works for both of us 🤝',
        `Been eyeing ${q.name} for a while. Interested?`,
        'Fair swap? Let me know before it expires.',
        'Fixes a hole for both of us. Thoughts?',
      ])
      proposeTrade(d, l, bot.id, 0, swap.give, swap.get, note)
    }
  }
  if (Math.random() < 0.4 && bots.length >= 2) {
    const [a, b] = shuffle(bots)
    const swap = findSwap(d, l, a.id, b.id, 0.94, 1.06)
    if (swap) {
      const r = proposeTrade(d, l, a.id, b.id, swap.give, swap.get)
      if (r.trade) respondTrade(d, l, r.trade.id, true)
    }
  }
}

// ---------------------------------------------------------------- misc helpers

export function matchupsForWeek(l: League, week: number): Matchup[] {
  return l.schedule.filter((m) => m.week === week)
}

export function userMatchup(l: League, week: number): Matchup | undefined {
  return l.schedule.find((m) => m.week === week && (m.a === 0 || m.b === 0))
}

export function winProbability(a: number, b: number, aBanked: number, bBanked: number, remainingShare: number): number {
  // normal approximation; spread shrinks as the week is played
  const sd = Math.max(4, (18 + 0.14 * (a + b)) * Math.sqrt(Math.max(remainingShare, 0.0001)))
  const diff = a - b
  const z = diff / sd
  // logistic approx of normal CDF
  const p = 1 / (1 + Math.exp(-1.702 * z))
  if (remainingShare <= 0) return aBanked > bBanked ? 1 : aBanked < bBanked ? 0 : 0.5
  return p
}
