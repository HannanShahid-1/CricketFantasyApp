import { Check, Lock } from 'lucide-react'
import { countedMatch, currentWeek, isLocked, lockedPick, pickOpen, weekMatches } from '../engine/league'
import { fmt } from '../engine/scoring'
import { getData, ME, useApp } from '../store'

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Pick which of your player's matches counts this week. His first match counts unless you lock in another,
 * and the choice closes when his first match starts.
 */
export function MatchPicker({ pid }: { pid: number }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const lockMatch = useApp((s) => s.lockMatch)
  const notify = useApp((s) => s.notify)
  const week = currentWeek(d, league)
  const p = d.players[pid]
  const mis = weekMatches(d, pid, week)
  if (!mis.length) return <span className="mp-none">No match this week</span>

  const counted = countedMatch(d, league, ME, pid, week)
  const explicit = lockedPick(league, ME, pid, week) !== undefined
  const open = pickOpen(d, league, pid)
  const closed = mis.length > 1 && !open && isLocked(d, league, pid)
  const opp = (mi: number) => {
    const t = d.matches[mi].teams
    return t[0] === p.team ? t[1] : t[0]
  }
  const day = (mi: number, long = true) => {
    const dt = new Date(d.matches[mi].raw.date + 'T00:00:00')
    return `${DAY[dt.getDay()]} ${dt.getDate()}${long ? ` ${MON[dt.getMonth()]}` : ''}`
  }

  const choose = (mi: number) => {
    const err = lockMatch(pid, mi)
    if (err) return notify(err, 'bad')
    notify(mi === mis[0] ? `${p.name}: his first match counts again` : `${p.name}: locked in v ${opp(mi)} on ${day(mi)}`)
  }

  return (
    <div className="mpick" role="group" aria-label={`Which of ${p.name}'s matches counts`} onClick={(e) => e.stopPropagation()}>
      {mis.map((mi) => {
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
        const title = can
          ? `Lock in v ${opp(mi)} (${day(mi)}): only this match will count`
          : on && explicit && open
            ? 'Locked in. Tap his first match to switch back.'
            : done && !on
              ? `${pts === undefined ? 'Did not play' : `Scored ${fmt(pts)}`}: not counted`
              : closed
                ? 'Choice closed: his first match of the week has started'
                : undefined
        return (
          <button
            key={mi}
            type="button"
            className={`mp ${on ? 'on' : ''} ${on && explicit ? 'locked' : ''} ${done ? 'done' : ''} ${can ? 'can' : ''}`}
            aria-disabled={!can}
            aria-pressed={on}
            title={title}
            onClick={() => can && choose(mi)}
          >
            <span className="mp-top">
              <b>v {opp(mi)}</b>
              <span>{day(mi, false)}</span>
            </span>
            <span className="mp-st">
              {on && (explicit ? <Lock size={10} /> : <Check size={10} />)}
              {status}
            </span>
          </button>
        )
      })}
    </div>
  )
}
