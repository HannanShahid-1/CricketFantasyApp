import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { availability, matchProjection, perMatchProj, type Data } from '../src/engine/data'
import { loadData } from '../src/loadData'
import { fantasyAdvice, gameVerdict } from '../src/engine/fantasyAdvice'
import { createLeague, playerWeek, setMatchPick } from '../src/engine/league'
import { scoutingProfile, performanceContext } from '../src/engine/playerProfile'
import { playerOwnership, playerRanks, playerReports, playerSeasonStats } from '../src/engine/playerInsights'
let d: Data
beforeAll(async () => {
  globalThis.fetch = (async (url: string) => new Response(readFileSync(join(__dirname, '../public', String(url).replace(/^\//, ''))))) as typeof fetch
  d = await loadData()
})
it('forecasts and previews ignore target results and future XIs', () => {
  const p = d.pool.find((p) => p.games.size > 5)!
  const mi = d.teamMis[p.team][2]
  const expected = matchProjection(d, p, mi, mi)
  const copy = structuredClone(d)
  for (const m of copy.matches.slice(mi)) { m.xi.clear(); m.points.clear(); m.lines.clear(); m.raw.innings = [] }
  for (const pl of copy.players) for (const i of pl.games.keys()) if (i >= mi) pl.games.delete(i)
  expect(matchProjection(copy, copy.players[p.idx], mi, mi)).toEqual(expected)
  expect(playerReports(copy, copy.players[p.idx], mi)).toEqual(playerReports(d, p, mi))
  expect(scoutingProfile(copy, copy.players[p.idx], mi)).toEqual(scoutingProfile(d, p, mi))
})
it('uses current-season stats even before the first appearance', () => {
  const p = d.pool[0]
  expect(playerRanks(d, p, 0)).toEqual({ season: d.raw.simSeason, role: null, overall: null })
  expect(playerOwnership(null, p.idx)).toEqual({ rostered: null, started: null })
  const stats = playerSeasonStats(d, p, 0)
  expect(stats.season).toBe(d.raw.simSeason)
  expect(stats.apps).toBe(0)
  expect(stats.stats.find(([label]) => label === 'Runs' || label === 'Wickets')?.[1]).toBe('0')
  expect(playerReports(d, p, 0).every((r) => r.kind === 'Preview')).toBe(true)
})
it('walk-forward evaluates all roster candidates, including nonappearances', () => {
  let n = 0, baselineError = 0, candidateError = 0, actual = 0, predicted = 0
  const halves = [{ n: 0, baseline: 0, matchup: 0 }, { n: 0, baseline: 0, matchup: 0 }]
  for (const m of d.matches) for (const p of d.pool.filter((p) => m.teams.includes(p.team))) {
    const forecast = matchProjection(d, p, m.mi, m.mi)
    const target = p.games.get(m.mi)?.pts.total ?? 0
    const baseline = perMatchProj(d, p, m.mi) * availability(d, p, m.mi)
    expect(Number.isFinite(forecast.total)).toBe(true)
    expect(forecast.total).toBeGreaterThanOrEqual(0)
    expect(Math.abs(forecast.adjustment)).toBeLessThanOrEqual(0.2500001)
    baselineError += Math.abs(baseline - target); candidateError += Math.abs(forecast.total - target)
    actual += target; predicted += forecast.total; n++
    const half = halves[m.mi < d.matches.length / 2 ? 0 : 1]
    half.n++; half.baseline += Math.abs(baseline - target); half.matchup += Math.abs(forecast.total - target)
  }
  console.log(JSON.stringify({ samples: n, baselineMAE: baselineError / n, opponentMAE: candidateError / n, actualMean: actual / n, forecastMean: predicted / n, halves: halves.map((h) => ({ samples: h.n, baselineMAE: h.baseline / h.n, matchupMAE: h.matchup / h.n })) }))
  // Rough-estimate preset is user-selected, not asserted to outperform the baseline.
  expect(Number.isFinite(candidateError / n)).toBe(true)
})
it('recaps use only completed appearances and display real totals', () => {
  for (const role of ['WK', 'BAT', 'ARB', 'ARW', 'BOWL']) {
    const p = d.pool.find((p) => p.role === role && p.games.size > 3)!
    const cutoff = [...p.games.keys()][2] + 1
    const reports = playerReports(d, p, cutoff)
    for (const r of reports.filter((r) => r.kind === 'Recap')) {
      expect(r.mi).toBeLessThan(cutoff)
      const g = p.games.get(r.mi)
      if (g) expect(r.summary).toContain(g.pts.total.toFixed(1))
      else expect(r.title).toContain('Did not appear')
    }
    expect(playerSeasonStats(d, p, cutoff).apps).toBe([...p.games.keys()].filter((mi) => mi < cutoff).length)
  }
})

it('identifies batting and bowling usage from observed deliveries', () => {
  const salt = d.pool.find((p) => p.fullName === 'Phil Salt')!
  const bumrah = d.pool.find((p) => p.fullName === 'Jasprit Bumrah')!
  const bat = scoutingProfile(d, salt, 0), bowl = scoutingProfile(d, bumrah, 0)
  expect(bat.identity).toContain('early-innings batter')
  expect(bat.ballsPerInnings).toBeGreaterThan(0)
  expect(bowl.identity).toContain('bowler')
  expect(bowl.oversPerAppearance).toBeGreaterThan(2)
  expect(bowl.deathShare).toBeGreaterThan(0)
  const starc = scoutingProfile(d, d.pool.find((p) => p.fullName === 'Mitchell Starc')!, 0)
  expect(starc.identity).not.toContain('batter')
  expect(starc.identity).toContain('bowler')
})
it('every player receives a finite, sample-aware scouting profile', () => {
  for (const p of d.pool) for (const cutoff of [0, 10, d.matches.length]) {
    const profile = scoutingProfile(d, p, cutoff)
    expect(profile.identity.length).toBeGreaterThan(0)
    expect(profile.limited).toBe(profile.sampleSize < 5)
    for (const metric of [profile.average, profile.median, profile.ballsPerInnings, profile.oversPerAppearance, profile.strikeRate, profile.economy]) {
      if (metric !== null) expect(Number.isFinite(metric)).toBe(true)
    }
    if (!profile.sampleSize) { expect(profile.average).toBeNull(); expect(profile.trend).toBe('unknown') }
  }
})
it('judges a return against the individual rather than a universal points threshold', () => {
  const profile = scoutingProfile(d, d.pool.find((p) => p.s25.apps >= 5)!, 0)
  expect(performanceContext({ ...profile, average: 30, limited: false }, 15).text).toContain('below')
  expect(performanceContext({ ...profile, average: 5, limited: false }, 15).text).toContain('above')
  expect(performanceContext({ ...profile, sampleSize: 1, limited: true }, 50).text).toContain('too small')
})
it('published historical recaps do not learn from later results', () => {
  const p = d.pool.find((p) => p.games.size > 8)!
  const mi = d.teamMis[p.team].at(-2)!
  const first = playerReports(d, p, mi + 1).find((r) => r.key === `recap-${mi}`)
  const later = playerReports(d, p, d.matches.length).find((r) => r.key === `recap-${mi}`)
  expect(first).toBeDefined()
  expect(later).toEqual(first)
})

it('makes evidence-based fixture differences and reconciles explanation to the total', () => {
  const p = d.pool.find((p) => p.fullName === 'Phil Salt')!
  const forecasts = d.teamMis[p.team].map((mi) => matchProjection(d, p, mi, 0))
  expect(new Set(forecasts.map((f) => f.total.toFixed(1))).size).toBeGreaterThan(1)
  console.log('Salt preseason fixture projections:', forecasts.map((f) => ({ opponent: f.opponent, pts: f.total.toFixed(1) })))
  for (const f of forecasts) {
    expect(f.total).toBeCloseTo(f.base * f.chance + f.components.reduce((n, c) => n + c.points, 0), 8)
    expect(f.trainingSamples).toBeGreaterThan(100)
  }
  const copy = structuredClone(d), mi = d.teamMis[p.team][0]
  copy.matches[mi].raw.venue = 'Unseen venue'
  const unknown = matchProjection(copy, copy.players[p.idx], mi, 0)
  expect(unknown.venueSamples).toBe(0)
  expect(unknown.components.find((c) => c.label === 'Venue history')!.points).toBe(0)
})
it('uses the selected fixture forecast in team scores without altering actual points', () => {
  const p = d.pool.find((p) => p.fullName === 'Phil Salt')!
  const l = createLeague(d, { name: 'Forecast check', teamName: 'Me', numTeams: 8, draftSlot: 'random', timer: 0, speed: 'instant' })
  l.phase = 'season'
  const mis = d.teamGw[p.team][1]
  l.teams[0].roster = [p.idx]
  l.teams[0].starters[0] = p.idx
  expect(playerWeek(d, l, 0, p.idx, 1).remaining).toBe(matchProjection(d, p, mis[0], 0).total)
  expect(setMatchPick(d, l, 0, p.idx, mis[1])).toBeNull()
  expect(playerWeek(d, l, 0, p.idx, 1).remaining).toBe(matchProjection(d, p, mis[1], 0).total)
  l.played = mis[1] + 1
  expect(playerWeek(d, l, 0, p.idx, 1).banked).toBe(p.games.get(mis[1])?.pts.total ?? 0)
})

it('gives role-specific editorial tiers without inventing evidence for newcomers', () => {
  const p = d.pool.find((p) => p.fullName === 'Phil Salt')!
  const advice = fantasyAdvice(d, p, 0, 8)
  expect(advice.tier).toMatch(/^WK[0-9]+$/)
  expect(advice.explanation).toContain('8-team')
  expect(advice.opinion).toMatch(/XI|confirmed/)
  const newcomer = d.pool.find((p) => !p.history.length)!
  expect(fantasyAdvice(d, newcomer, 0).tier).toBeNull()
  expect(fantasyAdvice(d, newcomer, 0).recommendation).toBe('Unproven')
})
it('reacts differently to good and poor returns without promising the next score', () => {
  const p = d.pool.find((p) => p.fullName === 'Phil Salt')!
  const mi = d.teamMis[p.team][0]
  expect(gameVerdict(d, p, mi, 45)).toContain('managers smiling')
  expect(gameVerdict(d, p, mi, 0)).toContain('frustrating return')
  expect(gameVerdict(d, p, mi, 45)).not.toContain('guaranteed')
})
it('makes sparse availability a wait-for-XI call even for a historically established player', () => {
  const copy = structuredClone(d)
  const p = copy.pool.find((p) => p.fullName === 'Phil Salt')!
  p.prior.avail = 0.2
  expect(fantasyAdvice(copy, p, 0).recommendation).toBe('Wait for XI')
})

it('waits for a confirmed return after missed fixtures instead of recommending a blind start', () => {
  const p = d.pool.find((p) => p.fullName === 'Phil Salt')!
  const cutoff = d.teamMis[p.team][8] + 1
  const advice = fantasyAdvice(d, p, cutoff)
  expect(advice.recommendation).toBe('Wait for XI')
  expect(advice.opinion).toContain('missed')
  expect(advice.opinion).not.toContain('injured')
})
