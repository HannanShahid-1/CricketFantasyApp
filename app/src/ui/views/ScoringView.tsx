import { useMemo } from 'react'
import { ROLE_NAME } from '../../engine/data'
import { SCORING_RULES, fmt } from '../../engine/scoring'
import type { Role } from '../../engine/types'
import { getData, useApp } from '../../store'
import { PlayerAvatar, TeamChip } from '../common'

export function ScoringView() {
  const d = getData()
  const openPlayer = useApp((s) => s.openPlayer)

  // real distribution of single-match scores this season under these rules
  const stats = useMemo(() => {
    const all: { p: number; mi: number; pts: number }[] = []
    for (const p of d.pool) for (const g of p.games.values()) all.push({ p: p.idx, mi: g.mi, pts: g.pts.total })
    const byRole = {} as Record<Role, { n: number; sum: number }>
    for (const x of all) {
      const r = d.players[x.p].role
      byRole[r] ??= { n: 0, sum: 0 }
      byRole[r].n++
      byRole[r].sum += x.pts
    }
    const sorted = [...all].sort((a, b) => b.pts - a.pts)
    const median = sorted[Math.floor(sorted.length / 2)]?.pts ?? 0
    return { top: sorted.slice(0, 8), byRole, median, n: all.length }
  }, [d])

  return (
    <>
      <div className="page-title">
        <h1>Scoring</h1>
        <div className="sub">Option 1 · Standard — football-sized decimal scoring</div>
      </div>
      <div className="grid3" style={{ marginBottom: 16 }}>
        {(Object.entries(SCORING_RULES) as [string, readonly (readonly [string, string])[]][]).map(([k, rules]) => (
          <div className="card" key={k}>
            <div className="card-h">
              <span className={`slot ${k === 'batting' ? 'BAT' : k === 'bowling' ? 'BOWL' : 'WK'}`}>{k === 'batting' ? 'BAT' : k === 'bowling' ? 'BOWL' : 'FLD'}</span>
              <h3 style={{ textTransform: 'capitalize' }}>{k}</h3>
            </div>
            <div className="card-b col" style={{ gap: 0 }}>
              {rules.map(([label, v]) => (
                <div key={label} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
                  <span className="grow" style={{ fontSize: 13 }}>{label}</span>
                  <span className="num turf right" style={{ fontSize: 12.5, maxWidth: 170 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-h">
            <h3>How it played out in IPL {d.raw.simSeason}</h3>
          </div>
          <div className="card-b">
            <div className="tiles" style={{ marginBottom: 12 }}>
              <div className="tile">
                <div className="v">{fmt(stats.median, 1)}</div>
                <div className="k">Median match score</div>
              </div>
              <div className="tile">
                <div className="v">{stats.n}</div>
                <div className="k">Player-matches</div>
              </div>
            </div>
            {(['WK', 'BAT', 'ARB', 'ARW', 'BOWL'] as Role[]).map((r) => {
              const x = stats.byRole[r]
              if (!x) return null
              const avg = x.sum / x.n
              return (
                <div key={r} className="row" style={{ padding: '7px 0' }}>
                  <span className={`role ${r}`} style={{ width: 150 }}>{ROLE_NAME[r]}</span>
                  <div className="progress grow">
                    <i style={{ width: `${Math.min(100, (avg / 25) * 100)}%` }} />
                  </div>
                  <span className="num" style={{ width: 48, textAlign: 'right' }}>{fmt(avg, 1)}</span>
                </div>
              )
            })}
            <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Average points per appearance, by role.</div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Biggest single-match scores</h3>
          </div>
          <div className="card-b" style={{ paddingTop: 6 }}>
            {stats.top.map((x, i) => {
              const p = d.players[x.p]
              const m = d.matches[x.mi]
              const opp = m.teams[0] === p.team ? m.teams[1] : m.teams[0]
              return (
                <div key={i} className="pcell" style={{ padding: '7px 0' }} onClick={() => openPlayer(p.idx)}>
                  <PlayerAvatar p={p} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="pname">{p.name}</div>
                    <div className="pmeta" style={{ marginTop: 1 }}>
                      <TeamChip code={p.team} /> v {opp}
                    </div>
                  </div>
                  <span className="num turf" style={{ fontSize: 18, fontWeight: 700 }}>{fmt(x.pts)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
