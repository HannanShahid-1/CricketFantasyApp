// Ball-by-ball replay of an IPL match ("watch live"), shared by the web modal and the iPhone screen. Everything is
// derived from the match and `k`, the number of balls bowled so far, so a screen only has to advance `k`.
import type { Data, Match } from '../engine/data'
import { countedMatch, rosteredBy, type League } from '../engine/league'
import { computeLines, score, type StatLine } from '../engine/scoring'
import { ME } from '../store'
import { inningsDetails, runRate, type BallEvent, type InningsDetail } from './scorecard'

/** Replay speeds, in milliseconds per ball. */
export const REPLAY_SPEEDS = [
  { label: '1×', ms: 420 },
  { label: '4×', ms: 110 },
  { label: '20×', ms: 22 },
] as const

/** Balls in a full T20 innings: the chase maths assumes an uninterrupted match. */
const INNINGS_BALLS = 120

/**
 * Watching the next unplayed match. Such a replay is the match being played: when it is closed (finished or not),
 * the screen calls `simMatch()` to record it in the league and toasts `resultToast(m)`. Other replays change nothing.
 */
export const isNextMatch = (l: League, mi: number) => l.phase === 'season' && mi === l.played

/** The toast after a watched match is recorded, e.g. "CSK v MI — CSK won by 5 wickets". */
export const resultToast = (m: Match) => `${m.teams[0]} v ${m.teams[1]} — ${m.raw.result}`

export interface ReplayState {
  /** every player's stat line so far */
  lines: Map<number, StatLine>
  /** innings so far; the last one is in progress */
  inns: InningsDetail[]
  /** the innings in progress (undefined before the first ball) */
  cur: InningsDetail | undefined
  /** the latest ball */
  last: BallEvent | undefined
  /** this over's balls so far; `evs[overStart]` is the first of them */
  over: BallEvent[]
  overStart: number
  /** the not-out batters of the innings in progress, up to two */
  batters: number[]
  /** the chasing side's target, during the second innings */
  target: number | null
  /** runs needed, legal balls left and the required rate, during the second innings */
  chase: { need: number; balls: number; rrr: string } | null
  finished: boolean
}

/** The match after `k` of its balls (`evs` = `ballEvents(d, m.raw)`). */
export function replayState(d: Data, m: Match, evs: BallEvent[], k: number): ReplayState {
  const inns = inningsDetails(d, m.raw, k)
  const cur = inns[inns.length - 1]
  const last = evs[k - 1]
  const target = inns.length === 2 ? m.totals[0].runs + 1 : null
  let overStart = k
  if (last) {
    const over = last.label.split('.')[0]
    while (overStart > 0 && evs[overStart - 1].inn === last.inn && evs[overStart - 1].label.split('.')[0] === over) overStart--
  }
  return {
    lines: computeLines(m.raw, k),
    inns,
    cur,
    last,
    over: evs.slice(overStart, k),
    overStart,
    batters: cur ? cur.batters.filter((p) => !cur.dismissal.has(p)).slice(-2) : [],
    target,
    chase: cur && target !== null ? chase(cur, target) : null,
    finished: k >= evs.length,
  }
}

function chase(cur: InningsDetail, target: number) {
  const need = Math.max(0, target - cur.runs)
  const balls = Math.max(0, INNINGS_BALLS - cur.balls)
  return { need, balls, rrr: balls ? runRate(need, balls) : '–' }
}

export interface TrackedPlayer {
  p: number
  /** fantasy team that rosters him */
  owner: number
  /** fantasy points from this match so far */
  pts: number
  /** in his owner's starting lineup */
  starter: boolean
  /** this is the match that counts for him this week (only one does) */
  counts: boolean
}

/** Rostered players in this match with their points so far: yours first, then by points. */
export function fantasyTracker(d: Data, l: League, m: Match, lines: Map<number, StatLine>, owned = rosteredBy(l)): TrackedPlayer[] {
  return [...m.xi]
    .filter((p) => owned.has(p))
    .map((p) => {
      const owner = owned.get(p)!
      const line = lines.get(p)
      const starter = l.teams[owner].starters.includes(p)
      return {
        p,
        owner,
        pts: line ? score(line, d.players[p].role).total : 0,
        starter,
        counts: starter && countedMatch(d, l, owner, p, m.gw) === m.mi,
      }
    })
    .sort((a, b) => Number(b.owner === ME) - Number(a.owner === ME) || b.pts - a.pts)
}

/**
 * A fantasy team's matchup score while match `m` is being played. Only each starter's counting match adds up:
 * banked if it was earlier this week, live from `lines` if it is this one.
 */
export function liveMatchupScore(d: Data, l: League, teamId: number, m: Match, lines: Map<number, StatLine>): number {
  let s = 0
  for (const p of l.teams[teamId].starters) {
    if (p === null) continue
    const c = countedMatch(d, l, teamId, p, m.gw)
    if (c === null || c > m.mi) continue
    if (c < m.mi) s += d.players[p].games.get(c)?.pts.total ?? 0
    else if (m.xi.has(p)) {
      const line = lines.get(p)
      if (line) s += score(line, d.players[p].role).total
    }
  }
  return s
}
