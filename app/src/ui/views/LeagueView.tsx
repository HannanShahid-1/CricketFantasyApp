import { PERSONA_LABEL, REG_WEEKS, standings } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { useApp } from '../../store'
import { FTeamAvatar } from '../common'
import { weeklyResults } from '../weeklyResults'
import { useShallow } from 'zustand/react/shallow'

export function LeagueView() {
  const league = useApp((s) => s.league)!
  const { setTab, setViewWeek } = useApp(useShallow((s) => ({ setTab: s.setTab, setViewWeek: s.setViewWeek })))
  const rows = standings(league)
  const grid = weeklyResults(league)
  const playoffLine = 4

  return (
    <>
      <div className="page-title">
        <h1>Standings</h1>
        <div className="sub">
          Head-to-head + a weekly game vs the league median · top {playoffLine} make the playoffs
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th className="n">#</th>
              <th>Team</th>
              <th className="n">W-L</th>
              <th className="n">H2H</th>
              <th className="n">vs Median</th>
              <th className="n">PF</th>
              <th className="n">PA</th>
              <th className="n">Streak</th>
              <th className="n">FAAB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const t = league.teams[r.teamId]
              return (
                <tr key={r.teamId} className={t.isUser ? 'me' : ''} style={i === playoffLine - 1 ? { boxShadow: 'inset 0 -2px 0 color-mix(in srgb, var(--accent) 35%, transparent)' } : undefined}>
                  <td className="n" style={{ color: i < playoffLine ? 'var(--accent)' : 'var(--dim)' }}>{i + 1}</td>
                  <td>
                    <div className="row">
                      <FTeamAvatar t={t} size="sm" />
                      <div>
                        <div style={{ fontWeight: 700 }}>{t.name}</div>
                        <div className="dim" style={{ fontSize: 11.5 }}>
                          {t.isUser ? 'You' : `${t.owner} · ${PERSONA_LABEL[t.persona]}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="n" style={{ fontSize: 16 }}>
                    {r.w + r.mw}-{r.l + r.ml}
                    {r.t ? `-${r.t}` : ''}
                  </td>
                  <td className="n muted">
                    {r.w}-{r.l}
                  </td>
                  <td className="n muted">
                    {r.mw}-{r.ml}
                  </td>
                  <td className="n">{fmt(r.pf, 1)}</td>
                  <td className="n muted">{fmt(r.pa, 1)}</td>
                  <td className="n">
                    <span className={r.streak.startsWith('W') ? 'win' : r.streak ? 'loss' : 'dim'}>{r.streak || '–'}</span>
                  </td>
                  <td className="n muted">${t.faab}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h">
          <h3>Weekly results</h3>
          <span className="dim" style={{ fontSize: 12 }}>Green = won the matchup · ★ = beat the median</span>
        </div>
        <div className="scroll-y">
          <table className="table">
            <thead>
              <tr>
                <th>Team</th>
                {Array.from({ length: REG_WEEKS }, (_, i) => (
                  <th key={i} className="n sort" onClick={() => { setViewWeek(i + 1); setTab('matchup') }}>
                    W{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = league.teams[r.teamId]
                return (
                  <tr key={r.teamId} className={t.isUser ? 'me' : ''}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <FTeamAvatar t={t} size="sm" />
                        <span className="ellipsis" style={{ fontWeight: 600 }}>{t.name}</span>
                      </div>
                    </td>
                    {grid.get(t.id)!.map((c, i) => {
                      if (!c.played) {
                        return (
                          <td key={i} className="n dim" style={{ fontSize: 11 }}>
                            {c.opp !== null ? `v ${league.teams[c.opp].name.split(' ')[0]}` : '–'}
                          </td>
                        )
                      }
                      return (
                        <td key={i} className="n" style={{ color: c.outcome === 'win' ? 'var(--win)' : c.outcome === 'tie' ? 'var(--muted)' : 'var(--loss)' }}>
                          {fmt(c.score, 1)}
                          {c.beatMedian && <span className="gold"> ★</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
