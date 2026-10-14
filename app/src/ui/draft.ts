// League setup and draft room logic shared by the web and iPhone: the setup choices, how long an AI pick takes,
// the ranked player pool, the pick ticker, and a roster laid out by lineup slot. Plain TypeScript (no React/DOM).
import type { Data, Player } from '../engine/data'
import {
  bestLineup, draftedSet, FAAB_BUDGET, LAST_WEEK, preseasonValue, REG_WEEKS, ROSTER_SIZE, SLOTS, teamAtPick, teamOnClock,
  TRADE_DEADLINE_WEEK,
  type DraftState, type League, type LeagueOptions, type Pick,
} from '../engine/league'
import type { RoleFilter } from './playerList'

// ---------------------------------------------------------------- setup

export const DEFAULT_LEAGUE_OPTIONS: LeagueOptions = {
  name: 'Floodlights League',
  teamName: 'Seam Bowlers XI',
  numTeams: 8,
  draftSlot: 'random',
  timer: 0,
  speed: 'normal',
}

export const TEAM_COUNTS = [8, 10]

export const PICK_TIMERS: { value: number; label: string; short: string }[] = [
  { value: 0, label: 'Off (take your time)', short: 'Off' },
  { value: 30, label: '30 seconds', short: '30s' },
  { value: 60, label: '60 seconds', short: '60s' },
  { value: 90, label: '90 seconds', short: '90s' },
]

export type DraftSpeed = DraftState['speed']

export const DRAFT_SPEEDS: { value: DraftSpeed; label: string; short: string }[] = [
  { value: 'normal', label: 'Normal', short: '1×' },
  { value: 'fast', label: 'Fast', short: '3×' },
  { value: 'instant', label: 'Instant', short: 'Max' },
]

export const draftSlotLabel = (slot: LeagueOptions['draftSlot']) => (slot === 'random' ? 'Randomize' : `Pick ${slot}`)

export type SetupFeature = 'draft' | 'weeks' | 'live' | 'moves'

/** What the league offers, for the setup screen. */
export function setupFeatures(d: Data): { key: SetupFeature; title: string; detail: string }[] {
  const season = Number(d.raw.simSeason)
  return [
    { key: 'draft', title: 'Live snake draft', detail: `${d.pool.length} real IPL ${season} players · rankings from ${season - 1}` },
    { key: 'weeks', title: `${LAST_WEEK} Monday–Sunday gameweeks`, detail: `${REG_WEEKS} regular-season weeks + median game, then semis & final` },
    { key: 'live', title: 'Ball-by-ball live scoring', detail: `${d.matches.length} league matches from Cricsheet, replayed as they happened` },
    { key: 'moves', title: 'Waivers, FAAB & trades', detail: 'AI managers bid, trade and set lineups every week' },
  ]
}

/** The league format in short facts: roster shape first, then scoring and the season's rules. */
export function leagueFormat(): string[] {
  return [
    `${SLOTS.length} starters + ${ROSTER_SIZE - SLOTS.length} bench`,
    'Standard scoring (Option 1)',
    'one match per player counts each week',
    `$${FAAB_BUDGET} FAAB`,
    `trade deadline Week ${TRADE_DEADLINE_WEEK}`,
  ]
}

// ---------------------------------------------------------------- draft room

/** How long an AI manager (or auto-draft) takes over a pick at each draft speed, in ms. */
export function aiPickDelay(speed: DraftSpeed): number {
  return speed === 'instant' ? 30 : speed === 'fast' ? 280 : 950
}

const ranked = new WeakMap<Data, { players: Player[]; rank: Map<number, number> }>()

/** The whole draft pool best first by preseason value, and each player's rank in it (1 = best). */
export function rankedPool(d: Data): { players: Player[]; rank: Map<number, number> } {
  let r = ranked.get(d)
  if (!r) {
    const players = [...d.pool].sort((a, b) => preseasonValue(b) - preseasonValue(a))
    r = { players, rank: new Map(players.map((p, i) => [p.idx, i + 1])) }
    ranked.set(d, r)
  }
  return r
}

export interface PoolFilter {
  role: RoleFilter
  /** IPL team code or 'ALL' */
  team: string
  q: string
}

export const matchesRole = (p: Player, role: RoleFilter) =>
  role === 'AR' ? p.role === 'ARB' || p.role === 'ARW' : role === 'ALL' || p.role === role

/** Undrafted players that match the filter, best first. */
export function availablePool(d: Data, taken: Set<number>, f: PoolFilter): Player[] {
  const needle = f.q.trim().toLowerCase()
  return rankedPool(d).players.filter((p) =>
    !taken.has(p.idx)
    && matchesRole(p, f.role)
    && (f.team === 'ALL' || p.team === f.team)
    && (!needle || `${p.name} ${p.fullName} ${p.rawName}`.toLowerCase().includes(needle)))
}

/** Whether a team can draft this player now: it is on the clock and nobody has taken him. */
export const canDraft = (l: League, teamId: number, p: number) => teamOnClock(l) === teamId && !draftedSet(l).has(p)

export interface DraftSlot {
  overall: number
  round: number
  /** pick within the round */
  pick: number
  teamId: number
}

/** Overall pick k (0-based): its round, pick in the round and the team that makes it. */
export function draftSlot(l: League, k: number): DraftSlot {
  return { overall: k + 1, round: Math.floor(k / l.numTeams) + 1, pick: (k % l.numTeams) + 1, teamId: teamAtPick(l, k) }
}

const totalPicks = (l: League) => l.numTeams * l.draft.rounds

/** The pick on the clock (null once the draft is over). */
export const currentSlot = (l: League): DraftSlot | null =>
  l.draft.picks.length < totalPicks(l) ? draftSlot(l, l.draft.picks.length) : null

/** The pick on the clock and the ones after it, `count` in all (fewer near the end of the draft). */
export function upcomingPicks(l: League, count: number): DraftSlot[] {
  const out: DraftSlot[] = []
  for (let k = l.draft.picks.length; k < Math.min(l.draft.picks.length + count, totalPicks(l)); k++) out.push(draftSlot(l, k))
  return out
}

/** How many picks until a team is on the clock (0 = it is now), or null when it has no picks left. */
export function picksUntil(l: League, teamId: number): number | null {
  for (let k = l.draft.picks.length; k < totalPicks(l); k++) if (teamAtPick(l, k) === teamId) return k - l.draft.picks.length
  return null
}

/** A team's roster as it stands mid-draft: the best XI it can field by slot (null = still empty), then the bench. */
export function rosterBySlot(d: Data, l: League, teamId: number): { starters: (number | null)[]; bench: number[] } {
  const team = l.teams[teamId]
  const starters = bestLineup(d, l, team, 1).starters
  return { starters, bench: team.roster.filter((p) => !starters.includes(p)) }
}

/** The draft board: one row per round, one cell per team in draft order (null until that pick is made). */
export function draftBoard(l: League): (Pick | null)[][] {
  const byCell = new Map(l.draft.picks.map((p) => [`${p.round}-${p.teamId}`, p]))
  return Array.from({ length: l.draft.rounds }, (_, r) => l.draft.order.map((tid) => byCell.get(`${r + 1}-${tid}`) ?? null))
}
