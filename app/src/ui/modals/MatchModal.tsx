import { Play } from 'lucide-react'
import { useMemo } from 'react'
import { rosteredBy } from '../../engine/league'
import { fmt, oversStr, type Points, type StatLine } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { FTeamAvatar, Modal, PlayerAvatar, TeamChip } from '../common'
import { fmtDate } from '../format'
import { economy, fantasyLeaders, inningsDetails, strikeRate } from '../scorecard'
import { useShallow } from 'zustand/react/shallow'

export function MatchModal({ mi }: { mi: number }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { openMatch, openPlayer, openLive } = useApp(useShallow((s) => ({ openMatch: s.openMatch, openPlayer: s.openPlayer, openLive: s.openLive })))
  const m = d.matches[mi]
  const inns = useMemo(() => inningsDetails(d, m.raw), [d, m])
  const owned = useMemo(() => rosteredBy(league), [league])
  const close = () => openMatch(null)

  const owner = (p: number) => {
    const o = owned.get(p)
    return o === undefined ? null : <FTeamAvatar t={league.teams[o]} size="sm" />
  }
  const ptsCell = (pts?: Points) => <td className="n accent" style={{ fontSize: 14 }}>{pts ? fmt(pts.total) : ''}</td>

  // fantasy leaderboard
  const lb = fantasyLeaders(m).slice(0, 6)

  return (
    <Modal
      size="lg"
      onClose={close}
      header={
        <div className="row" style={{ gap: 14 }}>
          <div>
            <div className="up dim">
              Match {m.raw.num} · {fmtDate(m.raw.date)} · {m.raw.venue}
            </div>
            <div className="row" style={{ gap: 10, marginTop: 6 }}>
              {m.totals.map((t, i) => (
                <span key={t.team} className="row" style={{ gap: 8 }}>
                  {i > 0 && <span className="dim">v</span>}
                  <TeamChip code={t.team} />
                  <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>
                    {t.runs}/{t.wkts}
                  </span>
                  <span className="dim">({oversStr(t.balls)})</span>
                </span>
              ))}
            </div>
            <div className="accent" style={{ fontWeight: 600, marginTop: 4 }}>{m.raw.result}</div>
          </div>
          <div className="grow" />
          <button className="btn sm" onClick={() => { close(); openLive(mi) }}>
            <Play size={14} /> Replay ball by ball
          </button>
        </div>
      }
    >
      <div className="modal-b col" style={{ gap: 18 }}>
        <div>
          <div className="up dim" style={{ marginBottom: 8 }}>Fantasy stars</div>
          <div className="row wrap" style={{ gap: 8 }}>
            {lb.map(([p, pts]) => (
              <div key={p} className="tile pcell" style={{ padding: '8px 12px' }} onClick={() => openPlayer(p)}>
                <PlayerAvatar p={d.players[p]} size="sm" />
                <div>
                  <div className="pname" style={{ fontSize: 13 }}>{d.players[p].name}</div>
                  <div className="num accent" style={{ fontWeight: 700 }}>{fmt(pts.total)} pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {inns.map((inn) => {
          const bowlTeam = m.teams.find((t) => t !== inn.team)!
          return (
            <div key={inn.team} className="card" style={{ overflow: 'hidden' }}>
              <div className="card-h">
                <TeamChip code={inn.team} />
                <h3>{d.teams[inn.team].name}</h3>
                <span className="display" style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 700 }}>
                  {inn.runs}/{inn.wkts} <span className="dim" style={{ fontSize: 13 }}>({oversStr(inn.balls)} ov · extras {inn.extras})</span>
                </span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Batter</th>
                    <th />
                    <th className="n">R</th>
                    <th className="n">B</th>
                    <th className="n">4s</th>
                    <th className="n">6s</th>
                    <th className="n">SR</th>
                    <th className="n">Fpts</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {inn.batters.map((p) => {
                    const l = m.lines.get(p) as StatLine
                    return (
                      <tr key={p}>
                        <td>
                          <span className="pcell" onClick={() => openPlayer(p)}>
                            <span className="pname">{d.players[p].name}</span>
                          </span>
                        </td>
                        <td className="dim" style={{ fontSize: 12 }}>{inn.dismissal.get(p) ?? 'not out'}</td>
                        <td className="n" style={{ fontSize: 15 }}>{l.r}</td>
                        <td className="n muted">{l.b}</td>
                        <td className="n muted">{l.fours}</td>
                        <td className="n muted">{l.sixes}</td>
                        <td className="n muted">{strikeRate(l)}</td>
                        {ptsCell(m.points.get(p))}
                        <td style={{ width: 36 }}>
                          {owner(p)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <table className="table" style={{ borderTop: '1px solid var(--line)' }}>
                <thead>
                  <tr>
                    <th>Bowler · {bowlTeam}</th>
                    <th className="n">O</th>
                    <th className="n">M</th>
                    <th className="n">R</th>
                    <th className="n">W</th>
                    <th className="n">Econ</th>
                    <th className="n">Dots</th>
                    <th className="n">Fpts</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {inn.bowlers.map((p) => {
                    const l = m.lines.get(p) as StatLine
                    return (
                      <tr key={p}>
                        <td>
                          <span className="pcell" onClick={() => openPlayer(p)}>
                            <span className="pname">{d.players[p].name}</span>
                          </span>
                        </td>
                        <td className="n">{oversStr(l.bb)}</td>
                        <td className="n muted">{l.maidens}</td>
                        <td className="n muted">{l.rc}</td>
                        <td className="n" style={{ fontSize: 15 }}>{l.w}</td>
                        <td className="n muted">{economy(l)}</td>
                        <td className="n muted">{l.dots}</td>
                        {ptsCell(m.points.get(p))}
                        <td style={{ width: 36 }}>
                          {owner(p)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
