import { Check, Lock } from 'lucide-react'
import { getData, ME, useApp } from '../store'
import { lockMessage, matchChoices } from './matchPick'

/**
 * Pick which of your player's matches counts this week. His first match counts unless you lock in another,
 * and the choice closes when his first match starts.
 */
export function MatchPicker({ pid }: { pid: number }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const lockMatch = useApp((s) => s.lockMatch)
  const notify = useApp((s) => s.notify)
  const p = d.players[pid]
  const choices = matchChoices(d, league, ME, pid)
  if (!choices.length) return <span className="mp-none">No match this week</span>

  const choose = (i: number) => {
    const c = choices[i]
    const err = lockMatch(pid, c.mi)
    notify(err ?? lockMessage(d, pid, c, i === 0), err ? 'bad' : 'ok')
  }

  return (
    <div className="mpick" role="group" aria-label={`Which of ${p.name}'s matches counts`} onClick={(e) => e.stopPropagation()}>
      {choices.map((c, i) => (
        <button
          key={c.mi}
          type="button"
          className={`mp ${c.on ? 'on' : ''} ${c.explicit ? 'locked' : ''} ${c.done ? 'done' : ''} ${c.can ? 'can' : ''}`}
          aria-disabled={!c.can}
          aria-pressed={c.on}
          title={c.hint}
          onClick={() => c.can && choose(i)}
        >
          <span className="mp-top">
            <b>v {c.opp}</b>
            <span>{c.day}</span>
          </span>
          <span className="mp-st">
            {c.on && (c.explicit ? <Lock size={10} /> : <Check size={10} />)}
            {c.status}
          </span>
        </button>
      ))}
    </div>
  )
}
