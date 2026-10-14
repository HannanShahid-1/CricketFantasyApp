import { useMemo } from 'react'
import { ROLE_NAME } from '../../engine/data'
import { SCORING_RULES, fmt } from '../../engine/scoring'
import type { Role } from '../../engine/types'
import { getData, useApp } from '../../store'
import { PlayerAvatar, TeamChip } from '../common'
import { scoringStats } from '../scoringStats'

export function ScoringView() {
  const d = getData()
  const openPlayer = useApp((s) => s.openPlayer)

  // real distribution of single-match scores this season under these rules
  const stats = useMemo(() => scoringStats(d), [d])

  return (
    <>
      <div className="page-title">
        <h1>Scoring</h1>
        <div className="sub">Option 1 · Standard — football-sized decimal scoring</div>
      </div>
      <div className="rule-note">
        <b>One match per player counts each week.</b> If a player has two matches in a gameweek, his first match counts
        unless you lock in the other one on My Team (or his player card). You have to choose <i>before his first match
        starts</i>; after that the choice is closed. A player is fixed in your lineup once the match that counts for him
        begins, so a bench player whose counting match has already been played can't be moved in. If he isn't in the XI
        for his counting match, auto-sub swaps in a bench player whose own counting match hasn't started.
      </div>
      <div className="grid3" style={{ marginBottom: 16 }}>
        {(Object.entries(SCORING_RULES) as [string, readonly (readonly [string, string])[]][]).map(([k, rules]) => (
          <div className="card" key={k}>
            <div className="card-h">
              <span className={`slot ${k === 'batting' ? 'BAT' : k === 'bowling' ? 'BOWL' : 'WK'}`}>{k === 'batting' ? 'BAT' : k === 'bowling' ? 'BOWL' : 'FLD'}</span>
              <h3 style={{ textTransform: 'capitalize' }}>{k}</h3>
            </div>
            <div className="card-b col" style={{ gap: 0 }}>
              {rules.map(([label, v]) => (
                <div key={label} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
                  <span className="grow" style={{ fontSize: 13 }}>{label}</span>
                  <span className="num accent right" style={{ fontSize: 12.5, maxWidth: 170 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-h">
            <h3>How it played out in IPL {d.raw.simSeason}</h3>
          </div>
          <div className="card-b">
            <div className="tiles" style={{ marginBottom: 12 }}>
              <div className="tile">
                <div className="v">{fmt(stats.median, 1)}</div>
                <div className="k">Median match score</div>
              </div>
              <div className="tile">
                <div className="v">{stats.apps.length}</div>
                <div className="k">Player-matches</div>
              </div>
            </div>
            {(['WK', 'BAT', 'ARB', 'ARW', 'BOWL'] as Role[]).map((r) => {
              const x = stats.byRole[r]
              if (!x) return null
              return (
                <div key={r} className="row" style={{ padding: '7px 0' }}>
                  <span className={`role ${r}`} style={{ width: 150 }}>{ROLE_NAME[r]}</span>
                  <div className="progress grow">
                    <i style={{ width: `${Math.min(100, (x.avg / 25) * 100)}%` }} />
                  </div>
                  <span className="num" style={{ width: 48, textAlign: 'right' }}>{fmt(x.avg, 1)}</span>
                </div>
              )
            })}
            <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>Average points per appearance, by role.</div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Biggest single-match scores</h3>
          </div>
          <div className="card-b" style={{ paddingTop: 6 }}>
            {stats.apps.slice(0, 8).map((x, i) => {
              const p = d.players[x.p]
              const m = d.matches[x.mi]
              const opp = m.teams[0] === p.team ? m.teams[1] : m.teams[0]
              return (
                <div key={i} className="pcell" style={{ padding: '7px 0' }} onClick={() => openPlayer(p.idx)}>
                  <PlayerAvatar p={p} size="sm" />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="pname">{p.name}</div>
                    <div className="pmeta" style={{ marginTop: 1 }}>
                      <TeamChip code={p.team} /> v {opp}
                    </div>
                  </div>
                  <span className="num accent" style={{ fontSize: 18, fontWeight: 700 }}>{fmt(x.pts)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
