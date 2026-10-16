import { matchProjection, type Data, type Match } from '../engine/data'
import { countedMatch, playerWeek, type League } from '../engine/league'
import { score } from '../engine/scoring'
import type { ReplayState } from './replay'

export interface LiveFantasyScore { points: number; projection: number; baseline: number; pace: 'ahead' | 'behind' | 'even' }

/** Rough remaining opportunity, using only deliveries already revealed in the replay. */
export function liveFantasyScore(d: Data, m: Match, pid: number, state: ReplayState, baseline = matchProjection(d, d.players[pid], m.mi, m.mi).total): LiveFantasyScore {
  const p = d.players[pid]
  const line = state.lines.get(pid)
  const points = line ? score(line, p.role).total : 0
  if (!m.xi.has(pid)) return { points: 0, projection: 0, baseline, pace: 'behind' }
  const inningsRemaining = (team: string) => {
    const innings = state.inns.find((inn) => inn.team === team)
    const completed = state.finished || (state.inns.length > 1 && state.inns[0].team === team)
    return completed ? 0 : innings ? Math.max(0, 1 - innings.balls / 120) : 1
  }
  const opponent = m.teams.find((team) => team !== p.team)!
  const batRemaining = line?.out ? 0 : inningsRemaining(p.team)
  const fieldRemaining = inningsRemaining(opponent)
  const bowlRemaining = Math.min(fieldRemaining, Math.max(0, 1 - (line?.bb ?? 0) / 24))
  const battingShare = { WK: 0.8, BAT: 0.85, ARB: 0.6, ARW: 0.3, BOWL: 0.1 }[p.role]
  const remaining = battingShare * batRemaining + (0.9 - battingShare) * bowlRemaining + 0.1 * fieldRemaining
  const appearance = line?.played ? 1 : 0
  const projection = state.finished ? points : points + Math.max(0, baseline - appearance) * remaining
  const delta = projection - baseline
  return { points, projection, baseline, pace: Math.abs(delta) < 0.5 ? 'even' : delta > 0 ? 'ahead' : 'behind' }
}

/** Weekly team totals, replacing just this fixture's counted projections with live points and estimates. */
export function simulatedTeamScore(d: Data, l: League, team: number, week: number, m: Match, scores: Map<number, LiveFantasyScore>) {
  let score = 0, proj = 0
  for (const pid of l.teams[team].starters) {
    if (pid === null) continue
    const live = week === m.gw && countedMatch(d, l, team, pid, week) === m.mi ? scores.get(pid) : undefined
    const wp = playerWeek(d, l, team, pid, week)
    score += live?.points ?? wp.banked
    proj += live?.projection ?? wp.total
  }
  return { score, proj }
}
