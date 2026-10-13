import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { ROLE_NAME, ROLE_LABEL, matchProjection, seasonToDate } from '../../engine/data'
import { playerOwnership, playerRanks, playerReports, playerSeasonStats } from '../../engine/playerInsights'
import { fantasyAdvice } from '../../engine/fantasyAdvice'
import { scoutingProfile } from '../../engine/playerProfile'
import { playerAge } from '../../engine/playerAge'
import { addMode, currentWeek, isLocked, rosteredBy, weekMatches } from '../../engine/league'
import { batLine, bowlLine, fieldLine, fmt } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { FTeamAvatar, Modal, PlayerPortrait, TeamChip } from '../common'
import { fmtDate, weekLabel } from '../format'
import { MatchPicker } from '../MatchPicker'
import { useShallow } from 'zustand/react/shallow'

export function PlayerModal({ pid }: { pid: number }) {
  const d = getData()
  const league = useApp((s) => s.league)
  const { openPlayer, openAdd, openTrade, drop, notify, openMatch } = useApp(useShallow((s) => ({ openPlayer: s.openPlayer, openAdd: s.openAdd, openTrade: s.openTrade, drop: s.drop, notify: s.notify, openMatch: s.openMatch })))
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const p = d.players[pid]
  const played = league?.phase === 'draft' || !league ? 0 : league.played
  const s = seasonToDate(p, played)
  const owner = league ? rosteredBy(league).get(pid) : undefined
  const ownerTeam = owner !== undefined ? league!.teams[owner] : null
  const profileTeam = p.team || p.profileTeam || ''
  const team = d.teams[profileTeam]
  const age = p.bio ? playerAge(p.bio.birthDate) : null
  const close = () => openPlayer(null)

  const ranks = playerRanks(d, p, played)
  const ownership = playerOwnership(league, pid)
  const stats = playerSeasonStats(d, p, played)
  const reports = playerReports(d, p, played, league?.teams.length ?? 8)
  const profile = scoutingProfile(d, p, played)
  const advice = fantasyAdvice(d, p, played, league?.teams.length ?? 8)
  const week = league?.phase === 'season' ? currentWeek(d, league) : null
  const displayWeek = selectedWeek ?? week ?? d.gameweeks.at(-1)?.gw ?? 1
  const weekMis = week !== null ? weekMatches(d, pid, week) : []
  const displayMis = weekMatches(d, pid, displayWeek)
  const displayGw = d.gameweeks.find((g) => g.gw === displayWeek)
  const avg = s.apps ? s.avg : null

  const allMis = d.teamMis[p.team] ?? []
  const inSeason = league && league.phase !== 'draft'
  const mode = inSeason ? addMode(d, league!, pid) : 'none'

  return (
    <Modal
      className="player-modal"
      onClose={close}
      header={
        <div className="player-hero" style={{ ['--tc' as string]: team?.color ?? '#334', ['--ta' as string]: team?.accent ?? '#556' }}>
          <div className="player-hero-art">
            {d.teamLogos[profileTeam] && <img className="player-hero-logo" src={`${import.meta.env.BASE_URL}${d.teamLogos[profileTeam]}`} alt="" aria-hidden />}
            <div className="player-hero-portrait"><PlayerPortrait p={p} /></div>
          </div>
          <div className="player-hero-details">
            <div className="display player-hero-name" title={p.fullName}>{p.fullName}</div>
            <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
              <TeamChip code={profileTeam} />
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
          <div className="col player-hero-actions" style={{ gap: 8 }}>
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
        <dl className="player-bio">
          <div><dt>Age</dt><dd>{age !== null ? `${age} years` : 'Not listed'}</dd></div>
          <div><dt>Nationality</dt><dd>{p.bio?.nationality || 'Not listed'}</dd></div>
          <div><dt>Batting style</dt><dd>{p.bio?.battingStyle || 'Not listed'}</dd></div>
          <div><dt>Bowling style</dt><dd>{p.bio?.bowlingStyle || 'Not listed'}</dd></div>
          {p.bio?.source && <a className="player-bio-source" href={p.bio.source} target="_blank" rel="noreferrer">Profile source ↗</a>}
        </dl>
        {owner === 0 && week !== null && weekMis.length > 0 && (
          <div className="this-week">
            <div>
              <div className="up dim">{weekLabel(week)} · which match counts</div>
              <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                {weekMis.length > 1
                  ? 'Only one counts. His first match counts unless you lock in another before it starts.'
                  : 'He has one match this week, so it counts.'}
              </div>
            </div>
            <MatchPicker pid={pid} />
          </div>
        )}
        <section className="player-section">
          <div className="player-metrics">
            <div><h3>Player rank · {ranks.season}</h3><div className="player-metric-pair">
              <div><strong>{ranks.role ? `#${ranks.role}` : '—'}</strong><span>{ROLE_LABEL[p.role]}</span></div>
              <div><strong>{ranks.overall ? `#${ranks.overall}` : '—'}</strong><span>Overall</span></div>
            </div></div>
            <div><h3>Ownership · this league</h3><div className="player-metric-pair">
              <div><strong>{ownership.rostered === null ? '—' : `${ownership.rostered}%`}</strong><span>Rostered</span></div>
              <div><strong>{ownership.started === null ? '—' : `${ownership.started}%`}</strong><span>Started</span></div>
            </div></div>
            <div><h3>FPTS / game · {d.raw.simSeason}</h3><div className="player-metric-pair"><div><strong>{avg === null ? '—' : fmt(avg, 1)}</strong><span>{s.apps} appearances</span></div></div></div>
          </div>
          <p className="player-footnote">Ranks use total FPTS within each primary role and overall; ties share a rank. Ownership is 0% or 100% in this single league, not across the platform.</p>
        </section>

        <section className="player-section">
          <h3 className="up dim">Season stats · {stats.season}</h3>
          <dl className="player-stat-strip">
            <div><dt>Matches</dt><dd>{stats.apps}</dd></div>
            {stats.stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            <div><dt>Total FPTS</dt><dd>{fmt(s.pts, 1)}</dd></div>
          </dl>
          <p className="player-footnote">Cricsheet match stats · all appearances. Fantasy FPTS include batting, bowling, fielding and appearance points.</p>
        </section>

        <section className="player-section">
          <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
            <h3 className="up dim">FPTS projections <span className="player-experimental">Rough estimates</span></h3>
            <div className="row" style={{ gap: 8 }}>
              <button aria-label="Previous projection week" className="btn xs ghost" disabled={displayWeek <= 1} onClick={() => setSelectedWeek(displayWeek - 1)}><ChevronLeft size={17} /></button>
              <div className="player-week-title">{weekLabel(displayWeek)}<small>{displayGw ? `${fmtDate(displayGw.start)} – ${fmtDate(displayGw.end)}` : ''}</small></div>
              <button aria-label="Next projection week" className="btn xs ghost" disabled={displayWeek >= d.gameweeks.length} onClick={() => setSelectedWeek(displayWeek + 1)}><ChevronRight size={17} /></button>
            </div>
          </div>
          <div className="player-projection-grid">
            {displayMis.length ? displayMis.map((mi) => {
              const m = d.matches[mi], done = mi < played, g = p.games.get(mi)
              const forecast = matchProjection(d, p, mi, Math.min(played, mi))
              return <article className="player-projection" key={mi}>
                <div className="row" style={{ justifyContent: 'center', gap: 6 }}><span>vs</span><TeamChip code={forecast.opponent} /></div>
                <div className="player-projection-box">
                  <div><span>PROJ</span><strong>{fmt(forecast.total, 1)}</strong></div>
                  <small>{fmtDate(m.raw.date)} · {m.raw.time}</small>
                  <details className="fixture-forecast-details"><summary>Why this forecast?</summary>
                    <div><span>Player baseline</span><strong>{fmt(forecast.base * forecast.chance, 2)}</strong></div>
                    {forecast.components.map((c) => <div key={c.label}><span>{c.label}</span><strong>{c.points >= 0 ? '+' : ''}{fmt(c.points, 2)}</strong></div>)}
                    <p>{Math.round(forecast.chance * 100)}% estimated playing probability, already included. {forecast.venueSamples} earlier role appearances at this venue; {forecast.opponentSamples} against this opponent. Small samples are discounted.</p>
                  </details>
                  <div className={done ? 'turf' : 'dim'}><span>FPTS</span><strong>{done ? g ? fmt(g.pts.total, 1) : 'DNP' : '—'}</strong></div>
                </div>
              </article>
            }) : <p className="dim">No match scheduled this week.</p>}
          </div>
          <details className="player-model"><summary>How these projections work</summary><p>Player history and estimated availability, with fixture-specific adjustments for venue, opponent results against the same role, recent form and batting/bowling workload. These rough estimates use fixed, conservative weights for the historical signals. Small samples are discounted, and the combined change is capped at ±25%. Upcoming opponents’ XIs, injuries and individual batter–bowler matchups are not known. This is a rough matchup estimate, not a calibrated prediction. It is not proven more accurate than the simpler player-average model. These are estimates, not guaranteed scores. Identical estimates can still occur when evidence is similar or missing.</p><p>Past projections are reconstructed using only results available before that match; future-week forecasts update as the replay progresses. Only your selected match counts toward the weekly team score. No location is inferred from fixture order, so opponents are shown as “vs”.</p></details>
        </section>

        <section className="player-section">
          <h3 className="up dim">Player updates</h3>
          <p className="player-footnote">Automated summaries · Cricsheet match data · replay, not live news.</p>
          <div className="player-scout">
            <div className="player-report-meta">Scouting profile · {profile.sampleSize} known appearances{profile.limited ? ' · Limited history' : ''}</div>
            <strong>{profile.identity}</strong>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}><span className="chip turf">{advice.recommendation}</span>{advice.tier && <span className="chip">{advice.tier}</span>}</div>
            <p>{advice.opinion}</p>
            <details><summary>What this is based on</summary><p>{advice.explanation}</p><ul>{profile.evidence.length ? profile.evidence.map((fact) => <li key={fact}>{fact}</li>) : <li>No earlier appearances available.</li>}</ul><p>Usage is inferred from completed deliveries, not an official position label. First ball faced does not establish exact batting order; bowling phases refer to overs 1–6 and 17–20. No upcoming XI, injury or selection news is inferred.</p></details>
          </div>
          <div className="player-reports">{reports.map((r) => <article className="player-report" key={r.key}>
            <div className="player-report-meta">{r.kind} · {fmtDate(r.date)} · {r.kind === 'Preview' ? 'As of the replay clock' : 'Final scorecard'}</div>
            <h4>{r.title}</h4><p>{r.summary}</p>
            <div className="player-report-analysis"><strong>Fantasy outlook: </strong>{r.analysis}</div>
            {r.kind === 'Recap' && <button className="btn xs ghost" onClick={() => { close(); openMatch(r.mi) }}>Source scorecard →</button>}
          </article>)}</div>
        </section>

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
                <th className="n">FPTS</th>
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
