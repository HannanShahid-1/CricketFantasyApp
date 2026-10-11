// Option 1 "Standard" scoring: football-style decimals.
import {
  FLAG_BYE, FLAG_LEGBYE, FLAG_NOBALL, FLAG_NONBOUNDARY, FLAG_WIDE,
  type RawMatch, type Role,
} from './types'

export interface StatLine {
  played: boolean
  // batting
  batted: boolean
  r: number
  b: number
  fours: number
  sixes: number
  out: boolean
  // bowling
  bb: number // legal balls bowled
  rc: number // runs conceded
  w: number
  bowledLbw: number
  dots: number
  maidens: number
  // fielding
  ct: number
  st: number
  roDirect: number
  roAssist: number
}

export interface PointsPart {
  label: string
  pts: number
}

export interface Points {
  total: number
  bat: number
  bowl: number
  field: number
  other: number
  parts: PointsPart[]
}

export const emptyLine = (): StatLine => ({
  played: false, batted: false, r: 0, b: 0, fours: 0, sixes: 0, out: false,
  bb: 0, rc: 0, w: 0, bowledLbw: 0, dots: 0, maidens: 0, ct: 0, st: 0, roDirect: 0, roAssist: 0,
})

const BOWLER_WICKETS = new Set([0, 1, 2, 3, 4, 5]) // bowled, caught, lbw, stumped, c&b, hit wicket
const NOT_DISMISSAL = new Set([7]) // retired hurt

/**
 * Build stat lines for every player in a match.
 * `upTo` = number of balls (across both innings, in order) to include; omit for the full match.
 */
export function computeLines(match: RawMatch, upTo = Infinity): Map<number, StatLine> {
  const lines = new Map<number, StatLine>()
  const get = (p: number) => {
    let l = lines.get(p)
    if (!l) {
      l = emptyLine()
      lines.set(p, l)
    }
    return l
  }
  for (const ids of Object.values(match.squads)) for (const p of ids) get(p).played = true

  let seen = 0
  for (const inn of match.innings) {
    // over-level tracking for maidens: key over -> {bowler, legal, conceded}
    const overs = new Map<number, { bowler: number; legal: number; conceded: number; mixed: boolean }>()
    for (const ball of inn.balls) {
      if (seen >= upTo) break
      seen++
      const [over, batter, bowler, rb, rx, flags, wk] = ball
      const wide = (flags & FLAG_WIDE) !== 0
      const noball = (flags & FLAG_NOBALL) !== 0
      const legal = !wide && !noball

      const bat = get(batter)
      bat.batted = true
      bat.r += rb
      if (!wide) bat.b += 1
      if (rb === 4 && !(flags & FLAG_NONBOUNDARY)) bat.fours += 1
      if (rb === 6) bat.sixes += 1

      const bw = get(bowler)
      const byes = flags & (FLAG_BYE | FLAG_LEGBYE) ? rx : 0
      const conceded = rb + (rx - byes)
      bw.rc += conceded
      if (legal) {
        bw.bb += 1
        if (conceded === 0) bw.dots += 1
      }
      const o = overs.get(over) ?? { bowler, legal: 0, conceded: 0, mixed: false }
      if (o.bowler !== bowler) o.mixed = true
      if (legal) o.legal += 1
      o.conceded += conceded
      overs.set(over, o)

      if (wk) {
        const [kind, outP, fielders] = wk
        if (!NOT_DISMISSAL.has(kind)) {
          const op = get(outP)
          op.out = true
          op.batted = true
        }
        if (BOWLER_WICKETS.has(kind)) {
          bw.w += 1
          if (kind === 0 || kind === 2) bw.bowledLbw += 1
        }
        if (kind === 1 && fielders[0] !== undefined) get(fielders[0]).ct += 1
        if (kind === 4) bw.ct += 1
        if (kind === 3 && fielders[0] !== undefined) get(fielders[0]).st += 1
        if (kind === 6) {
          if (fielders.length === 1) get(fielders[0]).roDirect += 1
          else for (const f of fielders) get(f).roAssist += 1
        }
      }
    }
    for (const o of overs.values()) {
      if (!o.mixed && o.legal === 6 && o.conceded === 0) get(o.bowler).maidens += 1
    }
  }
  return lines
}

export const SCORING_RULES = {
  batting: [
    ['Each run', '0.25'],
    ['Four (bonus)', '+0.5'],
    ['Six (bonus)', '+1'],
    ['Reaching 30 / 50 / 100', '+2 / +3 more / +5 more'],
    ['Strike rate (min 10 balls)', '200+ +3 · 170–199 +2 · 150–169 +1 · 120–149 0 · 100–119 −1 · <100 −2'],
    ['Duck (BAT / WK / AR)', '−2'],
  ],
  bowling: [
    ['Wicket', '6'],
    ['Bowled / LBW (bonus)', '+1'],
    ['Dot ball', '0.25'],
    ['Maiden', '+3'],
    ['3 / 4 / 5+ wickets', '+2 / +4 / +6'],
    ['Economy (min 2 overs)', '<6 +3 · 6–7.49 +2 · 7.5–8.99 +1 · 9–10.49 0 · 10.5–11.99 −1 · 12+ −2'],
  ],
  fielding: [
    ['Catch', '+2'],
    ['Stumping', '+3'],
    ['Run-out (direct hit)', '+3'],
    ['Run-out (assisted)', '+1.5'],
    ['Played (XI or Impact sub)', '+1'],
  ],
} as const

