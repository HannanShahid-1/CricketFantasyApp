// Loads the Cricsheet-derived data file and pre-computes stat lines, fantasy points and projections.
import { computeLines, score, type Points, type StatLine } from './scoring'
import type { RawData, RawMatch, RawTeam, Role, SlotType } from './types'
import { playerDisplayName } from './playerNames'

interface PlayerMedia {
  players: Record<string, { fullName: string; photo: string; team?: string }>
  teams: Record<string, { logo: string }>
}

export interface PlayerBio {
  birthDate: string
  nationality: string
  battingStyle: string
  bowlingStyle: string | null
  source: string
}

export interface GameRow {
  mi: number
  line: StatLine
  pts: Points
}

export interface Player {
  idx: number
  id: string
  name: string
  fullName: string
  rawName: string
  photo?: string
  profileTeam?: string
  bio?: PlayerBio
  role: Role
  team: string
  elig: SlotType[]
  s25: { apps: number; pts: number; avg: number }
  prior: { perMatch: number; avail: number }
  games: Map<number, GameRow>
  seasonPts: number
}

export interface InningsTotal {
  team: string
  runs: number
  wkts: number
  balls: number
}

export interface Match {
  mi: number
  raw: RawMatch
  gw: number
  teams: [string, string]
  xi: Set<number>
  totals: InningsTotal[]
  points: Map<number, Points>
  lines: Map<number, StatLine>
}

export interface Gameweek {
  gw: number
  start: string
  end: string
  mis: number[]
}

export interface Data {
  raw: RawData
  version: string
  players: Player[]
  pool: Player[]
  teams: Record<string, RawTeam>
  teamLogos: Record<string, string>
  matches: Match[]
  gameweeks: Gameweek[]
  teamGw: Record<string, Record<number, number[]>>
  roleBaseline: Record<Role, number>
}

export const ELIGIBILITY: Record<Role, SlotType[]> = {
  WK: ['WK', 'BAT', 'FLEX'],
  BAT: ['BAT', 'FLEX'],
  ARB: ['BAT', 'FLEX'],
  ARW: ['BOWL', 'FLEX'],
  BOWL: ['BOWL', 'FLEX'],
}

export const ROLE_LABEL: Record<Role, string> = {
  WK: 'WK',
  BAT: 'BAT',
  ARB: 'AR·BAT',
  ARW: 'AR·BOWL',
  BOWL: 'BOWL',
}

export const ROLE_NAME: Record<Role, string> = {
  WK: 'Wicketkeeper',
  BAT: 'Batter',
  ARB: 'Batting all-rounder',
  ARW: 'Bowling all-rounder',
  BOWL: 'Bowler',
}

export function inningsTotals(raw: RawMatch): InningsTotal[] {
  return raw.innings.map((inn) => {
    let runs = 0
    let wkts = 0
    let balls = 0
    for (const b of inn.balls) {
      runs += b[3] + b[4]
      if (!(b[5] & 3)) balls++
      if (b[6] && b[6][0] !== 7) wkts++
    }
    return { team: inn.team, runs, wkts, balls }
  })
}

