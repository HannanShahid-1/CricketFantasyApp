import { ArrowLeftRight, Check } from 'lucide-react'
import { useState } from 'react'
import { restOfSeason } from '../../engine/data'
import { currentWeek, isLocked, PERSONA_LABEL, TRADE_DEADLINE_WEEK, type TradeVerdict } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { FTeamAvatar, Modal, PlayerAvatar, RoleTag, TeamChip } from '../common'

export function TradeModal({ initial }: { initial: number }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { openTrade, trade, notify } = useApp()
  const [other, setOther] = useState(initial)
  const [give, setGive] = useState<number[]>([])
  const [get, setGet] = useState<number[]>([])
  const [verdict, setVerdict] = useState<TradeVerdict | null>(null)
  const me = league.teams[0]
  const them = league.teams[other]
  const week = currentWeek(d, league)
  const ros = (p: number) => restOfSeason(d, d.players[p], league.played)
  const closed = week >= TRADE_DEADLINE_WEEK
  const close = () => openTrade(null)

  const toggle = (list: number[], set: (x: number[]) => void, p: number) => {
    setVerdict(null)
    set(list.includes(p) ? list.filter((x) => x !== p) : [...list, p])
  }
  const giveV = give.reduce((a, p) => a + ros(p), 0)
  const getV = get.reduce((a, p) => a + ros(p), 0)

  const Side = ({ teamId, sel, onToggle }: { teamId: number; sel: number[]; onToggle: (p: number) => void }) => {
    const t = league.teams[teamId]
    const roster = [...t.roster].sort((a, b) => ros(b) - ros(a))
    return (
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h">
          <FTeamAvatar t={t} size="sm" />
          <h3>{t.isUser ? 'You give' : `${t.name} gives`}</h3>
        </div>
        <div className="scroll-y" style={{ maxHeight: 380 }}>
          {roster.map((p) => {
            const pl = d.players[p]
            const lk = isLocked(d, league, p)
            const on = sel.includes(p)
            return (
              <div
                key={p}
                className="row"
                style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', cursor: lk ? 'not-allowed' : 'pointer', opacity: lk ? 0.45 : 1, background: on ? 'rgba(196,239,106,.08)' : undefined }}
                onClick={() => !lk && onToggle(p)}
              >
                <span style={{ width: 18, height: 18, borderRadius: 6, border: '1.5px solid var(--line-2)', display: 'grid', placeItems: 'center', background: on ? 'var(--turf)' : 'transparent' }}>
                  {on && <Check size={12} color="#10200a" />}
                </span>
                <PlayerAvatar p={pl} size="sm" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="pname ellipsis" style={{ fontSize: 13 }}>{pl.name}</div>
                  <div className="pmeta" style={{ marginTop: 1 }}>
                    <TeamChip code={pl.team} /> <RoleTag p={pl} />
                  </div>
                </div>
                <span className="num muted">{fmt(ros(p), 0)}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Modal
      size="lg"
      onClose={close}
      header={
        <div className="row" style={{ gap: 12 }}>
          <ArrowLeftRight size={20} className="turf" />
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>Propose a trade</div>
            <div className="dim" style={{ fontSize: 12 }}>
              Values are rest-of-season projections · deadline: start of Week {TRADE_DEADLINE_WEEK}
            </div>
          </div>
          <div className="grow" />
          <select
            className="input"
            value={other}
            onChange={(e) => {
              setOther(Number(e.target.value))
              setGet([])
              setVerdict(null)
            }}
          >
            {league.teams
              .filter((t) => !t.isUser)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({PERSONA_LABEL[t.persona]})
                </option>
              ))}
          </select>
        </div>
      }
    >
      <div className="modal-b">
        {closed && <div className="chip bad" style={{ marginBottom: 12 }}>The trade deadline has passed</div>}
        <div className="grid2">
          <Side teamId={0} sel={give} onToggle={(p) => toggle(give, setGive, p)} />
          <Side teamId={other} sel={get} onToggle={(p) => toggle(get, setGet, p)} />
        </div>
        <div className="card pad row wrap" style={{ marginTop: 16, gap: 18 }}>
          <div>
            <div className="up dim">You give</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{fmt(giveV, 0)}</div>
          </div>
          <ArrowLeftRight className="dim" />
          <div>
            <div className="up dim">You get</div>
            <div className="num turf" style={{ fontSize: 22, fontWeight: 700 }}>{fmt(getV, 0)}</div>
          </div>
          <div className="grow">
            {verdict && (
              <div className={`chip ${verdict.accepted ? 'ok' : 'bad'}`} style={{ height: 'auto', padding: '8px 12px', whiteSpace: 'normal', fontSize: 13 }}>
                {verdict.message}
              </div>
            )}
          </div>
          <button
            className="btn primary"
            disabled={closed || !give.length || give.length !== get.length}
            onClick={() => {
              const v = trade(other, give, get)
              setVerdict(v)
              if (v.accepted) {
                notify(`Trade accepted by ${them.name}!`)
                close()
              }
            }}
          >
            Send offer to {them.owner.replace('AI · ', '')}
          </button>
        </div>
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
          Same number of players each side. AI managers accept when they gain projected value ({me.name} → {them.name}).
        </div>
      </div>
    </Modal>
  )
}
