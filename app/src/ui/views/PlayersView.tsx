import { ArrowLeftRight, Plus, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { restOfSeason, seasonToDate, weekProjection, type Player } from '../../engine/data'
import { addMode, currentWeek, rosteredBy } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import type { Role } from '../../engine/types'
import { getData, useApp } from '../../store'
import { MatchBalls, PlayerAvatar, RoleTag, TeamChip, weekLabel } from '../common'

type SortKey = 'season' | 'avg' | 'week' | 'ros' | 'last' | 'prev'

export function PlayersView() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { openPlayer, openAdd, openTrade } = useApp()
  const [status, setStatus] = useState<'avail' | 'all' | 'mine' | 'rostered'>('avail')
  const [role, setRole] = useState<'ALL' | Role | 'AR'>('ALL')
  const [team, setTeam] = useState('ALL')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('ros')
  const week = currentWeek(d, league)
  const owned = useMemo(() => rosteredBy(league), [league])

  const rows = useMemo(() => {
    const list = d.pool.filter((p) => {
      const o = owned.get(p.idx)
      if (status === 'avail' && o !== undefined) return false
      if (status === 'mine' && o !== 0) return false
      if (status === 'rostered' && o === undefined) return false
      if (role === 'AR' ? !(p.role === 'ARB' || p.role === 'ARW') : role !== 'ALL' && p.role !== role) return false
      if (team !== 'ALL' && p.team !== team) return false
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
    const lastPts = (p: Player) => {
      let best = -1
      let pts = 0
      for (const g of p.games.values()) if (g.mi < league.played && g.mi > best) ((best = g.mi), (pts = g.pts.total))
      return best < 0 ? -99 : pts
    }
    const val: Record<SortKey, (p: Player) => number> = {
      season: (p) => seasonToDate(p, league.played).pts,
      avg: (p) => seasonToDate(p, league.played).avg,
      week: (p) => weekProjection(d, p, week, league.played).total,
      ros: (p) => restOfSeason(d, p, league.played),
      last: lastPts,
      prev: (p) => p.s25.avg,
    }
    return list
      .map((p) => ({ p, v: val[sort](p) }))
      .sort((a, b) => b.v - a.v)
      .map((x) => x.p)
  }, [d, owned, status, role, team, q, sort, league.played, week])

  const Th = ({ k, children }: { k: SortKey; children: ReactNode }) => (
    <th className={`n sort ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>
      {children}
      {sort === k ? ' ↓' : ''}
    </th>
  )

  return (
    <>
      <div className="page-title">
        <h1>Players</h1>
        <div className="sub">{d.pool.length} IPL players · free agents, waivers & trade targets</div>
      </div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div className="seg">
          {(
            [
              ['avail', 'Available'],
              ['all', 'All'],
              ['rostered', 'Rostered'],
              ['mine', 'Mine'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="seg">
          {(['ALL', 'WK', 'BAT', 'AR', 'BOWL'] as const).map((r) => (
            <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>
              {r === 'ALL' ? 'All' : r}
            </button>
          ))}
        </div>
        <select className="input" style={{ height: 34 }} value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="ALL">All IPL teams</option>
          {d.raw.teams.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="row grow" style={{ position: 'relative', minWidth: 180 }}>
          <Search size={15} className="dim" style={{ position: 'absolute', left: 11 }} />
          <input className="input grow" style={{ height: 34, paddingLeft: 32 }} placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="scroll-y" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Status</th>
                <th>{weekLabel(week)}</th>
                <Th k="week">Wk proj</Th>
                <Th k="last">Last</Th>
                <th className="n">GP</th>
                <Th k="season">Season</Th>
                <Th k="avg">Avg</Th>
                <Th k="prev">{Number(d.raw.simSeason) - 1} avg</Th>
                <Th k="ros">ROS proj</Th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((p) => {
                const o = owned.get(p.idx)
                const s = seasonToDate(p, league.played)
                const mode = addMode(d, league, p.idx)
                let last: number | null = null
                let lastMi = -1
                for (const g of p.games.values()) if (g.mi < league.played && g.mi > lastMi) ((lastMi = g.mi), (last = g.pts.total))
                return (
                  <tr key={p.idx} className={o === 0 ? 'me' : ''}>
                    <td>
                      <div className="pcell" onClick={() => openPlayer(p.idx)}>
                        <PlayerAvatar p={p} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <div className="pname">{p.name}</div>
                          <div className="pmeta" style={{ marginTop: 1 }}>
                            <TeamChip code={p.team} /> <RoleTag p={p} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {o === undefined ? (
                        mode === 'waiver' ? <span className="chip gold">Waivers</span> : <span className="chip turf">FA</span>
                      ) : o === 0 ? (
                        <span className="chip ok">Mine</span>
                      ) : (
                        <span className="muted ellipsis" style={{ fontSize: 12, maxWidth: 130, display: 'inline-block' }}>{league.teams[o].name}</span>
                      )}
                    </td>
                    <td>
                      <MatchBalls d={d} p={p} gw={week} played={league.played} />
                    </td>
                    <td className="n">{fmt(weekProjection(d, p, week, league.played).total, 1)}</td>
                    <td className="n">{last === null ? <span className="dim">–</span> : fmt(last)}</td>
                    <td className="n muted">{s.apps}</td>
                    <td className="n">{fmt(s.pts, 1)}</td>
                    <td className="n">{s.apps ? fmt(s.avg, 1) : '–'}</td>
                    <td className="n muted">{p.s25.apps ? fmt(p.s25.avg, 1) : '–'}</td>
                    <td className="n turf">{fmt(restOfSeason(d, p, league.played), 0)}</td>
                    <td style={{ width: 96 }}>
                      {o === undefined && league.phase === 'season' && (
                        <button className={`btn sm ${mode === 'free' ? 'primary' : ''}`} onClick={() => openAdd(p.idx)}>
                          <Plus size={14} /> {mode === 'free' ? 'Add' : 'Claim'}
                        </button>
                      )}
                      {o !== undefined && o !== 0 && league.phase === 'season' && (
                        <button className="btn sm" onClick={() => openTrade(o)}>
                          <ArrowLeftRight size={13} /> Trade
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!rows.length && <div className="empty">No players match these filters.</div>}
        </div>
      </div>
    </>
  )
}
