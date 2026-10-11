import { useState } from 'react'
import { restOfSeason } from '../../engine/data'
import { addMode, isLocked, ROSTER_SIZE } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, useApp } from '../../store'
import { Modal, PlayerAvatar, RoleTag, TeamChip } from '../common'

export function AddModal({ pid }: { pid: number }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { openAdd, faAdd, claim, notify } = useApp()
  const p = d.players[pid]
  const me = league.teams[0]
  const mode = addMode(d, league, pid)
  const full = me.roster.length >= ROSTER_SIZE
  const ros = (x: number) => restOfSeason(d, d.players[x], league.played)
  const [drop, setDrop] = useState<number | null>(null)
  const suggested = Math.min(me.faab, Math.max(1, Math.round(ros(pid) * 0.15)))
  const [bid, setBid] = useState(suggested)
  const close = () => openAdd(null)
  const candidates = [...me.roster].sort((a, b) => ros(a) - ros(b))

  const submit = () => {
    const err = mode === 'free' ? faAdd(pid, drop) : claim(pid, drop, bid)
    if (err) return notify(err, 'bad')
    notify(mode === 'free' ? `Added ${p.name}` : `Claim placed: ${p.name} for $${bid}`)
    close()
  }

  return (
    <Modal
      size="sm"
      onClose={close}
      header={
        <div className="row">
          <PlayerAvatar p={p} size="lg" />
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>
              {mode === 'free' ? 'Add' : 'Waiver claim'}: {p.name}
            </div>
            <div className="pmeta">
              <TeamChip code={p.team} /> <RoleTag p={p} /> · ROS proj <b className="turf">{fmt(ros(pid), 0)}</b>
            </div>
          </div>
        </div>
      }
    >
      <div className="modal-b col" style={{ gap: 14 }}>
        {mode === 'none' && <div className="chip bad">Not available</div>}
        {mode === 'waiver' && (
          <div className="col" style={{ gap: 8 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              {p.name} is on waivers (recently dropped or his match this week has started). Blind FAAB bids are processed when
              the gameweek ends — highest bid wins, ties go to waiver priority.
            </div>
            <div className="row">
              <input type="range" min={0} max={me.faab} value={bid} onChange={(e) => setBid(Number(e.target.value))} className="grow" style={{ accentColor: '#c4ef6a' }} />
              <span className="num" style={{ fontSize: 22, fontWeight: 700, width: 60, textAlign: 'right' }}>${bid}</span>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>Budget left: ${me.faab} · suggested ${suggested}</div>
          </div>
        )}
        <div>
          <div className="up dim" style={{ marginBottom: 6 }}>{full ? 'Choose a player to drop' : 'Drop a player (optional)'}</div>
          <div className="card scroll-y" style={{ maxHeight: 280 }}>
            {!full && (
              <label className="row" style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                <input type="radio" checked={drop === null} onChange={() => setDrop(null)} />
                <span className="muted">Don't drop anyone ({me.roster.length}/{ROSTER_SIZE})</span>
              </label>
            )}
            {candidates.map((x) => {
              const lk = isLocked(d, league, x)
              return (
                <label key={x} className="row" style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', cursor: lk ? 'not-allowed' : 'pointer', opacity: lk ? 0.45 : 1 }}>
                  <input type="radio" disabled={lk} checked={drop === x} onChange={() => setDrop(x)} />
                  <PlayerAvatar p={d.players[x]} size="sm" />
                  <span className="grow ellipsis" style={{ fontWeight: 600 }}>{d.players[x].name}</span>
                  <RoleTag p={d.players[x]} />
                  <span className="num muted" style={{ width: 40, textAlign: 'right' }}>{fmt(ros(x), 0)}</span>
                </label>
              )
            })}
          </div>
        </div>
        <button className="btn primary" disabled={mode === 'none' || (full && drop === null)} onClick={submit}>
          {mode === 'free' ? 'Add player' : `Place $${bid} claim`}
        </button>
      </div>
    </Modal>
  )
}
