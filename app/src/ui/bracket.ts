// The playoff bracket shown on the Playoffs pages (web and iPhone): who meets whom in each playoff game, with seeds,
// scores and winners. Until the semifinals are set it is projected from the current standings.
import type { Data } from '../engine/data'
import { REG_WEEKS, LAST_WEEK, standings, type League, type Matchup } from '../engine/league'
import { liveTeamScore } from './helpers'

export interface BracketSlot {
  teamId: number | null
  /** shown while the team isn't known yet, e.g. "Winner SF1" */
  placeholder?: string
  /** regular-season finish (1 = top) */
  seed: number | null
  /** points so far, once the game has started */
  score: number | null
}

export interface BracketGame {
  label: string
  week: number
  /** the scheduled matchup, once the bracket has reached this game */
  m?: Matchup
  a: BracketSlot
  b: BracketSlot
  status: 'upcoming' | 'live' | 'final'
  winner: number | null
  /** the championship game */
  decidesTitle: boolean
}

export interface Bracket {
  /** the semifinals are set (the regular season is over) */
  seeded: boolean
  /** weeks with results so far */
  weeksPlayed: number
  /** semifinals, championship, 3rd place */
  championship: BracketGame[]
  /** consolation games, 5th place, toilet bowl (10 teams), 7th place */
  consolation: BracketGame[]
}

type Side = { teamId: number | null; placeholder?: string }

export function playoffBracket(d: Data, l: League): Bracket {
  const seeds = standings(l).map((r) => r.teamId) // standings only count regular-season weeks
  const SEMIS = REG_WEEKS + 1

  const game = (label: string, week: number, a: Side, b: Side): BracketGame => {
    const m = l.schedule.find((x) => x.week === week && x.label === label)
    const res = m ? l.results[week] : undefined
    const started = !!m && (!!res || l.played > d.gameweeks[week - 1].mis[0])
    const slot = (s: Side): BracketSlot => ({
      ...s,
      seed: s.teamId === null ? null : seeds.indexOf(s.teamId) + 1,
      score: started && s.teamId !== null ? liveTeamScore(d, l, s.teamId, week).score : null,
    })
    const sa = slot(m ? { teamId: m.a } : a)
    const sb = slot(m ? { teamId: m.b } : b)
    const winner = res && sa.score !== null && sb.score !== null
      ? sa.score > sb.score ? sa.teamId : sb.score > sa.score ? sb.teamId : null
      : null
    return { label, week, m, a: sa, b: sb, status: res ? 'final' : started ? 'live' : 'upcoming', winner, decidesTitle: label === 'Championship' }
  }
  const seed = (i: number): Side => ({ teamId: seeds[i] ?? null })
  const tbd = (placeholder: string): Side => ({ teamId: null, placeholder })

  return {
    seeded: l.schedule.some((m) => m.week === SEMIS),
    weeksPlayed: Object.keys(l.results).length,
    championship: [
      game('Semifinal 1', SEMIS, seed(0), seed(3)),
      game('Semifinal 2', SEMIS, seed(1), seed(2)),
      game('Championship', LAST_WEEK, tbd('Winner SF1'), tbd('Winner SF2')),
      game('3rd place', LAST_WEEK, tbd('Loser SF1'), tbd('Loser SF2')),
    ],
    consolation: [
      game('Consolation 1', SEMIS, seed(4), seed(7)),
      game('Consolation 2', SEMIS, seed(5), seed(6)),
      game('5th place', LAST_WEEK, tbd('Winner C1'), tbd('Winner C2')),
      ...(l.numTeams >= 10 ? [game('Toilet Bowl', SEMIS, seed(8), seed(9))] : []),
      game('7th place', LAST_WEEK, tbd('Loser C1'), tbd('Loser C2')),
    ],
  }
}
