// Evidence-based scouting profiles. Historical replay cutoffs apply to every observation.
import type { Data, Player } from './data'
import { computeLines, fmt, score, type StatLine } from './scoring'
import { FLAG_NOBALL, FLAG_WIDE, type RawMatch } from './types'

interface Observation {
  mi: number // -1 = prior season; otherwise replay index
  line: StatLine
  pts: number
  firstOver: number | null
  powerplay: number
  death: number
}
const cache = new WeakMap<Data, Map<number, Observation[]>>()
function observations(d: Data) {
  const cached = cache.get(d)
  if (cached) return cached
  const all = new Map<number, Observation[]>()
  const addMatch = (raw: RawMatch, mi: number, lines: Map<number, StatLine>) => {
    const phases = new Map<number, { firstOver: number | null; powerplay: number; death: number }>()
    const get = (id: number) => {
      let phase = phases.get(id)
      if (!phase) { phase = { firstOver: null, powerplay: 0, death: 0 }; phases.set(id, phase) }
      return phase
    }
    for (const inn of raw.innings) for (const ball of inn.balls) {
      const [over, batter, bowler, , , flags] = ball
      const bat = get(batter)
      if (bat.firstOver === null) bat.firstOver = over
      if (!(flags & (FLAG_WIDE | FLAG_NOBALL))) {
        const bowl = get(bowler)
        if (over < 6) bowl.powerplay++
        if (over >= 16) bowl.death++
      }
    }
    for (const [id, line] of lines) {
      if (!line.played) continue
      const entries = all.get(id) ?? []
      entries.push({ mi, line, pts: score(line, d.players[id].role).total,
        ...(phases.get(id) ?? { firstOver: null, powerplay: 0, death: 0 }) })
      all.set(id, entries)
    }
  }
  const previous = Object.entries(d.raw.seasons).filter(([season]) => Number(season) < Number(d.raw.simSeason))
  for (const [, matches] of previous) for (const m of [...matches].sort((a, b) => a.date.localeCompare(b.date))) addMatch(m, -1, computeLines(m))
  for (const m of d.matches) addMatch(m.raw, m.mi, m.lines)
  cache.set(d, all)
  return all
}

export interface ScoutingProfile {
  identity: string
  sampleSize: number
  currentApps: number
  limited: boolean
  average: number | null
  median: number | null
  recentAverage: number | null
  trend: 'rising' | 'falling' | 'steady' | 'unknown'
  ballsPerInnings: number | null
  oversPerAppearance: number | null
  strikeRate: number | null
  economy: number | null
  earlyShare: number | null
  deathShare: number | null
  volatile: boolean
  evidence: string[]
  outlook: string
}

