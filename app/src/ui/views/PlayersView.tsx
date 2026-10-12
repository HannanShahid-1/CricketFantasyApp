import { ArrowLeftRight, Plus, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { restOfSeason, seasonToDate } from '../../engine/data'
import { addMode, currentWeek, playerWeek, rosteredBy } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import type { Role } from '../../engine/types'
import { getData, useApp } from '../../store'
import { MatchBalls, PlayerAvatar, RoleTag, TeamChip } from '../common'
import { weekLabel } from '../format'
import { useShallow } from 'zustand/react/shallow'

type SortKey = 'season' | 'avg' | 'week' | 'ros' | 'last' | 'prev'

function Th({ k, sort, onSort, children }: { k: SortKey; sort: SortKey; onSort: (k: SortKey) => void; children: ReactNode }) {
  return (
    <th className={`n sort ${sort === k ? 'on' : ''}`} onClick={() => onSort(k)}>
      {children}
      {sort === k ? ' ↓' : ''}
    </th>
  )
}

export function PlayersView() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { openPlayer, openAdd, openTrade } = useApp(useShallow((s) => ({ openPlayer: s.openPlayer, openAdd: s.openAdd, openTrade: s.openTrade })))
  const [status, setStatus] = useState<'avail' | 'all' | 'mine' | 'rostered'>('avail')
  const [role, setRole] = useState<'ALL' | Role | 'AR'>('ALL')
  const [team, setTeam] = useState('ALL')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('ros')
  const week = currentWeek(d, league)
  const owned = useMemo(() => rosteredBy(league), [league])

  // every number a row shows is computed once here, then the same values drive both sorting and rendering
  const rows = useMemo(() => {
    const needle = q.toLowerCase()
    const list = d.pool.filter((p) => {
      const o = owned.get(p.idx)
      if (status === 'avail' && o !== undefined) return false
      if (status === 'mine' && o !== 0) return false
      if (status === 'rostered' && o === undefined) return false
      if (role === 'AR' ? !(p.role === 'ARB' || p.role === 'ARW') : role !== 'ALL' && p.role !== role) return false
      if (team !== 'ALL' && p.team !== team) return false
      if (needle && !`${p.name} ${p.fullName} ${p.rawName}`.toLowerCase().includes(needle)) return false
      return true
    })
    const stats = list.map((p) => {
      const o = owned.get(p.idx)
      let last: number | null = null
      let lastMi = -1
      for (const g of p.games.values()) {
        if (g.mi < league.played && g.mi > lastMi) {
          lastMi = g.mi
          last = g.pts.total
        }
      }
      return {
        p, o, last,
        wk: playerWeek(d, league, o ?? null, p.idx, week),
        season: seasonToDate(p, league.played),
        ros: restOfSeason(d, p, league.played),
        mode: o === undefined ? addMode(d, league, p.idx, owned) : 'none',
      }
    })
    const key: Record<SortKey, (r: (typeof stats)[number]) => number> = {
      season: (r) => r.season.pts,
      avg: (r) => r.season.avg,
      week: (r) => r.wk.total,
      ros: (r) => r.ros,
      last: (r) => r.last ?? -99,
      prev: (r) => r.p.s25.avg,
    }
    return stats.sort((a, b) => key[sort](b) - key[sort](a))
  }, [d, league, owned, status, role, team, q, sort, week])

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
                <Th k="week" sort={sort} onSort={setSort}>Wk proj</Th>
                <Th k="last" sort={sort} onSort={setSort}>Last</Th>
                <th className="n">GP</th>
                <Th k="season" sort={sort} onSort={setSort}>Season</Th>
                <Th k="avg" sort={sort} onSort={setSort}>Avg</Th>
                <Th k="prev" sort={sort} onSort={setSort}>{Number(d.raw.simSeason) - 1} avg</Th>
                <Th k="ros" sort={sort} onSort={setSort}>ROS proj</Th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map(({ p, o, wk, season: s, ros, last, mode }) => {
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
                      <MatchBalls d={d} p={p} gw={week} played={league.played} counted={wk.mi} />
                    </td>
                    <td className="n">{fmt(wk.total, 1)}</td>
                    <td className="n">{last === null ? <span className="dim">–</span> : fmt(last)}</td>
                    <td className="n muted">{s.apps}</td>
                    <td className="n">{fmt(s.pts, 1)}</td>
                    <td className="n">{s.apps ? fmt(s.avg, 1) : '–'}</td>
                    <td className="n muted">{p.s25.apps ? fmt(p.s25.avg, 1) : '–'}</td>
                    <td className="n turf">{fmt(ros, 0)}</td>
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
