import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { ROLE_NAME, restOfSeason, seasonToDate } from '../../engine/data'
import { addMode, isLocked, rosteredBy } from '../../engine/league'
import { batLine, bowlLine, fieldLine, fmt } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { FTeamAvatar, fmtDate, Modal, PlayerAvatar, TeamChip } from '../common'

export function PlayerModal({ pid }: { pid: number }) {
  const d = getData()
  const league = useApp((s) => s.league)
  const { openPlayer, openAdd, openTrade, drop, notify, openMatch } = useApp()
  const [open, setOpen] = useState<number | null>(null)
  const p = d.players[pid]
  const played = league?.phase === 'draft' || !league ? 0 : league.played
  const s = seasonToDate(p, played)
  const owner = league ? rosteredBy(league).get(pid) : undefined
  const ownerTeam = owner !== undefined ? league!.teams[owner] : null
  const team = d.teams[p.team]
  const close = () => openPlayer(null)

  // rank among same role this season
  const sameRole = d.pool.filter((x) => x.role === p.role).map((x) => ({ x, v: seasonToDate(x, played).pts })).sort((a, b) => b.v - a.v)
  const rank = sameRole.findIndex((r) => r.x.idx === pid) + 1

  const allMis = Object.values(d.teamGw[p.team] ?? {}).flat().sort((a, b) => a - b)
  const inSeason = league && league.phase !== 'draft'
  const mode = inSeason ? addMode(d, league!, pid) : 'none'

  return (
    <Modal
      onClose={close}
      header={
        <div className="row" style={{ gap: 16 }}>
          <PlayerAvatar p={p} size="xl" />
          <div style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: 26, fontWeight: 700 }}>{p.name}</div>
            <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
              <TeamChip code={p.team} />
              <span className="muted">{team?.name}</span>
              <span className={`role ${p.role}`}>{ROLE_NAME[p.role]}</span>
            </div>
            <div className="row" style={{ gap: 5, marginTop: 8 }}>
              <span className="dim" style={{ fontSize: 11, marginRight: 4 }}>ELIGIBLE</span>
              {p.elig.map((e) => (
                <span key={e} className={`slot ${e}`} style={{ minWidth: 0, height: 20, fontSize: 10.5 }}>
                  {e}
                </span>
              ))}
            </div>
          </div>
          <div className="grow" />
          <div className="col" style={{ alignItems: 'flex-end', gap: 8 }}>
            {ownerTeam ? (
              <div className="row" style={{ gap: 8 }}>
                <FTeamAvatar t={ownerTeam} size="sm" />
                <span style={{ fontWeight: 600 }}>{ownerTeam.isUser ? 'On your team' : ownerTeam.name}</span>
              </div>
            ) : inSeason ? (
              <span className={`chip ${mode === 'waiver' ? 'gold' : 'turf'}`}>{mode === 'waiver' ? 'On waivers' : 'Free agent'}</span>
            ) : null}
            {inSeason && league!.phase === 'season' && (
              <div className="row" style={{ gap: 6 }}>
                {owner === undefined && (
                  <button className="btn sm primary" onClick={() => { close(); openAdd(pid) }}>
                    <Plus size={14} /> {mode === 'free' ? 'Add' : 'Claim'}
                  </button>
                )}
                {owner !== undefined && owner !== 0 && (
                  <button className="btn sm" onClick={() => { close(); openTrade(owner) }}>
                    <ArrowLeftRight size={14} /> Trade for
                  </button>
                )}
                {owner === 0 && !isLocked(d, league!, pid) && (
                  <button
                    className="btn sm danger"
                    onClick={() => {
                      if (!confirm(`Drop ${p.name}?`)) return
                      const err = drop(pid)
                      notify(err ?? `Dropped ${p.name}`, err ? 'bad' : 'ok')
                      if (!err) close()
                    }}
                  >
                    <Trash2 size={14} /> Drop
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="modal-b">
        <div className="tiles" style={{ marginBottom: 18 }}>
          <div className="tile">
            <div className="v turf">{fmt(s.pts, 1)}</div>
            <div className="k">Season pts</div>
          </div>
          <div className="tile">
            <div className="v">{s.apps ? fmt(s.avg, 1) : '–'}</div>
            <div className="k">Pts / match</div>
          </div>
          <div className="tile">
            <div className="v">{s.apps}</div>
            <div className="k">Matches</div>
          </div>
          <div className="tile">
            <div className="v">{rank ? `#${rank}` : '–'}</div>
            <div className="k">Rank at role</div>
          </div>
          <div className="tile">
            <div className="v">{fmt(restOfSeason(d, p, played), 0)}</div>
            <div className="k">ROS projection</div>
          </div>
          <div className="tile">
            <div className="v">{p.s25.apps ? fmt(p.s25.avg, 1) : '–'}</div>
            <div className="k">{Number(d.raw.simSeason) - 1} avg ({p.s25.apps} GP)</div>
          </div>
        </div>

        <div className="up dim" style={{ marginBottom: 8 }}>Game log · IPL {d.raw.simSeason}</div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>GW</th>
                <th>Date</th>
                <th>Opp</th>
                <th>Batting</th>
                <th>Bowling</th>
                <th>Fielding</th>
                <th className="n">Pts</th>
              </tr>
            </thead>
            <tbody>
              {allMis.map((mi) => {
                const m = d.matches[mi]
                const opp = m.teams[0] === p.team ? m.teams[1] : m.teams[0]
                const g = p.games.get(mi)
                const done = mi < played
                return (
                  <Fragment key={mi}>
                    <tr style={{ cursor: done && g ? 'pointer' : undefined, opacity: done ? 1 : 0.45 }} onClick={() => done && g && setOpen(open === mi ? null : mi)}>
                      <td className="dim">{m.gw}</td>
                      <td>{fmtDate(m.raw.date)}</td>
                      <td>
                        <span className="row" style={{ gap: 6 }}>
                          v <TeamChip code={opp} />
                        </span>
                      </td>
                      {!done ? (
                        <td colSpan={4} className="dim">
                          Upcoming · {m.raw.time}
                        </td>
                      ) : !g ? (
                        <td colSpan={4} className="loss">
                          Did not play
                        </td>
                      ) : (
                        <>
                          <td>{batLine(g.line) ?? <span className="dim">–</span>}</td>
                          <td>{bowlLine(g.line) ?? <span className="dim">–</span>}</td>
                          <td>{fieldLine(g.line) ?? <span className="dim">–</span>}</td>
                          <td className="n" style={{ color: g.pts.total >= 25 ? 'var(--turf)' : g.pts.total < 2 ? 'var(--loss)' : undefined, fontSize: 15 }}>
                            {fmt(g.pts.total)}
                          </td>
                        </>
                      )}
                    </tr>
                    {open === mi && g && (
                      <tr>
                        <td colSpan={7} style={{ background: 'rgba(0,0,0,.2)' }}>
                          <div className="row wrap" style={{ gap: 6 }}>
                            {g.pts.parts.map((x, i) => (
                              <span key={i} className={`chip ${x.pts > 0 ? 'ok' : 'bad'}`}>
                                {x.label} {x.pts > 0 ? '+' : ''}
                                {fmt(x.pts)}
                              </span>
                            ))}
                            <button className="btn xs ghost" style={{ marginLeft: 'auto' }} onClick={() => { close(); openMatch(mi) }}>
                              Full scorecard →
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Tap a played match to see the points breakdown.</div>
      </div>
    </Modal>
  )
}
