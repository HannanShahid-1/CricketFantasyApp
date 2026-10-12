// Raw data shapes produced by scripts/build_data.py

/** [kindCode, playerOut, fielders[]] */
export type RawWicket = [number, number, number[]]
/** [over, batter, bowler, runsBatter, runsExtras, flags, wicket?] */
export type RawBall = [number, number, number, number, number, number, RawWicket?]

export type Role = 'WK' | 'BAT' | 'ARB' | 'ARW' | 'BOWL'
export type SlotType = 'WK' | 'BAT' | 'BOWL' | 'FLEX'

export interface RawPlayer {
  id: string
  name: string
  role: Role
  team: string | null
}

export interface RawInnings {
  team: string
  balls: RawBall[]
}

export interface RawMatch {
  id: string
  num: number | null
  stage: string | null
  date: string
  time: string
  venue: string
  city: string
  teams: [string, string]
  winner: string | null
  result: string
  pom: number[]
  squads: Record<string, number[]>
  innings: RawInnings[]
  gw?: number
}

export interface RawTeam {
  code: string
  name: string
  color: string
  accent: string
}

export interface RawData {
  source: string
  simSeason: string
  teams: RawTeam[]
  players: RawPlayer[]
  seasons: Record<string, RawMatch[]>
  gameweeks: { gw: number; start: string; end: string; matches: string[] }[]
}

export const FLAG_WIDE = 1
export const FLAG_NOBALL = 2
export const FLAG_BYE = 4
export const FLAG_LEGBYE = 8
export const FLAG_PENALTY = 16
export const FLAG_NONBOUNDARY = 32

/** Reference for the numeric wicket codes in RawWicket[0] (index = code). */
export const WICKET_KINDS = [
  'bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket',
  'run out', 'retired hurt', 'retired out', 'obstructing the field', 'timed out', 'handled the ball',
] as const
