// "Which match counts" choices for one of your players this week, shared by the web and iPhone screens.
// His first match counts unless you lock in another, and the choice closes when his first match starts.
import { countedMatch, currentWeek, isLocked, lockedPick, pickOpen, weekMatches, type League } from '../engine/league'
import type { Data } from '../engine/data'
import { fmt } from '../engine/scoring'

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface MatchChoice {
  mi: number
  /** opponent code, e.g. "MI" */
  opp: string
  /** "Tue 7" */
  day: string
  /** "Tue 7 Apr" */
  date: string
  /** this is the match that counts */
  on: boolean
  /** the manager locked it in (rather than it counting by default) */
  explicit: boolean
  done: boolean
  /** tapping it locks it in */
  can: boolean
  /** short status, e.g. "Counts", "Lock this", "45 pts" */
  status: string
  /** longer explanation for a tooltip or accessibility label */
  hint?: string
}

/** The week's choices for player `pid` on team `teamId`, or [] if he has no match this week. */
export function matchChoices(d: Data, league: League, teamId: number, pid: number): MatchChoice[] {
  const week = currentWeek(d, league)
  const p = d.players[pid]
  const mis = weekMatches(d, pid, week)
  if (!mis.length) return []
  const counted = countedMatch(d, league, teamId, pid, week)
  const explicit = lockedPick(league, teamId, pid, week) !== undefined
  const open = pickOpen(d, league, pid)
  const closed = mis.length > 1 && !open && isLocked(d, league, pid)
  return mis.map((mi) => {
    const m = d.matches[mi]
    const opp = m.teams[0] === p.team ? m.teams[1] : m.teams[0]
    const dt = new Date(m.raw.date + 'T00:00:00')
    const day = `${DAY[dt.getDay()]} ${dt.getDate()}`
    const date = `${day} ${MON[dt.getMonth()]}`
    const on = mi === counted
    const done = mi < league.played
    const pts = done ? p.games.get(mi)?.pts.total : undefined
    const can = open && !on
    const status = on
      ? done
        ? pts === undefined ? 'DNP' : `${fmt(pts)} pts`
        : explicit ? 'Locked in' : 'Counts'
      : done
        ? 'Not counted'
        : open ? 'Lock this' : "Won't count"
    const hint = can
      ? `Lock in v ${opp} (${date}): only this match will count`
      : on && explicit && open
        ? 'Locked in. Tap his first match to switch back.'
        : done && !on
          ? `${pts === undefined ? 'Did not play' : `Scored ${fmt(pts)}`}: not counted`
          : closed
            ? 'Choice closed: his first match of the week has started'
            : undefined
    return { mi, opp, day, date, on, explicit: on && explicit, done, can, status, hint }
  })
}

/** Confirmation after locking in `c` (the first match means "back to the default"). */
export function lockMessage(d: Data, pid: number, c: MatchChoice, isFirst: boolean) {
  const name = d.players[pid].name
  return isFirst ? `${name}: his first match counts again` : `${name}: locked in v ${c.opp} on ${c.date}`
}
