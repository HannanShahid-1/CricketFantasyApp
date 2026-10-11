import { Crown, Lock, Sparkles, Trophy } from 'lucide-react'
import { useState } from 'react'
import { weekProjection } from '../../engine/data'
import {
  currentWeek, isLocked, LAST_WEEK, matchupsForWeek, matchupWinner, REG_WEEKS, SLOTS, standings, userMatchup, winProbability,
  type Matchup,
} from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { FTeamAvatar, MatchBalls, PlayerAvatar, RoleTag, TeamChip, weekLabel } from '../common'
import { liveTeamScore, teamStarters, weekRecap, weekSummary } from '../helpers'

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
  const { viewWeek, setViewWeek, setTab } = useApp()
  const cur = currentWeek(d, league)
  const week = viewWeek ?? cur
  const [picked, setPicked] = useState<{ week: number; m: Matchup } | null>(null)
  const weekMs = matchupsForWeek(league, week)
  const mine = userMatchup(league, week)
  const m = picked && picked.week === week ? picked.m : mine ?? weekMs[0]
  const recap = weekRecap(d, league, week)

  return (
    <>
      <div className="page-title">
        <h1>{weekLabel(week)}</h1>
        <div className="sub">
          {fmtRange(d, week)} · {d.gameweeks[week - 1].mis.length} IPL matches
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <WeekPills week={week} onChange={(w) => { setViewWeek(w); setPicked(null) }} />
      </div>

      {league.champion !== null && week === LAST_WEEK && <ChampionBanner />}

      {!m ? (
        <PlayoffPlaceholder onGo={() => setTab('playoffs')} />
      ) : (
        <div className="split">
          <div className="col" style={{ gap: 16 }}>
            <MatchupCard m={m} />
          </div>
          <div className="col" style={{ gap: 16 }}>
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
            <div className="card">
              <div className="card-h">
                <h3>League scoreboard</h3>
                <span className="dim" style={{ marginLeft: 'auto', fontSize: 12 }}>{league.results[week] ? 'Final' : week === cur ? 'Live' : 'Upcoming'}</span>
              </div>
              <div className="col" style={{ padding: 12, gap: 8 }}>
                {weekMs.map((x, i) => (
                  <MiniMatchup key={i} m={x} active={x === m} onClick={() => setPicked({ week, m: x })} />
                ))}
                {!weekMs.length && <div className="dim" style={{ padding: 10, fontSize: 13 }}>Matchups set after Week {week - 1}.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function fmtRange(d: ReturnType<typeof getData>, w: number) {
  const g = d.gameweeks[w - 1]
  const f = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${f(g.start)} – ${f(g.end)}`
}

function MatchupCard({ m: raw }: { m: Matchup }) {
  // keep the user's team on the left
  const m = raw.b === 0 ? { ...raw, a: raw.b, b: raw.a } : raw
  const d = getData()
  const league = useApp((s) => s.league)!
  const openPlayer = useApp((s) => s.openPlayer)
  const [showBench, setShowBench] = useState(false)
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
  const stA = teamStarters(league, m.a, week)
  const stB = teamStarters(league, m.b, week)
  const played = final ? Infinity : league.played
  const rec = (id: number) => {
    const r = standings(league).find((x) => x.teamId === id)!
    return `${r.w + r.mw}-${r.l + r.ml}${r.t ? `-${r.t}` : ''}`
  }

  const benchOf = (teamId: number, st: (number | null)[]) => league.teams[teamId].roster.filter((p) => !st.includes(p))

  return (
    <>
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

      <div className="card">
        <div className="mrows">
          {SLOTS.map((s, i) => (
            <div className="mrow" key={i}>
              <Cell pid={stA[i]} week={week} played={played} onOpen={openPlayer} side="l" />
              <div className="center">
                <span className={`slot ${s}`}>{s}</span>
              </div>
              <Cell pid={stB[i]} week={week} played={played} onOpen={openPlayer} side="r" />
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
                <Cell pid={benchOf(m.a, stA)[i] ?? null} week={week} played={played} onOpen={openPlayer} side="l" bench />
                <div className="center">
                  <span className="slot BN">BN</span>
                </div>
                <Cell pid={benchOf(m.b, stB)[i] ?? null} week={week} played={played} onOpen={openPlayer} side="r" bench />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function Cell({ pid, week, played, onOpen, side, bench }: { pid: number | null; week: number; played: number; onOpen: (p: number) => void; side: 'l' | 'r'; bench?: boolean }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  if (pid === null || pid === undefined) return <div className={`mcell ${side === 'r' ? 'r' : ''}`}><span className="empty-slot">Empty</span></div>
  const p = d.players[pid]
  const wp = weekProjection(d, p, week, played)
  const summary = weekSummary(d, p, week, played)
  const locked = !league.results[week] && week === currentWeek(d, league) && isLocked(d, league, pid, week)
  return (
    <div className={`mcell ${side === 'r' ? 'r' : ''}`} onClick={() => onOpen(pid)} style={bench ? { opacity: 0.7 } : undefined}>
      <PlayerAvatar p={p} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="pname ellipsis">{p.name}</div>
        <div className="pmeta">
          <TeamChip code={p.team} />
          <RoleTag p={p} />
          <MatchBalls d={d} p={p} gw={week} played={played} />
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

function MiniMatchup({ m, active, onClick }: { m: Matchup; active: boolean; onClick: () => void }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const sa = liveTeamScore(d, league, m.a, m.week)
  const sb = liveTeamScore(d, league, m.b, m.week)
  const final = !!league.results[m.week]
  const row = (id: number, s: { score: number; proj: number }, o: { score: number }) => {
    const t = league.teams[id]
    const win = final && s.score > o.score
    return (
      <>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <FTeamAvatar t={t} size="sm" />
          <span className="ellipsis" style={{ fontWeight: t.isUser ? 800 : 600, fontSize: 13, color: final && !win ? 'var(--muted)' : undefined }}>{t.isUser ? `${t.name} (you)` : t.name}</span>
        </div>
        <div className="num right" style={{ fontWeight: 700, color: win ? 'var(--turf)' : final ? 'var(--muted)' : undefined }}>
          {fmt(s.score)}
        </div>
      </>
    )
  }
  return (
    <div className="mini-matchup" style={active ? { borderColor: 'rgba(196,239,106,.45)' } : undefined} onClick={onClick}>
      {m.label && <div className="up dim" style={{ gridColumn: '1 / -1', fontSize: 9.5 }}>{m.label}</div>}
      {row(m.a, sa, sb)}
      {row(m.b, sb, sa)}
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