function srBonus(r: number, b: number): number {
  if (b < 10) return 0
  const sr = (r / b) * 100
  if (sr >= 200) return 3
  if (sr >= 170) return 2
  if (sr >= 150) return 1
  if (sr >= 120) return 0
  if (sr >= 100) return -1
  return -2
}

function econBonus(rc: number, bb: number): number {
  if (bb < 12) return 0
  const econ = rc / (bb / 6)
  if (econ < 6) return 3
  if (econ < 7.5) return 2
  if (econ < 9) return 1
  if (econ < 10.5) return 0
  if (econ < 12) return -1
  return -2
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function score(l: StatLine, role: Role): Points {
  const parts: PointsPart[] = []
  const add = (label: string, pts: number) => {
    if (pts !== 0) parts.push({ label, pts: r2(pts) })
    return pts
  }
  let bat = 0
  let bowl = 0
  let field = 0
  let other = 0
  if (!l.played) return { total: 0, bat, bowl, field, other, parts }

  if (l.batted) {
    bat += add(`${l.r} runs`, l.r * 0.25)
    bat += add(`${l.fours} × 4s`, l.fours * 0.5)
    bat += add(`${l.sixes} × 6s`, l.sixes * 1)
    let ms = 0
    if (l.r >= 30) ms += 2
    if (l.r >= 50) ms += 3
    if (l.r >= 100) ms += 5
    bat += add(l.r >= 100 ? 'Century bonus' : l.r >= 50 ? 'Fifty bonus' : '30-run bonus', ms)
    const sr = srBonus(l.r, l.b)
    bat += add(`Strike rate ${l.b ? ((l.r / l.b) * 100).toFixed(0) : 0}`, sr)
    if (l.out && l.r === 0 && role !== 'BOWL') bat += add('Duck', -2)
  }
  if (l.bb > 0) {
    bowl += add(`${l.w} wkt${l.w === 1 ? '' : 's'}`, l.w * 6)
    bowl += add('Bowled/LBW bonus', l.bowledLbw)
    bowl += add(`${l.dots} dot balls`, l.dots * 0.25)
    bowl += add(`${l.maidens} maiden${l.maidens === 1 ? '' : 's'}`, l.maidens * 3)
    const haul = l.w >= 5 ? 6 : l.w >= 4 ? 4 : l.w >= 3 ? 2 : 0
    bowl += add(`${Math.min(l.w, 5)}${l.w >= 5 ? '+' : ''}-wicket haul`, haul)
    const ec = econBonus(l.rc, l.bb)
    bowl += add(`Economy ${l.bb ? (l.rc / (l.bb / 6)).toFixed(2) : '-'}`, ec)
  }
  field += add(`${l.ct} catch${l.ct === 1 ? '' : 'es'}`, l.ct * 2)
  field += add(`${l.st} stumping${l.st === 1 ? '' : 's'}`, l.st * 3)
  field += add('Run-out (direct)', l.roDirect * 3)
  field += add('Run-out (assist)', l.roAssist * 1.5)
  other += add('Played', 1)

  return { total: r2(bat + bowl + field + other), bat: r2(bat), bowl: r2(bowl), field: r2(field), other, parts }
}

export function oversStr(balls: number): string {
  return `${Math.floor(balls / 6)}${balls % 6 ? '.' + (balls % 6) : ''}`
}

export function batLine(l: StatLine): string | null {
  if (!l.batted) return null
  return `${l.r}${l.out ? '' : '*'} (${l.b})${l.fours ? ` ${l.fours}×4` : ''}${l.sixes ? ` ${l.sixes}×6` : ''}`
}

export function bowlLine(l: StatLine): string | null {
  if (!l.bb && !l.rc) return null
  return `${oversStr(l.bb)}-${l.maidens}-${l.rc}-${l.w}`
}

export function fieldLine(l: StatLine): string | null {
  const bits: string[] = []
  if (l.ct) bits.push(`${l.ct} ct`)
  if (l.st) bits.push(`${l.st} st`)
  if (l.roDirect + l.roAssist) bits.push(`${l.roDirect + l.roAssist} ro`)
  return bits.length ? bits.join(', ') : null
}

export const fmt = (n: number, d = 2) => {
  const v = Math.round(n * 100) / 100
  return d === 2 ? v.toFixed(2).replace(/\.00$/, '.0').replace(/(\.\d)0$/, '$1') : v.toFixed(d)
}