export async function loadData(): Promise<Data> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/ipl.json`)
  const raw: RawData = await res.json()
  // Photos are optional so a failed media request cannot block league loading.
  const media: PlayerMedia = await fetch(`${import.meta.env.BASE_URL}data/player-media.json`)
    .then((r) => r.ok ? r.json() : { players: {}, teams: {} })
    .catch(() => ({ players: {}, teams: {} }))
  const teams = Object.fromEntries(raw.teams.map((t) => [t.code, t]))
  const bios: Record<string, PlayerBio> = await fetch(`${import.meta.env.BASE_URL}data/player-bios.json`)
    .then((r) => r.ok ? r.json() : {})
    .catch(() => ({}))

  const players: Player[] = raw.players.map((p, idx) => ({
    idx,
    id: p.id,
    name: playerDisplayName(media.players[p.id]?.fullName ?? p.name),
    fullName: media.players[p.id]?.fullName ?? p.name,
    rawName: p.name,
    photo: media.players[p.id]?.photo,
    profileTeam: media.players[p.id]?.team,
    bio: bios[p.id],
    role: p.role,
    team: p.team ?? '',
    elig: ELIGIBILITY[p.role],
    s25: { apps: 0, pts: 0, avg: 0 },
    prior: { perMatch: 0, avail: 0 },
    games: new Map(),
    seasonPts: 0,
  }))

  // Prior season: points per appearance
  const prev = Object.keys(raw.seasons).filter((s) => s !== raw.simSeason)
  for (const s of prev) {
    for (const m of raw.seasons[s]) {
      const lines = computeLines(m)
      for (const [p, l] of lines) {
        if (!l.played) continue
        const pts = score(l, players[p].role).total
        players[p].s25.apps++
        players[p].s25.pts += pts
      }
    }
  }
  for (const p of players) p.s25.avg = p.s25.apps ? p.s25.pts / p.s25.apps : 0

  // Role baseline (players with 5+ prior appearances)
  const roleBaseline = {} as Record<Role, number>
  for (const role of ['WK', 'BAT', 'ARB', 'ARW', 'BOWL'] as Role[]) {
    const xs = players.filter((p) => p.role === role && p.s25.apps >= 5)
    roleBaseline[role] = xs.length ? xs.reduce((a, p) => a + p.s25.avg, 0) / xs.length : 8
  }
  for (const p of players) {
    const k = 3
    const base = roleBaseline[p.role] * (p.s25.apps ? 1 : 0.8)
    p.prior.perMatch = (p.s25.apps * p.s25.avg + k * base) / (p.s25.apps + k)
    p.prior.avail = p.s25.apps ? Math.min(1, Math.max(0.3, p.s25.apps / 14)) : 0.45
  }

  // Simulated season: league stage only
  const gwOf = new Map<string, number>()
  for (const g of raw.gameweeks) for (const id of g.matches) gwOf.set(id, g.gw)
  const league = raw.seasons[raw.simSeason].filter((m) => gwOf.has(m.id))
  const matches: Match[] = league.map((m, mi) => {
    const lines = computeLines(m)
    const points = new Map<number, Points>()
    for (const [p, l] of lines) {
      if (!l.played) continue
      const pts = score(l, players[p].role)
      points.set(p, pts)
      players[p].games.set(mi, { mi, line: l, pts })
    }
    return {
      mi,
      raw: m,
      gw: gwOf.get(m.id)!,
      teams: m.teams,
      xi: new Set(Object.values(m.squads).flat()),
      totals: inningsTotals(m),
      points,
      lines,
    }
  })
  for (const p of players) p.seasonPts = [...p.games.values()].reduce((a, g) => a + g.pts.total, 0)

  const gameweeks: Gameweek[] = raw.gameweeks.map((g) => ({
    gw: g.gw,
    start: g.start,
    end: g.end,
    mis: matches.filter((m) => m.gw === g.gw).map((m) => m.mi),
  }))
  const teamGw: Record<string, Record<number, number[]>> = {}
  for (const t of raw.teams) teamGw[t.code] = {}
  for (const m of matches) {
    for (const t of m.teams) (teamGw[t][m.gw] ??= []).push(m.mi)
  }

  const pool = players.filter((p) => p.team)
  return {
    raw,
    version: `${raw.simSeason}-${players.length}-${matches.length}`,
    players,
    pool,
    teams,
    teamLogos: Object.fromEntries(Object.entries(media.teams).map(([code, t]) => [code, t.logo])),
    matches,
    gameweeks,
    teamGw,
    roleBaseline,
  }
}

// ---------- Projections (depend on how many matches have been played) ----------

export function perMatchProj(d: Data, p: Player, played: number): number {
  let n = 0
  let sum = 0
  for (const g of p.games.values()) {
    if (g.mi < played) {
      n++
      sum += g.pts.total
    }
  }
  const k = 3
  const w25 = 0.5 * p.s25.apps
  const base = d.roleBaseline[p.role] * (p.s25.apps ? 1 : 0.8)
  return (w25 * p.s25.avg + sum + k * base) / (w25 + n + k)
}

export function availability(d: Data, p: Player, played: number): number {
  if (!p.team) return 0
  let teamPlayed = 0
  for (const mi of Object.values(d.teamGw[p.team]).flat()) if (mi < played) teamPlayed++
  let apps = 0
  for (const g of p.games.values()) if (g.mi < played) apps++
  const k = 4
  return (p.prior.avail * k + apps) / (k + teamPlayed)
}

/** Projected points for the rest of a gameweek plus points already banked in that week. */
export function weekProjection(d: Data, p: Player, gw: number, played: number): { banked: number; remaining: number; total: number } {
  const mis = d.teamGw[p.team]?.[gw] ?? []
  let banked = 0
  let left = 0
  for (const mi of mis) {
    if (mi < played) banked += p.games.get(mi)?.pts.total ?? 0
    else left++
  }
  const remaining = left ? perMatchProj(d, p, played) * availability(d, p, played) * left : 0
  return { banked, remaining, total: banked + remaining }
}

export function restOfSeason(d: Data, p: Player, played: number, lastGw = 8): number {
  let left = 0
  for (const [gw, mis] of Object.entries(d.teamGw[p.team] ?? {})) {
    if (Number(gw) > lastGw) continue
    for (const mi of mis) if (mi >= played) left++
  }
  return perMatchProj(d, p, played) * availability(d, p, played) * left
}

export function pointsInRange(p: Player, fromMi: number, toMi: number): number {
  let s = 0
  for (const g of p.games.values()) if (g.mi >= fromMi && g.mi < toMi) s += g.pts.total
  return s
}

export function seasonToDate(p: Player, played: number) {
  let pts = 0
  let apps = 0
  for (const g of p.games.values()) {
    if (g.mi < played) {
      pts += g.pts.total
      apps++
    }
  }
  return { pts, apps, avg: apps ? pts / apps : 0 }
}
