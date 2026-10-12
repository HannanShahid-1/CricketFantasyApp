import { Play, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { currentWeek, rosteredBy } from '../../engine/league'
import { oversStr } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { TeamChip } from '../common'
import { fmtDate } from '../format'
import { WeekPills } from './MatchupView'
import { useShallow } from 'zustand/react/shallow'

export function FixturesView() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { openMatch, openLive } = useApp(useShallow((s) => ({ openMatch: s.openMatch, openLive: s.openLive })))
  const [week, setWeek] = useState(() => currentWeek(d, league))
  const gw = d.gameweeks[week - 1]
  const owned = rosteredBy(league)

  return (
    <>
      <div className="page-title">
        <h1>IPL Fixtures</h1>
        <div className="sub">IPL {d.raw.simSeason} league stage · replayed from Cricsheet ball-by-ball data</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <WeekPills week={week} onChange={setWeek} />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {gw.mis.map((mi) => {
          const m = d.matches[mi]
          const done = mi < league.played
          const next = mi === league.played
          const mine = [...m.xi].filter((p) => owned.get(p) === 0).length
          return (
            <div key={mi} className={`fixture ${next ? 'next' : ''}`}>
              <div>
                <div style={{ fontWeight: 700 }}>{fmtDate(m.raw.date)}</div>
                <div className="dim" style={{ fontSize: 12 }}>
                  {m.raw.time} IST · M{m.raw.num}
                </div>
              </div>
              <div className="col" style={{ gap: 6, minWidth: 0 }}>
                {m.teams.map((t) => {
                  const inn = m.totals.find((x) => x.team === t)
                  return (
                    <div key={t} className={`vs-team ${done && m.raw.winner === t ? 'w' : ''}`}>
                      <TeamChip code={t} />
                      <span className="ellipsis">{d.teams[t].name}</span>
                      {done && inn && (
                        <span className="runs">
                          {inn.runs}/{inn.wkts} <span className="dim" style={{ fontSize: 11 }}>({oversStr(inn.balls)})</span>
                        </span>
                      )}
                    </div>
                  )
                })}
                <div className="dim ellipsis" style={{ fontSize: 11.5 }}>
                  {done ? m.raw.result : m.raw.venue}
                  {mine > 0 && <span className="turf"> · {mine} of your players {done ? 'played' : 'in this match'}</span>}
                </div>
              </div>
              <div className="row">
                {done && (
                  <>
                    <button className="btn sm" onClick={() => openMatch(mi)}>
                      <ScrollText size={14} /> Scorecard
                    </button>
                    <button className="btn sm ghost" onClick={() => openLive(mi)} title="Replay ball by ball">
                      <Play size={14} /> Replay
                    </button>
                  </>
                )}
                {next && league.phase === 'season' && (
                  <button className="btn sm live" onClick={() => openLive(mi)}>
                    <Play size={14} fill="currentColor" /> Watch live
                  </button>
                )}
                {!done && !next && <span className="chip">Upcoming</span>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
