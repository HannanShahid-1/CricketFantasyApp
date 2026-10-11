import { Bot, LayoutGrid, List, Pause, Play, Search, Star, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ROLE_LABEL, type Player } from '../engine/data'
import { bestLineup, draftedSet, preseasonValue, SLOTS, teamOnClock } from '../engine/league'
import { fmt } from '../engine/scoring'
import type { Role } from '../engine/types'
import { getData, useApp } from '../store'
import { FTeamAvatar, Logo, PlayerAvatar, RoleTag, TeamChip } from './common'

const ROLE_FILTERS: { k: 'ALL' | Role | 'AR'; label: string }[] = [
  { k: 'ALL', label: 'All' },
  { k: 'WK', label: 'WK' },
  { k: 'BAT', label: 'BAT' },
  { k: 'AR', label: 'AR' },
  { k: 'BOWL', label: 'BOWL' },
]

export function DraftRoom() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { draftPick, draftAuto, toggleQueue, setDraftSpeed, openPlayer } = useApp()
  const [paused, setPaused] = useState(false)
  const [autoMe, setAutoMe] = useState(false)
  const [view, setView] = useState<'players' | 'board'>('players')
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]['k']>('ALL')
  const [team, setTeam] = useState('ALL')
  const [q, setQ] = useState('')
  const [sideTab, setSideTab] = useState<'roster' | 'queue'>('roster')

  const onClock = teamOnClock(league)
  const picks = league.draft.picks
  const n = league.numTeams
  const youOnClock = onClock === 0
  const taken = useMemo(() => draftedSet(league), [league])

  const ranked = useMemo(
    () => [...d.pool].sort((a, b) => preseasonValue(b) - preseasonValue(a)),
    [d],
  )
  const adp = useMemo(() => new Map(ranked.map((p, i) => [p.idx, i + 1])), [ranked])

  const pool = ranked.filter((p) => {
    if (taken.has(p.idx)) return false
    if (role === 'AR' ? !(p.role === 'ARB' || p.role === 'ARW') : role !== 'ALL' && p.role !== role) return false
    if (team !== 'ALL' && p.team !== team) return false
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  // AI picks
  useEffect(() => {
    if (paused || onClock === null || (onClock === 0 && !autoMe)) return
    const delay = league.draft.speed === 'instant' ? 30 : league.draft.speed === 'fast' ? 280 : 950
    const t = setTimeout(draftAuto, delay)
    return () => clearTimeout(t)
  }, [paused, onClock, picks.length, league.draft.speed, draftAuto, autoMe])

  // user pick timer
  const [left, setLeft] = useState(league.draft.timer)
  useEffect(() => setLeft(league.draft.timer), [picks.length, league.draft.timer])
  useEffect(() => {
    if (!youOnClock || !league.draft.timer || paused) return
    if (left <= 0) {
      draftAuto()
      return
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000)
    return () => clearTimeout(t)
  }, [youOnClock, left, paused, league.draft.timer, draftAuto])

  // upcoming slots for ticker
  const upcoming: { overall: number; teamId: number }[] = []
  for (let k = picks.length; k < Math.min(picks.length + 8, n * league.draft.rounds); k++) {
    const round = Math.floor(k / n)
    const i = k % n
    upcoming.push({ overall: k + 1, teamId: round % 2 === 0 ? league.draft.order[i] : league.draft.order[n - 1 - i] })
  }
  const yourNext = upcoming.findIndex((u) => u.teamId === 0)

  const tickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    tickerRef.current?.scrollTo({ left: tickerRef.current.scrollWidth, behavior: 'smooth' })
  }, [picks.length])

  const me = league.teams[0]
  const myLineup = bestLineup(d, league, me, 1).starters
  const bench = me.roster.filter((p) => !myLineup.includes(p))
  const round = Math.floor(picks.length / n) + 1
  const pickInRound = (picks.length % n) + 1
  const otcTeam = onClock !== null ? league.teams[onClock] : null

  return (
    <div className="draft">
      <div className="draft-top">
        <div className="row">
          <Logo size={30} />
          <div>
            <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>{league.name}</div>
            <div className="up dim">Draft room · Snake · {n} teams</div>
          </div>
        </div>
        <div className="row" style={{ gap: 6, marginLeft: 12 }}>
          <span className="chip turf">
            Round {Math.min(round, league.draft.rounds)} / {league.draft.rounds}
          </span>
          <span className="chip">Pick {pickInRound} · #{picks.length + 1} overall</span>
        </div>
        <div className="grow" />
        {otcTeam && (
          <div className={`otc ${youOnClock ? 'you' : ''}`}>
            <FTeamAvatar t={otcTeam} size="sm" />
            <div>
              <div className="up dim" style={{ fontSize: 9.5 }}>On the clock</div>
              <div style={{ fontWeight: 700 }}>{youOnClock ? 'You!' : otcTeam.name}</div>
            </div>
            {youOnClock && league.draft.timer > 0 && <TimerRing left={left} total={league.draft.timer} />}
            {!youOnClock && <Bot size={16} className="muted spin-ball" style={{ animationDuration: '2.4s' }} />}
          </div>
        )}
        {!youOnClock && yourNext >= 0 && <span className="muted" style={{ fontSize: 13 }}>Your pick in {yourNext}</span>}
        <div className="seg">
          {(['normal', 'fast', 'instant'] as const).map((s) => (
            <button key={s} className={league.draft.speed === s ? 'on' : ''} onClick={() => setDraftSpeed(s)}>
              {s === 'normal' ? '1×' : s === 'fast' ? '3×' : 'Max'}
            </button>
          ))}
        </div>
        <button className="btn icon" onClick={() => setPaused(!paused)} title={paused ? 'Resume' : 'Pause'}>
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button className="btn" disabled={!youOnClock} onClick={draftAuto} title="Let the AI make this pick for you">
          <Zap size={15} /> Autopick
        </button>
        <button className={`btn ${autoMe ? 'primary' : ''}`} onClick={() => setAutoMe(!autoMe)} title="Let the AI draft every remaining pick for you">
          <Bot size={15} /> Auto-draft {autoMe ? 'on' : 'off'}
        </button>
      </div>

      <div className="ticker" ref={tickerRef}>
        {picks.slice(-24).map((pk) => {
          const p = d.players[pk.player]
          const t = league.teams[pk.teamId]
          return (
            <div key={pk.overall} className={`tick ${pk.teamId === 0 ? 'you' : ''}`}>
              <PlayerAvatar p={p} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 650, fontSize: 12.5 }}>{p.name}</div>
                <div className="dim ellipsis" style={{ fontSize: 10.5 }}>
                  {pk.round}.{pk.pick} · {t.isUser ? 'You' : t.name}
                </div>
              </div>
            </div>
          )
        })}
        {upcoming.map((u) => {
          const t = league.teams[u.teamId]
          return (
            <div key={u.overall} className={`tick next ${u.teamId === 0 ? 'you' : ''}`}>
              <FTeamAvatar t={t} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 650, fontSize: 12.5 }}>{t.isUser ? 'Your pick' : t.name}</div>
                <div className="dim" style={{ fontSize: 10.5 }}>#{u.overall}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="draft-body">
        <div className="draft-pool">
          <div className="row wrap" style={{ padding: '12px 22px', borderBottom: '1px solid var(--line)' }}>
            <div className="seg">
              <button className={view === 'players' ? 'on' : ''} onClick={() => setView('players')}>
                <List size={13} style={{ verticalAlign: -2 }} /> Players
              </button>
              <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>
                <LayoutGrid size={13} style={{ verticalAlign: -2 }} /> Board
              </button>
            </div>
            {view === 'players' && (
              <>
                <div className="seg">
                  {ROLE_FILTERS.map((r) => (
                    <button key={r.k} className={role === r.k ? 'on' : ''} onClick={() => setRole(r.k)}>
                      {r.label}
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
                <div className="row grow" style={{ position: 'relative', minWidth: 160 }}>
                  <Search size={15} className="dim" style={{ position: 'absolute', left: 11 }} />
                  <input className="input grow" style={{ height: 34, paddingLeft: 32 }} placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </>
            )}
          </div>
          {view === 'players' ? (
            <div className="scroll-y" style={{ flex: 1 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th className="n">Rk</th>
                    <th>Player</th>
                    <th>Role</th>
                    <th className="n">{Number(d.raw.simSeason) - 1} GP</th>
                    <th className="n">Pts/G</th>
                    <th className="n">Proj</th>
                    <th />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pool.slice(0, 150).map((p) => (
                    <PoolRow
                      key={p.idx}
                      p={p}
                      rank={adp.get(p.idx)!}
                      queued={league.draft.queue.includes(p.idx)}
                      canPick={youOnClock}
                      onPick={() => draftPick(p.idx)}
                      onQueue={() => toggleQueue(p.idx)}
                      onOpen={() => openPlayer(p.idx)}
                    />
                  ))}
                </tbody>
              </table>
              {!pool.length && <div className="empty">No players match.</div>}
            </div>
          ) : (
            <DraftBoard />
          )}
        </div>

        <div className="draft-side">
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)' }}>
            <div className="seg">
              <button className={sideTab === 'roster' ? 'on' : ''} onClick={() => setSideTab('roster')}>
                My roster ({me.roster.length}/15)
              </button>
              <button className={sideTab === 'queue' ? 'on' : ''} onClick={() => setSideTab('queue')}>
                Queue ({league.draft.queue.length})
              </button>
            </div>
          </div>
          <div className="scroll-y" style={{ flex: 1, padding: '8px 10px' }}>
            {sideTab === 'roster' ? (
              <>
                {SLOTS.map((s, i) => {
                  const p = myLineup[i] !== null ? d.players[myLineup[i]!] : null
                  return (
                    <div key={i} className="row" style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>
                      <span className={`slot ${s}`}>{s}</span>
                      {p ? (
                        <div className="pcell grow" onClick={() => openPlayer(p.idx)}>
                          <PlayerAvatar p={p} size="sm" />
                          <div className="grow" style={{ minWidth: 0 }}>
                            <div className="pname ellipsis" style={{ fontSize: 13 }}>{p.name}</div>
                            <div className="pmeta" style={{ marginTop: 1 }}>
                              <TeamChip code={p.team} /> <RoleTag p={p} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="empty-slot">Empty</span>
                      )}
                    </div>
                  )
                })}
                <div className="up dim" style={{ padding: '12px 8px 4px' }}>Bench</div>
                {Array.from({ length: 4 }, (_, i) => {
                  const pid = bench[i]
                  const p = pid !== undefined ? d.players[pid] : null
                  return (
                    <div key={i} className="row" style={{ padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>
                      <span className="slot BN">BN</span>
                      {p ? (
                        <div className="pcell grow" onClick={() => openPlayer(p.idx)}>
                          <PlayerAvatar p={p} size="sm" />
                          <div className="pname ellipsis" style={{ fontSize: 13 }}>{p.name}</div>
                          <RoleTag p={p} />
                        </div>
                      ) : (
                        <span className="empty-slot">Empty</span>
                      )}
                    </div>
                  )
                })}
                {bench.length > 4 && <div className="dim" style={{ padding: 8, fontSize: 12 }}>+{bench.length - 4} more (lineup can't fit them yet)</div>}
              </>
            ) : league.draft.queue.length ? (
              league.draft.queue.map((pid, i) => {
                const p = d.players[pid]
                return (
                  <div key={pid} className="row" style={{ padding: '8px', borderBottom: '1px solid var(--line)' }}>
                    <span className="num dim" style={{ width: 18 }}>{i + 1}</span>
                    <div className="pcell grow" onClick={() => openPlayer(pid)}>
                      <PlayerAvatar p={p} size="sm" />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="pname ellipsis" style={{ fontSize: 13 }}>{p.name}</div>
                        <div className="pmeta" style={{ marginTop: 1 }}>
                          <TeamChip code={p.team} /> <RoleTag p={p} />
                        </div>
                      </div>
                    </div>
                    <button className="btn xs primary" disabled={!youOnClock} onClick={() => draftPick(pid)}>
                      Draft
                    </button>
                    <button className="btn xs ghost" onClick={() => toggleQueue(pid)}>✕</button>
                  </div>
                )
              })
            ) : (
              <div className="empty" style={{ fontSize: 13 }}>
                Star players to queue them. Autopick takes from your queue first.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PoolRow({ p, rank, queued, canPick, onPick, onQueue, onOpen }: { p: Player; rank: number; queued: boolean; canPick: boolean; onPick: () => void; onQueue: () => void; onOpen: () => void }) {
  return (
    <tr>
      <td className="n dim">{rank}</td>
      <td>
        <div className="pcell" onClick={onOpen}>
          <PlayerAvatar p={p} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="pname">{p.name}</div>
            <div className="pmeta" style={{ marginTop: 1 }}>
              <TeamChip code={p.team} />
            </div>
          </div>
        </div>
      </td>
      <td>
        <span className={`role ${p.role}`}>{ROLE_LABEL[p.role]}</span>
      </td>
      <td className="n">{p.s25.apps || '–'}</td>
      <td className="n">{p.s25.apps ? fmt(p.s25.avg, 1) : <span className="dim">new</span>}</td>
      <td className="n turf">{fmt(preseasonValue(p), 0)}</td>
      <td style={{ width: 34 }}>
        <button className="btn sm icon ghost" onClick={onQueue} title={queued ? 'Remove from queue' : 'Add to queue'}>
          <Star size={15} fill={queued ? 'var(--gold)' : 'none'} color={queued ? 'var(--gold)' : 'currentColor'} />
        </button>
      </td>
      <td style={{ width: 80 }}>
        <button className="btn sm primary" disabled={!canPick} onClick={onPick}>
          Draft
        </button>
      </td>
    </tr>
  )
}

function TimerRing({ left, total }: { left: number; total: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const frac = Math.max(0, left / total)
  return (
    <div className="timer-ring">
      <svg width="44" height="44">
        <circle cx="22" cy="22" r={r} stroke="rgba(239,230,204,0.12)" strokeWidth="4" fill="none" />
        <circle cx="22" cy="22" r={r} stroke={left <= 10 ? 'var(--ball)' : 'var(--turf)'} strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <b className={left <= 10 ? 'red' : ''}>{left}</b>
    </div>
  )
}

export function DraftBoard() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const openPlayer = useApp((s) => s.openPlayer)
  const n = league.numTeams
  const byCell = new Map(league.draft.picks.map((p) => [`${p.round}-${p.teamId}`, p]))
  return (
    <div className="board" style={{ gridTemplateColumns: `repeat(${n}, minmax(118px, 1fr))` }}>
      {league.draft.order.map((tid) => {
        const t = league.teams[tid]
        return (
          <div key={tid} className="row" style={{ gap: 8, padding: '4px 2px 8px', minWidth: 0 }}>
            <FTeamAvatar t={t} size="sm" />
            <div className="ellipsis" style={{ fontWeight: 700, fontSize: 12 }}>{t.isUser ? 'You' : t.name}</div>
          </div>
        )
      })}
      {Array.from({ length: league.draft.rounds }, (_, r) =>
        league.draft.order.map((tid) => {
          const pk = byCell.get(`${r + 1}-${tid}`)
          const p = pk ? d.players[pk.player] : null
          return (
            <div key={`${r}-${tid}`} className={`board-cell ${p?.role ?? ''} ${tid === 0 ? 'mine' : ''}`} style={{ cursor: p ? 'pointer' : undefined }} onClick={() => p && openPlayer(p.idx)}>
              {p ? (
                <>
                  <div className="dim" style={{ fontSize: 10 }}>
                    {pk!.round}.{pk!.pick} · <RoleTag p={p} />
                  </div>
                  <div className="ellipsis" style={{ fontWeight: 700 }}>{p.name}</div>
                  <div className="dim" style={{ fontSize: 10 }}>{p.team}</div>
                </>
              ) : (
                <div className="dim" style={{ fontSize: 10 }}>{r + 1}</div>
              )}
            </div>
          )
        }),
      )}
    </div>
  )
}
