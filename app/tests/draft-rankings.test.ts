import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildData } from '../src/engine/data'
import { chooseDraftPick, createLeague } from '../src/engine/league'
import { computeLines, score } from '../src/engine/scoring'
import type { RawData } from '../src/engine/types'
import { draftRatings, estimatedRound } from '../src/ui/draftRankings'
import { DEFAULT_LEAGUE_OPTIONS } from '../src/ui/draft'
const raw = JSON.parse(readFileSync(new URL('../public/data/ipl.json', import.meta.url), 'utf8')) as RawData
const d = buildData(raw, { players: {}, teams: {} }, {})
describe('2026 retrospective mobile draft rankings', () => {
  it('uses supplied 2026 match points with app scoring and retains 2025 totals', () => {
    const totals = new Map<number, { points: number; apps: number }>()
    for (const m of raw.seasons[raw.simSeason]) for (const [pid, line] of computeLines(m)) {
      if (!line.played) continue
      const r = totals.get(pid) ?? { points: 0, apps: 0 }
      r.points += score(line, d.players[pid].role).total; r.apps++; totals.set(pid, r)
    }
    for (const p of d.pool) {
      const r = draftRatings(d).get(p.idx)!
      expect(r.points26).toBeCloseTo(totals.get(p.idx)?.points ?? 0)
      expect(r.games26).toBe(totals.get(p.idx)?.apps ?? 0)
      expect(r.points25).toBe(p.s25.pts)
      if (r.games26) expect(r.ppg).toBeCloseTo(r.points26 / r.games26)
      expect(Number.isFinite(r.projection)).toBe(true)
    }
  })
  it('assigns unique ranks and round estimates for eight- and ten-team leagues', () => {
    const rows = [...draftRatings(d).values()].sort((a, b) => a.rank - b.rank)
    expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1))
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value)
    expect(estimatedRound(8, 8)).toBe(1); expect(estimatedRound(9, 8)).toBe(2)
    expect(estimatedRound(10, 10)).toBe(1); expect(estimatedRound(11, 10)).toBe(2)
  })
  it('supports mobile valuations while retaining queue priority', () => {
    const l = createLeague(d, { ...DEFAULT_LEAGUE_OPTIONS, draftSlot: 1 })
    const [target, queued] = d.pool
    expect(chooseDraftPick(d, l, 0, { noise: 0, value: (p) => p.idx === target.idx ? 1e6 : 0 })).toBe(target.idx)
    l.draft.queue = [queued.idx]
    expect(chooseDraftPick(d, l, 0, { noise: 0, useQueue: true, value: (p) => p.idx === target.idx ? 1e6 : 0 })).toBe(queued.idx)
  })
})
