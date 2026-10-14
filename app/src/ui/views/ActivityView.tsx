import { ArrowLeftRight, CircleDollarSign, Minus, Plus, RefreshCw, XCircle } from 'lucide-react'
import { useState } from 'react'
import type { Txn } from '../../engine/league'
import { getData, useApp } from '../../store'
import { FTeamAvatar } from '../common'
import { weekLabel } from '../format'

const ICON: Record<Txn['type'], { i: typeof Plus; c: string; label: string }> = {
  add: { i: Plus, c: 'var(--accent)', label: 'Free agent add' },
  drop: { i: Minus, c: 'var(--loss)', label: 'Dropped' },
  waiver: { i: CircleDollarSign, c: 'var(--gold)', label: 'Waiver claim' },
  'waiver-fail': { i: XCircle, c: 'var(--loss)', label: 'Claim failed' },
  trade: { i: ArrowLeftRight, c: 'var(--sky)', label: 'Trade' },
  autosub: { i: RefreshCw, c: 'var(--ar)', label: 'Auto-sub' },
}

export function ActivityView() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const openPlayer = useApp((s) => s.openPlayer)
  const [mine, setMine] = useState(false)
  const txns = league.txns.filter((t) => !mine || t.teamId === 0 || t.otherTeamId === 0)
  const P = (id: number, c?: string) => (
    <b style={{ cursor: 'pointer', color: c }} onClick={() => openPlayer(id)}>
      {d.players[id].name}
    </b>
  )

  return (
    <>
      <div className="page-title">
        <h1>Activity</h1>
        <div className="sub">Waivers, trades, adds/drops and auto-subs across the league</div>
        <div className="grow" />
        <div className="seg" style={{ marginBottom: 4 }}>
          <button className={!mine ? 'on' : ''} onClick={() => setMine(false)}>
            League
          </button>
          <button className={mine ? 'on' : ''} onClick={() => setMine(true)}>
            Mine
          </button>
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {txns.length === 0 && <div className="empty">No transactions yet. Waivers process at the end of each gameweek.</div>}
        {txns.map((t) => {
          const meta = ICON[t.type]
          const team = league.teams[t.teamId]
          return (
            <div className="txn" key={t.id}>
              <div className="txn-ic" style={{ color: meta.c }}>
                <meta.i size={17} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <FTeamAvatar t={team} size="sm" />
                  <b>{team.isUser ? 'You' : team.name}</b>
                  <span className="dim" style={{ fontSize: 12 }}>{meta.label}</span>
                  {t.bid !== undefined && <span className="chip gold">${t.bid}</span>}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7 }}>
                  {t.type === 'trade' ? (
                    <>
                      Received {t.adds.map((p, i) => <span key={p}>{i ? ', ' : ''}{P(p, "var(--accent)")}</span>)} from{' '}
                      <b>{league.teams[t.otherTeamId!].name}</b> for {t.drops.map((p, i) => <span key={p}>{i ? ', ' : ''}{P(p, "var(--loss)")}</span>)}
                    </>
                  ) : t.type === 'autosub' ? (
                    <>
                      {P(t.adds[0], "var(--accent)")} in for {P(t.drops[0], "var(--loss)")} <span className="dim">({t.note})</span>
                    </>
                  ) : (
                    <>
                      {t.adds.map((p) => (
                        <span key={p}>
                          <span className="accent">+ </span>
                          {P(p)}{' '}
                        </span>
                      ))}
                      {t.drops.map((p) => (
                        <span key={p}>
                          <span className="loss">− </span>
                          {P(p)}{' '}
                        </span>
                      ))}
                      {t.note && <span className="dim">· {t.note}</span>}
                    </>
                  )}
                </div>
              </div>
              <span className="dim" style={{ fontSize: 12 }}>{weekLabel(t.week)}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
