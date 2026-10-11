// League engine: pure-ish functions that mutate a League object (callers pass a fresh copy).
import {
  availability, perMatchProj, restOfSeason, weekProjection,
  type Data, type Player,
} from './data'
import type { SlotType } from './types'

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
  return {
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
  }
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

export function teamOnClock(l: League): number | null {
  const n = l.numTeams
  const k = l.draft.picks.length
  if (k >= n * l.draft.rounds) return null
  const round = Math.floor(k / n)
  const i = k % n
  return round % 2 === 0 ? l.draft.order[i] : l.draft.order[n - 1 - i]
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
}

// ---------------------------------------------------------------- calendar

export function currentWeek(d: Data, l: League): number {
  if (l.played >= d.matches.length) return LAST_WEEK
  return d.matches[l.played].gw
}

export function isLocked(d: Data, l: League, p: number, week = currentWeek(d, l)): boolean {
  if (l.played >= d.matches.length) return true
  const pl = d.players[p]
  const mis = d.teamGw[pl.team]?.[week] ?? []
  return mis.some((mi) => mi < l.played)
}

// ---------------------------------------------------------------- lineups

/** Max-weight lineup. Greedy over a transversal matroid with augmenting paths = optimal. */
export function bestLineup(d: Data, l: League, team: FTeam, week: number, respectLocks = false): { starters: (number | null)[] } {
  const starters: (number | null)[] = SLOTS.map(() => null)
  const fixed = new Set<number>()
  const lockedBench = new Set<number>()
  if (respectLocks) {
    team.starters.forEach((p, i) => {
      if (p !== null && isLocked(d, l, p, week)) {
        starters[i] = p
        fixed.add(i)
      }
    })
    for (const p of team.roster) if (!team.starters.includes(p) && isLocked(d, l, p, week)) lockedBench.add(p)
  }
  const used = new Set(starters.filter((x): x is number => x !== null))
  const value = (p: number) => weekProjection(d, d.players[p], week, l.played).total + 0.001 * preseasonValue(d.players[p])
  const cands = team.roster.filter((p) => !used.has(p) && !lockedBench.has(p)).sort((a, b) => value(b) - value(a))

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

export function teamWeekScore(d: Data, l: League, teamId: number, week: number): { score: number; proj: number } {
  const res = l.results[week]
  const starters = res ? res.starters[teamId] : l.teams[teamId].starters
  let score = 0
  let proj = 0
  for (const p of starters) {
    if (p === null) continue
    const wp = weekProjection(d, d.players[p], week, res ? Infinity : l.played)
    score += wp.banked
    proj += wp.total
  }
  return { score, proj }
}

// ---------------------------------------------------------------- sim

function log(l: League, t: Omit<Txn, 'id' | 'played'>) {
  l.txns.unshift({ ...t, id: l.nextId++, played: l.played })
}

function autoSubs(d: Data, l: League, mi: number) {
  const m = d.matches[mi]
  const week = m.gw
  for (const team of l.teams) {
    if (!team.autoSub) continue
    team.starters.forEach((p, slot) => {
      if (p === null) return
      const pl = d.players[p]
      if (!m.teams.includes(pl.team) || m.xi.has(p)) return
      const teamMis = d.teamGw[pl.team][week] ?? []
      if (teamMis.some((x) => x > mi)) return // still has another match this week
      if (teamMis.some((x) => x < mi && pl.games.has(x))) return // already scored this week
      // candidate bench players
      let best: number | null = null
      let bestV = 0
      for (const c of team.roster) {
        if (team.starters.includes(c)) continue
        const cp = d.players[c]
        if (!cp.elig.includes(SLOTS[slot])) continue
        if (isLocked(d, l, c, week)) continue
        const cm = (d.teamGw[cp.team][week] ?? []).filter((x) => x >= mi)
        if (!cm.length) continue
        if (cm[0] === mi && !m.xi.has(c)) continue
        const v = weekProjection(d, cp, week, l.played).total
        if (v > bestV) {
          bestV = v
          best = c
        }
      }
      if (best !== null) {
        team.starters[slot] = best
        log(l, { week, type: 'autosub', teamId: team.id, adds: [best], drops: [p], note: `${pl.name} not in XI` })
      }
    })
  }
}

export function playNext(d: Data, l: League) {
  if (l.phase !== 'season' || l.played >= d.matches.length) return
  const mi = l.played
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
  const firstMi = d.gameweeks[week - 1].mis[0]
  for (const t of l.teams) {
    starters[t.id] = [...t.starters]
    let s = 0
    let pj = 0
    for (const p of t.starters) {
      if (p === null) continue
      const pl = d.players[p]
      s += weekProjection(d, pl, week, Infinity).banked
      pj += weekProjection(d, pl, week, firstMi).total
    }
    scores[t.id] = Math.round(s * 100) / 100
    proj[t.id] = Math.round(pj * 100) / 100
  }
  let median: number | null = null
  if (week <= REG_WEEKS) {
    const xs = Object.values(scores).sort((a, b) => a - b)
    const n = xs.length
    median = n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2
  }
  l.results[week] = { week, scores, proj, starters, median }

  if (week === REG_WEEKS) seedPlayoffs(d, l)
  if (week === REG_WEEKS + 1) setFinals(l)
  if (week === LAST_WEEK) {
    const final = l.schedule.find((m) => m.week === LAST_WEEK && m.label === 'Championship')
    if (final) l.champion = matchupWinner(l, final)
    l.phase = 'complete'
    return
  }
  processWaivers(d, l, week)
  for (const t of l.teams) if (!t.isUser || t.autoLineup) t.starters = bestLineup(d, l, t, week + 1).starters
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

export function addMode(d: Data, l: League, p: number): AddMode {
  if (l.phase !== 'season') return 'none'
  if (rosteredBy(l).has(p)) return 'none'
  if (l.onWaivers.includes(p) || isLocked(d, l, p)) return 'waiver'
  return 'free'
}

function removeFromTeam(team: FTeam, p: number) {
  team.roster = team.roster.filter((x) => x !== p)
  team.starters = team.starters.map((x) => (x === p ? null : x))
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
  return null
}

export function placeClaim(l: League, teamId: number, add: number, drop: number | null, bid: number): string | null {
  const team = l.teams[teamId]
  if (bid < 0 || bid > team.faab) return `Bid must be between $0 and $${team.faab}`
  l.claims = l.claims.filter((c) => !(c.teamId === teamId && c.add === add))
  l.claims.push({ id: l.nextId++, teamId, add, drop, bid })
  return null
}

function processWaivers(d: Data, l: League, week: number) {
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
  }
  l.claims = []
  l.onWaivers = []
}

export function dropPlayer(d: Data, l: League, teamId: number, p: number): string | null {
  const team = l.teams[teamId]
  if (isLocked(d, l, p)) return 'That player is locked for this week'
  removeFromTeam(team, p)
  l.onWaivers.push(p)
  l.claims = l.claims.filter((c) => c.drop !== p)
  log(l, { week: currentWeek(d, l), type: 'drop', teamId, adds: [], drops: [p] })
  return null
}

export interface TradeVerdict {
  accepted: boolean
  message: string
  giveValue: number
  getValue: number
}

export function evaluateTrade(d: Data, l: League, otherId: number, give: number[], get: number[]): TradeVerdict {
  const ros = (i: number) => restOfSeason(d, d.players[i], l.played)
  const giveValue = give.reduce((a, i) => a + ros(i), 0)
  const getValue = get.reduce((a, i) => a + ros(i), 0)
  const other = l.teams[otherId]
  const me = l.teams[0]
  const week = currentWeek(d, l)
  const base = { giveValue, getValue }
  if (week >= TRADE_DEADLINE_WEEK) return { accepted: false, message: `The trade deadline has passed (start of Week ${TRADE_DEADLINE_WEEK}).`, ...base }
  if (!give.length || give.length !== get.length) return { accepted: false, message: 'Pick the same number of players on each side.', ...base }
  if ([...give, ...get].some((p) => isLocked(d, l, p))) return { accepted: false, message: 'One of these players is locked for this week.', ...base }
  const otherNext = other.roster.filter((x) => !get.includes(x)).concat(give)
  const meNext = me.roster.filter((x) => !give.includes(x)).concat(get)
  if (!canFillLineup(d, otherNext)) return { accepted: false, message: `${other.name} can't field a legal lineup after this deal.`, ...base }
  if (!canFillLineup(d, meNext)) return { accepted: false, message: `You can't field a legal lineup after this deal.`, ...base }
  const need = other.persona === 'steady' ? 1.12 : other.persona === 'upside' ? 0.98 : 1.05
  if (giveValue >= getValue * need) {
    return { accepted: true, message: `${other.owner.replace('AI · ', '')} accepted! "Pleasure doing business."`, ...base }
  }
  const gap = Math.round(getValue * need - giveValue)
  return { accepted: false, message: `${other.owner.replace('AI · ', '')} declined — "You're about ${gap} projected points short."`, ...base }
}

export function executeTrade(d: Data, l: League, otherId: number, give: number[], get: number[]) {
  const me = l.teams[0]
  const other = l.teams[otherId]
  for (const p of give) removeFromTeam(me, p)
  for (const p of get) removeFromTeam(other, p)
  me.roster.push(...get)
  other.roster.push(...give)
  other.starters = bestLineup(d, l, other, currentWeek(d, l), true).starters
  me.starters = me.starters.map((x) => x)
  log(l, { week: currentWeek(d, l), type: 'trade', teamId: 0, otherTeamId: otherId, adds: get, drops: give })
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

export function perMatchFor(d: Data, l: League, p: number) {
  return perMatchProj(d, d.players[p], l.played) * availability(d, d.players[p], l.played)
}
