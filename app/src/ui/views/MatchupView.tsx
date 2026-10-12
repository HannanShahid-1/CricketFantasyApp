import { ChevronLeft, ChevronRight, Crown, Lock, Maximize2, Sparkles, Trophy } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { LEAGUE_CHANNEL } from '../../engine/chat'
import {
  currentWeek, LAST_WEEK, matchupsForWeek, matchupWinner, playerWeek, REG_WEEKS, slotLocked, SLOTS, standings, winProbability,
  type Matchup,
} from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, ME, useApp } from '../../store'
import { FTeamAvatar, MatchBalls, PlayerAvatar, RoleTag, TeamChip } from '../common'
import { weekLabel } from '../format'
import { liveTeamScore, teamStarters, weekRecap, weekSummary } from '../helpers'
import { Conversation } from './ChatView'
import { useShallow } from 'zustand/react/shallow'

export function WeekPills({ week, onChange }: { week: number; onChange: (w: number) => void }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const cur = currentWeek(d, league)
  return (
    <div className="overs">
      {Array.from({ length: LAST_WEEK }, (_, i) => i + 1).map((w) => (
        <button key={w} className={`over-pill ${w === week ? 'on' : ''} ${w === cur && league.phase === 'season' ? 'cur' : ''}`} onClick={() => onChange(w)}>
          {w <= REG_WEEKS ? `W${w}` : w === 7 ? 'SEMIS' : 'FINAL'}
          {league.results[w] ? <span className="tag">✓</span> : w === cur && league.phase === 'season' ? <span className="tag">LIVE</span> : null}
        </button>
      ))}
    </div>
  )
}

export function MatchupView() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { viewWeek, setViewWeek, setTab } = useApp(useShallow((s) => ({ viewWeek: s.viewWeek, setViewWeek: s.setViewWeek, setTab: s.setTab })))
  const cur = currentWeek(d, league)
  const week = viewWeek ?? cur
  const [picked, setPicked] = useState({ week, i: 0 })
  // your matchup first, then the rest of the league
  const weekMs = matchupsForWeek(league, week).sort((a, b) => Number(b.a === ME || b.b === ME) - Number(a.a === ME || a.b === ME))
  const index = picked.week === week ? Math.min(picked.i, Math.max(0, weekMs.length - 1)) : 0
  const m = weekMs[index]
  const recap = weekRecap(d, league, week)

  return (
    <>
      <div className="split home-split">
        <div className="col" style={{ gap: 16 }}>
          <div className="page-title">
            <h1>{weekLabel(week)}</h1>
            <div className="sub">
              {fmtRange(d, week)} · {d.gameweeks[week - 1].mis.length} IPL matches
            </div>
          </div>
          <div>
            <WeekPills week={week} onChange={(w) => { setViewWeek(w); setPicked({ week: w, i: 0 }) }} />
          </div>

          {league.champion !== null && week === LAST_WEEK && <ChampionBanner />}
          {!m ? (
            <PlayoffPlaceholder onGo={() => setTab('playoffs')} />
          ) : (
            <>
              <MatchupCarousel key={week} ms={weekMs} index={index} onIndex={(i) => setPicked({ week, i })} />
              <Lineups m={m} />
            </>
          )}
          {recap && (
            <div className="recap">
              <div className="row" style={{ gap: 8 }}>
                <Sparkles size={16} style={{ color: 'var(--ar)' }} />
                <b className="display">Week recap</b>
                <span className="chip" style={{ marginLeft: 'auto' }}>AI · placeholder</span>
              </div>
              {recap.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
          )}
        </div>
        <div className="col home-side">
          <LeagueChatDock />
        </div>
      </div>
    </>
  )
}

function LeagueChatDock() {
  const openChat = useApp((s) => s.openChat)
  return (
    <div className="chat-dock">
      <Conversation
        channel={LEAGUE_CHANNEL}
        compact
        action={
          <button className="btn sm icon ghost" title="Open in Chat" aria-label="Open in Chat" onClick={() => openChat(LEAGUE_CHANNEL)}>
            <Maximize2 size={14} />
          </button>
        }
      />
    </div>
  )
}

