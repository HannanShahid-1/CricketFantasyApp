import { Trophy } from 'lucide-react'
import { LAST_WEEK, REG_WEEKS, standings, type League, type Matchup } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { FTeamAvatar } from '../common'
import { liveTeamScore } from '../helpers'

type Slot = { teamId: number | null; placeholder?: string }

export function PlayoffsView() {
  const league = useApp((s) => s.league)!
  const seeded = league.schedule.some((m) => m.week === REG_WEEKS + 1)
  const seedOrder = seeded ? seedsFromSchedule(league) : standings(league).map((r) => r.teamId)
  const seedOf = (id: number | null) => (id === null ? null : seedOrder.indexOf(id) + 1)
  const find = (week: number, label: string) => league.schedule.find((m) => m.week === week && m.label === label)

  const sf1 = find(7, 'Semifinal 1')
  const sf2 = find(7, 'Semifinal 2')
  const fin = find(8, 'Championship')
  const third = find(8, '3rd place')

  const s = (i: number): Slot => ({ teamId: seedOrder[i] ?? null })

  return (
    <>
      <div className="page-title">
        <h1>Playoffs</h1>
        <div className="sub">
          {seeded ? 'Semifinals in Week 7 · Championship in Week 8' : `Projected — if the season ended today (after Week ${Object.keys(league.results).length || 0})`}
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
            <BkMatch label="Semifinal 1 · Week 7" m={sf1} a={s(0)} b={s(3)} seedOf={seedOf} />
            <BkMatch label="Semifinal 2 · Week 7" m={sf2} a={s(1)} b={s(2)} seedOf={seedOf} />
          </div>
          <div className="bk-line" />
          <div className="bk-col">
            <BkMatch
              label="Championship · Week 8"
              m={fin}
              a={{ teamId: fin?.a ?? null, placeholder: 'Winner SF1' }}
              b={{ teamId: fin?.b ?? null, placeholder: 'Winner SF2' }}
              seedOf={seedOf}
              gold
            />
          </div>
          <div />
          <div className="bk-col">
            <BkMatch
              label="3rd place · Week 8"
              m={third}
              a={{ teamId: third?.a ?? null, placeholder: 'Loser SF1' }}
              b={{ teamId: third?.b ?? null, placeholder: 'Loser SF2' }}
              seedOf={seedOf}
            />
          </div>
        </div>
      </div>

      <div className="card pad">
        <div className="up dim" style={{ marginBottom: 14 }}>Consolation bracket</div>
        <div className="grid3">
          <BkMatch label="Consolation 1 · Week 7" m={find(7, 'Consolation 1')} a={s(4)} b={s(7)} seedOf={seedOf} />
          <BkMatch label="Consolation 2 · Week 7" m={find(7, 'Consolation 2')} a={s(5)} b={s(6)} seedOf={seedOf} />
          <BkMatch label="5th place · Week 8" m={find(8, '5th place')} a={{ teamId: find(8, '5th place')?.a ?? null, placeholder: 'Winner C1' }} b={{ teamId: find(8, '5th place')?.b ?? null, placeholder: 'Winner C2' }} seedOf={seedOf} />
          {league.numTeams >= 10 && <BkMatch label="Toilet Bowl · Week 7" m={find(7, 'Toilet Bowl')} a={s(8)} b={s(9)} seedOf={seedOf} />}
          <BkMatch label="7th place · Week 8" m={find(8, '7th place')} a={{ teamId: find(8, '7th place')?.a ?? null, placeholder: 'Loser C1' }} b={{ teamId: find(8, '7th place')?.b ?? null, placeholder: 'Loser C2' }} seedOf={seedOf} />
        </div>
      </div>
    </>
  )
}

function seedsFromSchedule(l: League): number[] {
  // regular-season final standings are the seeds
  const st = standings({ ...l, results: Object.fromEntries(Object.entries(l.results).filter(([w]) => Number(w) <= REG_WEEKS)) })
  return st.map((r) => r.teamId)
}

function BkMatch({ label, m, a, b, seedOf, gold }: { label: string; m?: Matchup; a: Slot; b: Slot; seedOf: (id: number | null) => number | null; gold?: boolean }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { setTab, setViewWeek } = useApp()
  const res = m ? league.results[m.week] : undefined
  const started = m && (res || league.played > d.gameweeks[m.week - 1].mis[0])
  const score = (id: number | null) => (m && id !== null && started ? liveTeamScore(d, league, id, m.week).score : null)
  const sa = score(a.teamId)
  const sb = score(b.teamId)
  const winner = res && sa !== null && sb !== null ? (sa > sb ? a.teamId : sb > sa ? b.teamId : null) : null
  const row = (s: Slot, sc: number | null) => {
    const t = s.teamId !== null ? league.teams[s.teamId] : null
    const cls = winner === null ? '' : winner === s.teamId ? 'won' : 'lost'
    return (
      <div className={`bk-team ${cls}`}>
        <span className="bk-seed">{t ? seedOf(s.teamId) : ''}</span>
        {t ? <FTeamAvatar t={t} size="sm" /> : <div className="fteam-av sm" style={{ ['--c' as string]: 'rgba(239,230,204,.12)' }} />}
        <span className="grow ellipsis" style={{ fontWeight: t?.isUser ? 800 : 600, color: t ? undefined : 'var(--dim)' }}>
          {t ? (t.isUser ? `${t.name} (you)` : t.name) : s.placeholder}
        </span>
        <span className="num" style={{ fontWeight: 700 }}>{sc !== null ? fmt(sc, 1) : ''}</span>
      </div>
    )
  }
  return (
    <div
      className="bk-match"
      style={{ cursor: m ? 'pointer' : undefined, borderColor: gold ? 'rgba(245,185,66,.4)' : undefined }}
      onClick={() => {
        if (!m) return
        setViewWeek(m.week)
        setTab('matchup')
      }}
    >
      <div className="bk-label" style={gold ? { color: 'var(--gold)' } : undefined}>{label}{m && m.week === LAST_WEEK && !res && started ? ' · live' : ''}</div>
      {row(a, sa)}
      {row(b, sb)}
    </div>
  )
}
