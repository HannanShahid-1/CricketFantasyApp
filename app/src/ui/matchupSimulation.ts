import { matchProjection, type Data, type Match } from '../engine/data'
import { playerWeek, type League } from '../engine/league'
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

/** Each starter's counted match and week numbers: the part of a simulated team score that doesn't change ball to ball. */
export type TeamWeekBase = { pid: number; mi: number | null; banked: number; total: number }[]

export function teamWeekBase(d: Data, l: League, team: number, week: number): TeamWeekBase {
  return l.teams[team].starters.flatMap((pid) => {
    if (pid === null) return []
    const wp = playerWeek(d, l, team, pid, week)
    return [{ pid, mi: wp.mi, banked: wp.banked, total: wp.total }]
  })
}

/**
 * A team's weekly total (the in-place simulation): its base, with live points and estimates swapped in for the
 * players whose counted match is the one being simulated (`m`).
 */
export function simulatedFromBase(base: TeamWeekBase, m: Match, scores: Map<number, LiveFantasyScore>) {
  let score = 0, proj = 0
  for (const r of base) {
    const live = r.mi === m.mi ? scores.get(r.pid) : undefined
    score += live?.points ?? r.banked
    proj += live?.projection ?? r.total
  }
  return { score, proj }
}