/** Swipe (or use the arrows/dots) through every matchup of the week; the lineups below follow. */
function MatchupCarousel({ ms, index, onIndex }: { ms: Matchup[]; index: number; onIndex: (i: number) => void }) {
  const league = useApp((s) => s.league)!
  const track = useRef<HTMLDivElement>(null)
  const go = (i: number) => {
    const el = track.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }
  // open on the remembered matchup; after that the scroll position drives the index
  const start = useRef(index)
  useLayoutEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = start.current * el.clientWidth
  }, [])
  const label = (m: Matchup) => {
    if (m.a === ME || m.b === ME) return 'Your matchup'
    return m.label ?? `${league.teams[m.a].name} v ${league.teams[m.b].name}`
  }
  return (
    <div className="carousel">
      <div
        className="carousel-track"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget
          const i = Math.round(el.scrollLeft / el.clientWidth)
          if (i !== index && i >= 0 && i < ms.length) onIndex(i)
        }}
      >
        {ms.map((m, i) => (
          <div className="carousel-slide" key={i} aria-hidden={i !== index}>
            <Scoreboard m={m} />
          </div>
        ))}
      </div>
      {ms.length > 1 && (
        <div className="carousel-nav">
          <button className="btn sm icon" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous matchup">
            <ChevronLeft size={16} />
          </button>
          <div className="carousel-meta">
            <span className="carousel-label ellipsis">{label(ms[index])}</span>
            <div className="carousel-dots">
              {ms.map((m, i) => (
                <button key={i} className={i === index ? 'on' : ''} onClick={() => go(i)} aria-label={label(m)} title={label(m)} />
              ))}
            </div>
          </div>
          <button className="btn sm icon" disabled={index === ms.length - 1} onClick={() => go(index + 1)} aria-label="Next matchup">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function fmtRange(d: ReturnType<typeof getData>, w: number) {
  const g = d.gameweeks[w - 1]
  const f = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${f(g.start)} – ${f(g.end)}`
}

/** keep the user's team on the left */
const oriented = (m: Matchup): Matchup => (m.b === ME ? { ...m, a: m.b, b: m.a } : m)

function Scoreboard({ m: raw }: { m: Matchup }) {
  const m = oriented(raw)
  const d = getData()
  const league = useApp((s) => s.league)!
  const week = m.week
  const final = !!league.results[week]
  const cur = currentWeek(d, league)
  const live = !final && week === cur && league.played > d.gameweeks[week - 1].mis[0]
  const A = league.teams[m.a]
  const B = league.teams[m.b]
  const sa = liveTeamScore(d, league, m.a, week)
  const sb = liveTeamScore(d, league, m.b, week)
  const res = league.results[week]
  if (res) {
    sa.proj = res.proj[m.a]
    sb.proj = res.proj[m.b]
  }
  const mis = d.gameweeks[week - 1].mis
  const remainingShare = final ? 0 : mis.filter((mi) => mi >= league.played).length / mis.length
  const pA = final ? (sa.score > sb.score ? 1 : sa.score < sb.score ? 0 : 0.5) : winProbability(sa.proj, sb.proj, sa.score, sb.score, remainingShare)
  const winner = final ? matchupWinner(league, m) : null
  const rec = (id: number) => {
    const r = standings(league).find((x) => x.teamId === id)!
    return `${r.w + r.mw}-${r.l + r.ml}${r.t ? `-${r.t}` : ''}`
  }

  return (
    <div className="scoreboard">
        <div className="sb-team">
          <FTeamAvatar t={A} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div className="sb-name ellipsis">{A.name}</div>
            <div className="dim" style={{ fontSize: 12 }}>
              {A.isUser ? 'You' : A.owner} · {rec(m.a)}
            </div>
            <div className={`sb-score ${sa.score > sb.score ? 'lead' : ''}`} style={{ marginTop: 8 }}>
              {fmt(sa.score)}
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>Proj {fmt(sa.proj, 1)}</div>
          </div>
        </div>
        <div className="sb-mid">
          {m.label && <span className="chip gold">{m.label}</span>}
          {final ? <span className="chip">FINAL</span> : live ? <span className="chip live">LIVE</span> : <span className="chip">UPCOMING</span>}
          <div className="wp-bar">
            <i style={{ width: `${pA * 100}%`, background: A.color }} />
            <i style={{ width: `${(1 - pA) * 100}%`, background: B.color }} />
          </div>
          <div className="row" style={{ gap: 18, fontSize: 12 }}>
            <span className="num">{Math.round(pA * 100)}%</span>
            <span className="dim up" style={{ fontSize: 9.5 }}>Win prob</span>
            <span className="num">{Math.round((1 - pA) * 100)}%</span>
          </div>
          {winner !== null && (
            <div className="row gold" style={{ gap: 6, fontSize: 12, fontWeight: 700 }}>
              <Crown size={14} /> {league.teams[winner].isUser ? 'You win!' : `${league.teams[winner].name} win`}
            </div>
          )}
        </div>
        <div className="sb-team r">
          <FTeamAvatar t={B} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div className="sb-name ellipsis">{B.name}</div>
            <div className="dim" style={{ fontSize: 12 }}>
              {B.isUser ? 'You' : B.owner} · {rec(m.b)}
            </div>
            <div className={`sb-score ${sb.score > sa.score ? 'lead' : ''}`} style={{ marginTop: 8 }}>
              {fmt(sb.score)}
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>Proj {fmt(sb.proj, 1)}</div>
          </div>
        </div>
    </div>
  )
}

function Lineups({ m: raw }: { m: Matchup }) {
  const m = oriented(raw)
  const league = useApp((s) => s.league)!
  const openPlayer = useApp((s) => s.openPlayer)
  const [showBench, setShowBench] = useState(false)
  const week = m.week
  const final = !!league.results[week]
  const stA = teamStarters(league, m.a, week)
  const stB = teamStarters(league, m.b, week)
  const played = final ? Infinity : league.played
  const benchOf = (teamId: number, st: (number | null)[]) => league.teams[teamId].roster.filter((p) => !st.includes(p))

  return (
    <>
      <div className="card">
        <div className="mrows">
          {SLOTS.map((s, i) => (
            <div className="mrow" key={i}>
              <Cell teamId={m.a} pid={stA[i]} week={week} played={played} onOpen={openPlayer} side="l" />
              <div className="center">
                <span className={`slot ${s}`}>{s}</span>
              </div>
              <Cell teamId={m.b} pid={stB[i]} week={week} played={played} onOpen={openPlayer} side="r" />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <button className="card-h btn ghost" style={{ width: '100%', borderRadius: 'var(--r-lg)', height: 'auto', justifyContent: 'flex-start' }} onClick={() => setShowBench(!showBench)}>
          <h3>Bench</h3>
          <span className="dim" style={{ fontSize: 12, fontWeight: 500 }}>Bench points don't count · {showBench ? 'hide' : 'show'}</span>
        </button>
        {showBench && (
          <div className="mrows">
            {Array.from({ length: Math.max(benchOf(m.a, stA).length, benchOf(m.b, stB).length) }, (_, i) => (
              <div className="mrow" key={i}>
                <Cell teamId={m.a} pid={benchOf(m.a, stA)[i] ?? null} week={week} played={played} onOpen={openPlayer} side="l" bench />
                <div className="center">
                  <span className="slot BN">BN</span>
                </div>
                <Cell teamId={m.b} pid={benchOf(m.b, stB)[i] ?? null} week={week} played={played} onOpen={openPlayer} side="r" bench />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function Cell({ teamId, pid, week, played, onOpen, side, bench }: { teamId: number; pid: number | null; week: number; played: number; onOpen: (p: number) => void; side: 'l' | 'r'; bench?: boolean }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  if (pid === null || pid === undefined) return <div className={`mcell ${side === 'r' ? 'r' : ''}`}><span className="empty-slot">Empty</span></div>
  const p = d.players[pid]
  const wp = playerWeek(d, league, teamId, pid, week, played)
  const summary = weekSummary(d, p, wp.mi, played)
  const locked = !league.results[week] && week === currentWeek(d, league) && slotLocked(d, league, teamId, pid, week)
  return (
    <div className={`mcell ${side === 'r' ? 'r' : ''}`} onClick={() => onOpen(pid)} style={bench ? { opacity: 0.7 } : undefined}>
      <PlayerAvatar p={p} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="pname ellipsis">{p.name}</div>
        <div className="pmeta">
          <TeamChip code={p.team} />
          <RoleTag p={p} />
          <MatchBalls d={d} p={p} gw={week} played={played} counted={wp.mi} />
          {locked && <Lock size={11} className="dim" />}
        </div>
        {summary && <div className="dim ellipsis" style={{ fontSize: 11, marginTop: 3 }}>{summary}</div>}
      </div>
      <div className={side === 'r' ? '' : 'right'}>
        <div className={`pts ${wp.banked >= 25 ? 'hot' : ''}`}>{fmt(wp.banked)}</div>
        <div className="proj">{wp.remaining > 0 ? `proj ${fmt(wp.total, 1)}` : ' '}</div>
      </div>
    </div>
  )
}

function PlayoffPlaceholder({ onGo }: { onGo: () => void }) {
  return (
    <div className="card pad center" style={{ padding: 40 }}>
      <Trophy size={36} className="gold" />
      <h2 className="display" style={{ margin: '12px 0 6px' }}>Playoff matchups aren't set yet</h2>
      <p className="muted" style={{ margin: '0 auto 16px', maxWidth: 440 }}>
        The top four after Week {REG_WEEKS} play the semifinals, then the championship in the final week. See how the bracket
        would look if the season ended today.
      </p>
      <button className="btn primary" onClick={onGo}>
        View projected bracket
      </button>
    </div>
  )
}

function ChampionBanner() {
  const league = useApp((s) => s.league)!
  const t = league.teams[league.champion!]
  return (
    <div className="trophy-card" style={{ marginBottom: 16 }}>
      <Trophy size={40} className="gold" />
      <div className="up gold">League champion</div>
      <div className="row" style={{ gap: 12 }}>
        <FTeamAvatar t={t} size="lg" />
        <div className="display" style={{ fontSize: 30, fontWeight: 700 }}>{t.name}</div>
      </div>
      <div className="muted">{t.isUser ? 'You won the league. Take a lap of honour. 🏆' : `${t.owner} lifts the trophy.`}</div>
    </div>
  )
}
