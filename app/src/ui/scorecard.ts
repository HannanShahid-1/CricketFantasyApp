import type { Data, Match } from '../engine/data'
import type { Points, StatLine } from '../engine/scoring'
import { FLAG_BYE, FLAG_LEGBYE, FLAG_NOBALL, FLAG_NONBOUNDARY, FLAG_WIDE, type RawMatch } from '../engine/types'

export interface InningsDetail {
  team: string
  runs: number
  wkts: number
  balls: number
  extras: number
  batters: number[]
  bowlers: number[]
  dismissal: Map<number, string>
}

export interface BallEvent {
  inn: number
  label: string // e.g. 14.3
  batter: number
  bowler: number
  text: string // "Bumrah to Gill — FOUR! Raced to the rope"
  desc: string // just the outcome: "FOUR! Raced to the rope"
  short: string // for the ball chip
  cls: '' | 'b4' | 'b6' | 'bw' | 'bx'
}

/** Batting strike rate, e.g. "142.9" ("–" before he has faced a ball). */
export const strikeRate = (l: StatLine) => (l.b ? ((l.r / l.b) * 100).toFixed(1) : '–')

/** Bowling economy in runs per over, e.g. "7.25" ("–" before he has bowled). */
export const economy = (l: StatLine) => (l.bb ? (l.rc / (l.bb / 6)).toFixed(2) : '–')

/** Runs per over, e.g. "8.45". */
export const runRate = (runs: number, balls: number) => (balls ? ((runs / balls) * 6).toFixed(2) : '0.00')

/** Everyone who played in the match with his fantasy points, best first. */
export const fantasyLeaders = (m: Match): [number, Points][] => [...m.points.entries()].sort((a, b) => b[1].total - a[1].total)

export function dismissalText(d: Data, kind: number, bowler: number, fielders: number[]): string {
  const n = (i: number) => d.players[i]?.name ?? '?'
  const f = fielders[0] !== undefined ? n(fielders[0]) : 'sub'
  switch (kind) {
    case 0: return `b ${n(bowler)}`
    case 1: return `c ${f} b ${n(bowler)}`
    case 2: return `lbw b ${n(bowler)}`
    case 3: return `st ${f} b ${n(bowler)}`
    case 4: return `c & b ${n(bowler)}`
    case 5: return `hit wicket b ${n(bowler)}`
    case 6: return `run out (${fielders.map(n).join(' / ') || 'sub'})`
    case 7: return 'retired hurt'
    case 8: return 'retired out'
    default: return 'out'
  }
}

export function inningsDetails(d: Data, m: RawMatch, upTo = Infinity): InningsDetail[] {
  const out: InningsDetail[] = []
  let seen = 0
  for (const inn of m.innings) {
    if (seen >= upTo) break
    const det: InningsDetail = { team: inn.team, runs: 0, wkts: 0, balls: 0, extras: 0, batters: [], bowlers: [], dismissal: new Map() }
    for (const b of inn.balls) {
      if (seen >= upTo) break
      seen++
      const [, batter, bowler, rb, rx, flags, wk] = b
      if (!det.batters.includes(batter)) det.batters.push(batter)
      if (!det.bowlers.includes(bowler)) det.bowlers.push(bowler)
      det.runs += rb + rx
      det.extras += rx
      if (!(flags & (FLAG_WIDE | FLAG_NOBALL))) det.balls++
      if (wk) {
        if (wk[0] !== 7) det.wkts++
        if (!det.batters.includes(wk[1])) det.batters.push(wk[1])
        det.dismissal.set(wk[1], dismissalText(d, wk[0], bowler, wk[2]))
      }
    }
    out.push(det)
  }
  return out
}

/** Flattened ball-by-ball events with commentary text */
export function ballEvents(d: Data, m: RawMatch): BallEvent[] {
  const evs: BallEvent[] = []
  const n = (i: number) => d.players[i]?.name ?? '?'
  m.innings.forEach((inn, ii) => {
    let lastOver = -1
    let legal = 0
    for (const b of inn.balls) {
      const [over, batter, bowler, rb, rx, flags, wk] = b
      if (over !== lastOver) {
        lastOver = over
        legal = 0
      }
      const isLegal = !(flags & (FLAG_WIDE | FLAG_NOBALL))
      if (isLegal) legal++
      const label = `${over}.${isLegal ? legal : legal + 1}`
      let text = ''
      let short = String(rb + rx)
      let cls: BallEvent['cls'] = ''
      if (wk) {
        text = `OUT! ${n(wk[1])} ${dismissalText(d, wk[0], bowler, wk[2])}`
        short = 'W'
        cls = 'bw'
      } else if (rb === 6) {
        text = 'SIX! Into the stands'
        cls = 'b6'
      } else if (rb === 4 && !(flags & FLAG_NONBOUNDARY)) {
        text = 'FOUR! Raced to the rope'
        cls = 'b4'
      } else if (flags & FLAG_WIDE) {
        text = `Wide${rx > 1 ? `, ${rx} runs` : ''}`
        short = `${rx}wd`
        cls = 'bx'
      } else if (flags & FLAG_NOBALL) {
        text = `No ball${rb ? `, ${rb} off the bat` : ''} — free hit`
        short = 'nb'
        cls = 'bx'
      } else if (flags & (FLAG_BYE | FLAG_LEGBYE)) {
        text = `${rx} ${flags & FLAG_BYE ? 'bye' : 'leg bye'}${rx > 1 ? 's' : ''}`
        short = `${rx}${flags & FLAG_BYE ? 'b' : 'lb'}`
        cls = 'bx'
      } else if (rb === 0) {
        text = 'No run, dot ball'
        short = '•'
      } else {
        text = `${rb} run${rb > 1 ? 's' : ''}`
      }
      evs.push({ inn: ii, label, batter, bowler, text: `${n(bowler)} to ${n(batter)} — ${text}`, desc: text, short, cls })
    }
  })
  return evs
}
