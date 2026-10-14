import { FastForward, Pause, Play, SkipForward } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { rosteredBy, userMatchup } from '../../engine/league'
import { fmt, oversStr } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { FTeamAvatar, Modal, PlayerAvatar, TeamChip } from '../common'
import { fmtDate } from '../format'
import { fantasyTracker, isNextMatch, liveMatchupScore, REPLAY_SPEEDS, replayState, resultToast } from '../replay'
import { ballEvents, runRate } from '../scorecard'
import { useShallow } from 'zustand/react/shallow'

export function LiveMatch({ mi }: { mi: number }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { openLive, simMatch, notify, openPlayer } = useApp(useShallow((s) => ({ openLive: s.openLive, simMatch: s.simMatch, notify: s.notify, openPlayer: s.openPlayer })))
  const m = d.matches[mi]
  const isNext = isNextMatch(league, mi)
  const evs = useMemo(() => ballEvents(d, m.raw), [d, m])
  const total = evs.length
  const [k, setK] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const finished = k >= total

  useEffect(() => {
    if (!playing || finished) return
    const t = setTimeout(() => setK((x) => Math.min(total, x + 1)), REPLAY_SPEEDS[speed].ms)
    return () => clearTimeout(t)
  }, [k, playing, speed, finished, total])

  const close = () => {
    if (isNext) {
      simMatch()
      notify(resultToast(m), 'info')
    }
    openLive(null)
  }

  const { lines, inns, cur, last, over: overBalls, batters: curBatters, chase } = useMemo(() => replayState(d, m, evs, k), [d, m, evs, k])
  const owned = useMemo(() => rosteredBy(league), [league])

  // fantasy: rostered players in this match
  const live = fantasyTracker(d, league, m, lines, owned)

  // user matchup live
  const um = isNext ? userMatchup(league, m.gw) : undefined
  const liveScore = (teamId: number) => liveMatchupScore(d, league, teamId, m, lines)

  return (
    <Modal
      size="lg"
      onClose={close}
      header={
        <div className="row" style={{ gap: 12 }}>
          {finished ? <span className="chip">FULL TIME</span> : <span className="chip live">LIVE</span>}
          <div>
            <div style={{ fontWeight: 700 }}>
              {d.teams[m.teams[0]].name} v {d.teams[m.teams[1]].name}
            </div>
            <div className="dim" style={{ fontSize: 12 }}>
              Match {m.raw.num} · {fmtDate(m.raw.date)} · {m.raw.time} IST · {m.raw.venue}
              {!isNext && ' · replay'}
            </div>
          </div>
          <div className="grow" />
          <div className="seg">
            {REPLAY_SPEEDS.map((s, i) => (
              <button key={s.label} className={speed === i ? 'on' : ''} onClick={() => setSpeed(i)}>
                {s.label}
              </button>
            ))}
          </div>
          <button className="btn icon" onClick={() => setPlaying(!playing)} disabled={finished}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="btn" onClick={() => setK(total)} disabled={finished}>
            <SkipForward size={15} /> End
          </button>
        </div>
      }
    >
      <div className="modal-b">
        {um && (
          <div className="scoreboard" style={{ padding: '14px 18px', marginBottom: 16 }}>
            {[um.a, um.b].map((tid, i) => {
              const t = league.teams[tid]
              const s = liveScore(tid)
              const o = liveScore(i === 0 ? um.b : um.a)
              return (
                <div key={tid} className={`sb-team ${i === 1 ? 'r' : ''}`} style={i === 1 ? { gridColumn: 3 } : undefined}>
                  <FTeamAvatar t={t} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{t.isUser ? 'You' : t.name}</div>
                    <div key={fmt(s)} className={`sb-score flash ${s > o ? 'lead' : ''}`} style={{ fontSize: 32 }}>
                      {fmt(s)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="sb-mid" style={{ gridColumn: 2, gridRow: 1, minWidth: 120 }}>
              <span className="up dim">Your matchup</span>
              <span className="chip">{um.label ?? `Week ${um.week}`}</span>
            </div>
          </div>
        )}

        <div className="live-wrap">
          <div className="col" style={{ gap: 14 }}>
            <div className="card pad">
              <div className="lb-score">
                {m.teams.map((t, i) => {
                  const inn = inns.find((x) => x.team === t)
                  return (
                    <div key={t} className={`lb-team ${i === 1 ? 'r' : ''}`} style={i === 1 ? { gridColumn: 3 } : undefined}>
                      <div className="row" style={{ gap: 6 }}>
                        <TeamChip code={t} />
                        {cur && cur.team === t && !finished && <span className="chip live" style={{ height: 18 }}>BAT</span>}
                      </div>
                      <div className="lb-runs" style={{ color: inn ? undefined : 'var(--dim)' }}>
                        {inn ? (
                          <>
                            {inn.runs}
                            <small>/{inn.wkts}</small>
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div className="dim" style={{ fontSize: 12 }}>{inn ? `${oversStr(inn.balls)} ov` : 'Yet to bat'}</div>
                    </div>
                  )
                })}
                <div className="center dim" style={{ gridColumn: 2, gridRow: 1, fontSize: 12 }}>
                  {chase && !finished ? (
                    <>
                      Need <b className="accent">{chase.need}</b>
                      <br />
                      off {chase.balls}
                    </>
                  ) : finished ? (
                    <b className="accent" style={{ fontSize: 13 }}>{m.raw.result}</b>
                  ) : cur ? (
                    <>CRR {runRate(cur.runs, cur.balls)}</>
                  ) : null}
                </div>
              </div>
              <div className="progress" style={{ marginTop: 14 }}>
                <i style={{ width: `${(k / total) * 100}%`, background: 'var(--live)' }} />
              </div>
              <div className="row" style={{ marginTop: 14, gap: 8, minHeight: 30 }}>
                <span className="up dim" style={{ width: 56 }}>This over</span>
                {overBalls.map((e, i) => (
                  <span key={`${k}-${i}`} className={`ball ${e.cls} ${i === overBalls.length - 1 ? 'new' : ''}`}>
                    {e.short}
                  </span>
                ))}
              </div>
              {cur && !finished && (
                <div className="row wrap" style={{ marginTop: 12, gap: 16, fontSize: 13 }}>
                  {curBatters.map((p) => {
                    const l = lines.get(p)
                    return (
                      <span key={p}>
                        🏏 <b>{d.players[p].name}</b>{' '}
                        <span className="num">
                          {l?.r ?? 0} ({l?.b ?? 0})
                        </span>
                      </span>
                    )
                  })}
                  {last && (
                    <span className="muted">
                      ● {d.players[last.bowler].name}{' '}
                      <span className="num">
                        {(() => {
                          const l = lines.get(last.bowler)
                          return l ? `${oversStr(l.bb)}-${l.rc}-${l.w}` : ''
                        })()}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-h">
                <h3>Ball by ball</h3>
              </div>
              <div className="comm" style={{ padding: 8 }}>
                {evs
                  .slice(Math.max(0, k - 40), k)
                  .reverse()
                  .map((e, i) => (
                    <div key={k - i} className={`comm-line ${e.cls === 'bw' ? 'w' : e.cls === 'b4' || e.cls === 'b6' ? 'b' : ''}`}>
                      <span className="num dim">{e.label}</span>
                      <span className={`ball ${e.cls}`} style={{ width: 26, height: 26, fontSize: 11 }}>
                        {e.short}
                      </span>
                      <span className="ellipsis">{e.text}</span>
                    </div>
                  ))}
                {k === 0 && <div className="empty">First ball coming up…</div>}
              </div>
            </div>
          </div>

          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-h">
              <h3>Fantasy tracker</h3>
              <span className="dim" style={{ fontSize: 12, marginLeft: 'auto' }}>Rostered players in this match</span>
            </div>
            <div style={{ padding: 8 }}>
              {live.map(({ p, pts, owner, starter, counts }) => {
                const pl = d.players[p]
                const t = league.teams[owner]
                return (
                  <div key={p} className={`fant-row ${owner === 0 ? 'mine' : ''} ${starter && !counts ? 'nc' : ''}`}>
                    <div className="pcell" onClick={() => openPlayer(p)}>
                      <PlayerAvatar p={pl} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div className="pname ellipsis" style={{ fontSize: 13 }}>{pl.name}</div>
                        <div className="pmeta" style={{ marginTop: 1 }}>
                          <TeamChip code={pl.team} />
                          <span className="ellipsis">{owner === 0 ? 'You' : t.name}</span>
                          {!starter ? <span className="dim">· bench</span> : !counts && <span className="dim" title="Only one match per player counts each week, and it isn't this one">· not counted</span>}
                        </div>
                      </div>
                    </div>
                    <FTeamAvatar t={t} size="sm" />
                    <div key={fmt(pts)} className={`pts flash ${pts >= 25 ? 'accent' : ''}`}>
                      {fmt(pts)}
                    </div>
                  </div>
                )
              })}
              {!live.length && <div className="empty" style={{ fontSize: 13 }}>No rostered players in this match.</div>}
            </div>
          </div>
        </div>
        {finished && (
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn primary" onClick={close}>
              <FastForward size={15} /> {isNext ? 'Continue season' : 'Close replay'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
