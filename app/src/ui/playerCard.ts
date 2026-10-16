// The player card's numbers (season rank, game log), shared by the web and iPhone screens.
import type { Data, GameRow, Player } from '../engine/data'
import type { League } from '../engine/league'
import { batLine, bowlLine, fieldLine } from '../engine/scoring'

/** Matches played as far as the card is concerned: none until the season starts. */
export const cardPlayed = (league: League | null) => (!league || league.phase === 'draft' ? 0 : league.played)

export interface LogEntry {
  mi: number
  gw: number
  /** ISO date and local start time */
  date: string
  time: string
  /** opponent's IPL code */
  opp: string
  /** upcoming: not played yet · dnp: his team played without him · played: see `game` */
  state: 'upcoming' | 'dnp' | 'played'
  game?: GameRow
  /** batting, bowling and fielding lines (null when he didn't do that) */
  bat: string | null
  bowl: string | null
  field: string | null
}

/** One entry per match his IPL team plays this season, in order. */
export function gameLog(d: Data, p: Player, played: number): LogEntry[] {
  return (d.teamMis[p.team] ?? []).map((mi) => {
    const m = d.matches[mi]
    const game = mi < played ? p.games.get(mi) : undefined
    return {
      mi,
      gw: m.gw,
      date: m.raw.date,
      time: m.raw.time,
      opp: m.teams[0] === p.team ? m.teams[1] : m.teams[0],
      state: mi >= played ? 'upcoming' : game ? 'played' : 'dnp',
      game,
      bat: game ? batLine(game.line) : null,
      bowl: game ? bowlLine(game.line) : null,
      field: game ? fieldLine(game.line) : null,
    }
  })
}

/** Points worth flagging in a game log: a big game (25+) or a dud (under 2). */
export const ptsBand = (pts: number): 'big' | 'low' | 'normal' => (pts >= 25 ? 'big' : pts < 2 ? 'low' : 'normal')
