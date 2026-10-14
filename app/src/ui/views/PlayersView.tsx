import { ArrowLeftRight, Plus, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { currentWeek } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { MatchBalls, PlayerAvatar, RoleTag, TeamChip } from '../common'
import { weekLabel } from '../format'
import { playerRows, ROLE_FILTERS, STATUS_LABEL, type PlayerStatus, type RoleFilter, type SortKey } from '../playerList'
import { useShallow } from 'zustand/react/shallow'

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
  const [status, setStatus] = useState<PlayerStatus>('avail')
  const [role, setRole] = useState<RoleFilter>('ALL')
  const [team, setTeam] = useState('ALL')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('ros')
  const week = currentWeek(d, league)

  const rows = useMemo(() => playerRows(getData(), league, { status, role, team, q }, sort), [league, status, role, team, q, sort])

  return (
    <>
      <div className="page-title">
        <h1>Players</h1>
        <div className="sub">{d.pool.length} IPL players · free agents, waivers & trade targets</div>
      </div>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div className="seg">
          {(Object.keys(STATUS_LABEL) as PlayerStatus[]).map((k) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
              {STATUS_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="seg">
          {ROLE_FILTERS.map((r) => (
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
              {rows.slice(0, 200).map(({ p, owner: o, week: wk, season: s, ros, last, mode }) => {
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
                        mode === 'waiver' ? <span className="chip gold">Waivers</span> : <span className="chip accent">FA</span>
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
                    <td className="n accent">{fmt(ros, 0)}</td>
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
