import { Trophy } from 'lucide-react'
import { LAST_WEEK } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { playoffBracket, type BracketGame, type BracketSlot } from '../bracket'
import { FTeamAvatar } from '../common'
import { useShallow } from 'zustand/react/shallow'

export function PlayoffsView() {
  const league = useApp((s) => s.league)!
  const { seeded, weeksPlayed, championship, consolation } = playoffBracket(getData(), league)
  const [sf1, sf2, fin, third] = championship

  return (
    <>
      <div className="page-title">
        <h1>Playoffs</h1>
        <div className="sub">
          {seeded ? 'Semifinals in Week 7 · Championship in Week 8' : `Projected — if the season ended today (after Week ${weeksPlayed})`}
        </div>
        {!seeded && <span className="chip gold" style={{ marginBottom: 6 }}>PROJECTED</span>}
      </div>

      {league.champion !== null && (
        <div className="trophy-card" style={{ marginBottom: 18 }}>
          <Trophy size={44} className="gold" />
          <div className="up gold">Champion</div>
          <div className="row" style={{ gap: 12 }}>
            <FTeamAvatar t={league.teams[league.champion]} size="lg" />
            <div className="display" style={{ fontSize: 30, fontWeight: 700 }}>{league.teams[league.champion].name}</div>
          </div>
        </div>
      )}

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="up dim" style={{ marginBottom: 14 }}>Championship bracket</div>
        <div className="bracket">
          <div className="bk-col">
            <BkMatch g={sf1} />
            <BkMatch g={sf2} />
          </div>
          <div className="bk-line" />
          <div className="bk-col">
            <BkMatch g={fin} />
          </div>
          <div />
          <div className="bk-col">
            <BkMatch g={third} />
          </div>
        </div>
      </div>

      <div className="card pad">
        <div className="up dim" style={{ marginBottom: 14 }}>Consolation bracket</div>
        <div className="grid3">
          {consolation.map((g) => <BkMatch key={g.label} g={g} />)}
        </div>
      </div>
    </>
  )
}

function BkMatch({ g }: { g: BracketGame }) {
  const league = useApp((s) => s.league)!
  const { setTab, setViewWeek } = useApp(useShallow((s) => ({ setTab: s.setTab, setViewWeek: s.setViewWeek })))
  const gold = g.decidesTitle
  const row = (s: BracketSlot) => {
    const t = s.teamId !== null ? league.teams[s.teamId] : null
    const cls = g.winner === null ? '' : g.winner === s.teamId ? 'won' : 'lost'
    return (
      <div className={`bk-team ${cls}`}>
        <span className="bk-seed">{t ? s.seed : ''}</span>
        {t ? <FTeamAvatar t={t} size="sm" /> : <div className="fteam-av sm" style={{ ['--c' as string]: 'var(--line-2)' }} />}
        <span className="grow ellipsis" style={{ fontWeight: t?.isUser ? 800 : 600, color: t ? undefined : 'var(--dim)' }}>
          {t ? (t.isUser ? `${t.name} (you)` : t.name) : s.placeholder}
        </span>
        <span className="num" style={{ fontWeight: 700 }}>{s.score !== null ? fmt(s.score, 1) : ''}</span>
      </div>
    )
  }
  return (
    <div
      className="bk-match"
      style={{ cursor: g.m ? 'pointer' : undefined, borderColor: gold ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : undefined }}
      onClick={() => {
        if (!g.m) return
        setViewWeek(g.week)
        setTab('matchup')
      }}
    >
      <div className="bk-label" style={gold ? { color: 'var(--gold)' } : undefined}>{g.label} · Week {g.week}{g.week === LAST_WEEK && g.status === 'live' ? ' · live' : ''}</div>
      {row(g.a)}
      {row(g.b)}
    </div>
  )
}
