// Historical matchup context with a rough-estimate preset and a prior-season trained reference.
// Every inference snapshot excludes target and unreplayed matches.
import type { Data, Player } from './data'
import { computeLines, score, type StatLine } from './scoring'
import type { Role } from './types'

interface RecordLine { total: number; bat: number; bowl: number; balls: number; bowled: number }
interface Aggregate { n: number; sum: number }
interface Snapshot {
  players: Map<number, RecordLine[]>
  venue: Map<string, Aggregate>
  opponent: Map<string, Aggregate>
}
interface Model { weights: number[]; trainingSamples: number; prior: Snapshot; snapshots: Map<number, Snapshot> }
const models = new WeakMap<Data, Model>()
const LIMIT = 0.25
// User-selected rough-estimate preset: transparent weights, not fitted probabilities.
const ROUGH_WEIGHTS = [0.65, 0.65, 0.45, 0.25, 0.25]
const bounded = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
const mean = (xs: RecordLine[], key: keyof RecordLine) => xs.length ? xs.reduce((n, x) => n + x[key], 0) / xs.length : 0
const key = (role: Role, context: string) => `${role}:${context}`
function add(map: Map<string, Aggregate>, id: string, value: number) {
  const a = map.get(id) ?? { n: 0, sum: 0 }; a.n++; a.sum += value; map.set(id, a)
}
function context(map: Map<string, Aggregate>, id: string) {
  const a = map.get(id)
  // Twenty neutral appearances stabilize small samples; never trust a one-match venue record.
  return { effect: a ? bounded(a.sum / (a.n + 20), 4) : 0, samples: a?.n ?? 0 }
}
function features(s: Snapshot, p: Player, venue: string, opponent: string, base: number) {
  const history = s.players.get(p.idx) ?? []
  const recent = history.slice(-3)
  const venueContext = context(s.venue, key(p.role, venue))
  const opponentContext = context(s.opponent, key(p.role, opponent))
  const weight = recent.length / (recent.length + 6)
  const form = history.length >= 5 ? bounded((mean(recent, 'total') - base) * weight, base * 0.5) : 0
  const batRate = mean(history, 'balls') ? mean(history, 'bat') / mean(history, 'balls') : 0
  const bowlRate = mean(history, 'bowled') ? mean(history, 'bowl') / mean(history, 'bowled') : 0
  const batWork = history.length >= 5 ? bounded((mean(recent, 'balls') - mean(history, 'balls')) * batRate * weight, base * 0.3) : 0
  const bowlWork = history.length >= 5 ? bounded((mean(recent, 'bowled') - mean(history, 'bowled')) * bowlRate * weight, base * 0.3) : 0
  return { xs: [venueContext.effect, opponentContext.effect, form, batWork, bowlWork], venueContext, opponentContext }
}
function blank(): Snapshot { return { players: new Map(), venue: new Map(), opponent: new Map() } }
function register(d: Data, s: Snapshot, lines: Map<number, StatLine>, venue: string, teams: [string, string], squads: Record<string, number[]>, bases: Map<number, number>) {
  for (const [id, line] of lines) {
    if (!line.played) continue
    const p = d.players[id], pts = score(line, p.role)
    const own = Object.entries(squads).find(([, ids]) => ids.includes(id))?.[0]
    const opponent = teams.find((t) => t !== own) ?? ''
    // Residual rather than raw points: facing strong players shouldn't label an opponent as weak.
    const residual = bounded(pts.total - (bases.get(id) ?? d.roleBaseline[p.role]), 30)
    add(s.venue, key(p.role, venue), residual)
    add(s.opponent, key(p.role, opponent), residual)
    const rows = s.players.get(id) ?? []
    rows.push({ total: pts.total, bat: pts.bat, bowl: pts.bowl, balls: line.b, bowled: line.bb })
    s.players.set(id, rows)
  }
}
function solve(rows: { xs: number[]; y: number }[]) {
  const size = 5
  const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size + 1 }, (_, j) => j === i ? 50 : 0))
  for (const row of rows) for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) matrix[i][j] += row.xs[i] * row.xs[j]
    matrix[i][size] += row.xs[i] * row.y
  }
  for (let i = 0; i < size; i++) {
    let pivot = i
    for (let r = i + 1; r < size; r++) if (Math.abs(matrix[r][i]) > Math.abs(matrix[pivot][i])) pivot = r
    ;[matrix[i], matrix[pivot]] = [matrix[pivot], matrix[i]]
    const divisor = matrix[i][i]
    if (Math.abs(divisor) < 1e-10) return Array(size).fill(0) as number[]
    for (let j = i; j <= size; j++) matrix[i][j] /= divisor
    for (let r = 0; r < size; r++) if (r !== i) {
      const factor = matrix[r][i]
      for (let j = i; j <= size; j++) matrix[r][j] -= factor * matrix[i][j]
    }
  }
  return matrix.map((row) => row[size])
}
function trainingModel(d: Data): Model {
  const cached = models.get(d)
  if (cached) return cached
  const prior = blank(), rows: { xs: number[]; y: number }[] = []
  const matches = Object.entries(d.raw.seasons).filter(([season]) => Number(season) < Number(d.raw.simSeason)).flatMap(([, ms]) => ms).sort((a, b) => a.date.localeCompare(b.date))
  for (const m of matches) {
    const lines = computeLines(m), bases = new Map<number, number>()
    for (const [id, line] of lines) {
      const p = d.players[id], history = prior.players.get(id) ?? []
      const base = (mean(history, 'total') * history.length + d.roleBaseline[p.role] * 3) / (history.length + 3)
      bases.set(id, base)
      const own = Object.entries(m.squads).find(([, ids]) => ids.includes(id))?.[0]
      const opponent = m.teams.find((t) => t !== own) ?? ''
      const f = features(prior, p, m.venue, opponent, base)
      if (line.played && history.length >= 3) rows.push({ xs: f.xs, y: score(line, p.role).total - base })
    }
    register(d, prior, lines, m.venue, m.teams, m.squads, bases)
  }
  const model = { weights: solve(rows), trainingSamples: rows.length, prior, snapshots: new Map<number, Snapshot>() }
  models.set(d, model)
  return model
}
function snapshot(d: Data, cutoff: number) {
  const model = trainingModel(d)
  const existing = model.snapshots.get(cutoff)
  if (existing) return { model, state: existing }
  const state: Snapshot = structuredClone(model.prior)
  // Build in chronological order; neither target nor future match squads/balls are consulted.
  for (const m of d.matches.slice(0, cutoff)) {
    const bases = new Map<number, number>()
    for (const [id] of m.lines) {
      const p = d.players[id], current = [...p.games.values()].filter((g) => g.mi < m.mi)
      const w25 = 0.5 * p.s25.apps
      bases.set(id, (w25 * p.s25.avg + current.reduce((n, g) => n + g.pts.total, 0) + 3 * d.roleBaseline[p.role] * (p.s25.apps ? 1 : 0.8)) / (w25 + current.length + 3))
    }
    register(d, state, m.lines, m.raw.venue, m.teams, m.raw.squads, bases)
  }
  model.snapshots.set(cutoff, state)
  return { model, state }
}

export function matchupAdjustment(d: Data, p: Player, mi: number, cutoff: number, base: number, mode: 'rough' | 'learned' = 'rough') {
  const { model, state } = snapshot(d, Math.min(cutoff, mi))
  const m = d.matches[mi], opponent = m.teams.find((t) => t !== p.team) ?? ''
  const f = features(state, p, m.raw.venue, opponent, base)
  const labels = ['Venue history', 'Opponent by role', 'Recent fantasy form', 'Batting workload', 'Bowling workload']
  const weights = mode === 'rough' ? ROUGH_WEIGHTS : model.weights
  const components = f.xs.map((x, i) => ({ label: labels[i], points: x * weights[i] }))
  const raw = components.reduce((n, c) => n + c.points, 0)
  const delta = bounded(raw, base * LIMIT)
  return { delta, components, venueSamples: f.venueContext.samples, opponentSamples: f.opponentContext.samples, trainingSamples: model.trainingSamples, venue: m.raw.venue }
}