export function scoutingProfile(d: Data, p: Player, played: number): ScoutingProfile {
  const known = (observations(d).get(p.idx) ?? []).filter((g) => g.mi < played)
  const current = known.filter((g) => g.mi >= 0)
  // Recent role: current season once there are 3 appearances, otherwise up to 8 known appearances.
  const roleSample = current.length >= 3 ? current.slice(-8) : known.slice(-8)
  const bat = roleSample.filter((g) => g.line.batted && g.firstOver !== null)
  const bowling = roleSample.filter((g) => g.line.bb > 0)
  const sum = (key: keyof StatLine) => roleSample.reduce((n, g) => n + Number(g.line[key]), 0)
  const earlyShare = bat.length ? bat.filter((g) => g.firstOver! < 2).length / bat.length : null
  const lateShare = bat.length ? bat.filter((g) => g.firstOver! >= 12).length / bat.length : null
  const legal = sum('bb')
  const deathShare = legal ? roleSample.reduce((n, g) => n + g.death, 0) / legal : null
  const ppShare = legal ? roleSample.reduce((n, g) => n + g.powerplay, 0) / legal : null
  // Frequent tail-end cameos are not evidence of a meaningful batting role.
  const batsOften = bat.length >= 3 && bat.length / Math.max(roleSample.length, 1) >= 0.5
    && sum('b') / bat.length >= (p.role === 'BOWL' ? 10 : 6)
  const bowlsOften = bowling.length >= 3 && bowling.length / Math.max(roleSample.length, 1) >= 0.5
    && legal / 6 / Math.max(roleSample.length, 1) >= 1
  const battingRole = batsOften ? earlyShare! >= 0.6 ? 'early-innings batter' : lateShare! >= 0.6 ? 'late-innings batter' : 'middle-innings batter' : null
  const bowlingRole = bowlsOften ? deathShare! >= 0.3 && ppShare! >= 0.3 ? 'powerplay and death-over bowler' : deathShare! >= 0.3 ? 'death-over bowler' : ppShare! >= 0.4 ? 'powerplay bowler' : 'middle-over bowler' : null
  const identity = battingRole && bowlingRole ? `${battingRole}; ${bowlingRole}` : battingRole ?? bowlingRole ?? 'Role still developing in the available data'
  const pts = known.map((g) => g.pts)
  const average = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null
  const sorted = [...pts].sort((a, b) => a - b)
  const median = sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null
  const recent = current.slice(-3)
  const recentAverage = recent.length ? recent.reduce((n, g) => n + g.pts, 0) / recent.length : null
  const earlier = known.filter((g) => !recent.includes(g))
  const earlierAvg = earlier.length ? earlier.reduce((n, g) => n + g.pts, 0) / earlier.length : null
  const delta = recentAverage !== null && earlierAvg !== null ? recentAverage - earlierAvg : 0
  const trend = recent.length < 3 || earlier.length < 5 ? 'unknown' : delta > Math.max(3, earlierAvg! * 0.25) ? 'rising' : delta < -Math.max(3, earlierAvg! * 0.25) ? 'falling' : 'steady'
  const spread = average !== null && pts.length >= 5 ? Math.sqrt(pts.reduce((n, x) => n + (x - average) ** 2, 0) / pts.length) : 0
  const volatile = pts.length >= 5 && spread > Math.max(6, average! * 0.7)
  const ballsPerInnings = bat.length ? sum('b') / bat.length : null
  const oversPerAppearance = roleSample.length && legal ? legal / 6 / roleSample.length : null
  const strikeRate = sum('b') ? sum('r') * 100 / sum('b') : null
  const economy = legal ? sum('rc') * 6 / legal : null
  const evidence: string[] = []
  if (bat.length >= 3 && earlyShare! >= 0.6) evidence.push(`First faced a ball in overs 1–2 in ${bat.filter((g) => g.firstOver! < 2).length} of ${bat.length} recent batting appearances.`)
  else if (bat.length >= 3 && lateShare! >= 0.6) evidence.push(`First faced a ball from over 13 onward in ${bat.filter((g) => g.firstOver! >= 12).length} of ${bat.length} recent batting appearances.`)
  if (ballsPerInnings !== null) evidence.push(`${fmt(ballsPerInnings, 1)} balls faced per batting appearance across the last ${roleSample.length} known appearances.`)
  if (oversPerAppearance !== null) evidence.push(`${fmt(oversPerAppearance, 1)} overs per appearance; ${Math.round(ppShare! * 100)}% of legal balls in overs 1–6 and ${Math.round(deathShare! * 100)}% in overs 17–20.`)
  if (average !== null) evidence.push(`${fmt(average, 1)} FPTS per appearance across ${known.length} known games; median ${fmt(median!, 1)}.`)
  const limited = known.length < 5
  const opportunity = battingRole && bowlingRole
    ? `His last ${roleSample.length} known appearances supplied ${fmt(ballsPerInnings!, 1)} balls per batting appearance and ${fmt(oversPerAppearance!, 1)} overs per game, giving him opportunities in both disciplines.`
    : battingRole
      ? `Across his last ${roleSample.length} known appearances, he faced ${fmt(ballsPerInnings!, 1)} balls per batting appearance at a strike rate of ${fmt(strikeRate!, 1)}.`
      : bowlingRole
        ? `Across his last ${roleSample.length} known appearances, he averaged ${fmt(oversPerAppearance!, 1)} overs per game at an economy of ${fmt(economy!, 1)}.`
        : 'There is not enough repeated workload evidence to assign a specialist role confidently.'
  const form = trend === 'rising' ? `His last three returns average ${fmt(recentAverage!, 1)} FPTS, above his earlier ${fmt(earlierAvg!, 1)} average, although three games are a short sample.`
    : trend === 'falling' ? `His last three returns average ${fmt(recentAverage!, 1)} FPTS, below his earlier ${fmt(earlierAvg!, 1)} average; a rebound is possible, not assured.`
      : trend === 'steady' ? `His last three returns average ${fmt(recentAverage!, 1)} FPTS, broadly in line with his earlier ${fmt(earlierAvg!, 1)} average.`
        : 'There is not enough current-season evidence to call a reliable form trend.'
  const outlook = `${opportunity} ${limited ? 'Limited history makes expectations especially uncertain.' : form} ${volatile ? 'His historical fantasy returns vary considerably, so managers should allow for both quiet games and big scores.' : ''}`.trim()
  return { identity, sampleSize: known.length, currentApps: current.length, limited, average, median, recentAverage, trend, ballsPerInnings, oversPerAppearance, strikeRate, economy, earlyShare, deathShare, volatile, evidence, outlook }
}

/** Compare with the player's own pre-match standard, not an arbitrary universal score. */
export function performanceContext(profile: ScoutingProfile, pts: number) {
  if (profile.limited || profile.average === null) return { label: 'Records a fantasy return', text: 'His earlier sample is too small to judge this against an established personal standard.' }
  const gap = pts - profile.average
  const threshold = Math.max(4, profile.average * 0.3)
  const level = gap > threshold ? 'above' : gap < -threshold ? 'below' : 'close to'
  return { label: level === 'above' ? 'Delivers above his usual return' : level === 'below' ? 'Falls short of his usual return' : 'Returns close to his usual level',
    text: `This was ${level} his earlier average of ${fmt(profile.average, 1)} FPTS per appearance (${profile.sampleSize} games).` }
}
