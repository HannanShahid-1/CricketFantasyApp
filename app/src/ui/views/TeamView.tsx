import { ArrowLeftRight, Lock, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { seasonToDate } from '../../engine/data'
import { currentWeek, playerWeek, slotLocked, SLOTS, standings } from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, ME, useApp } from '../../store'
import { FTeamAvatar, PlayerAvatar, RoleTag, TeamChip } from '../common'
import { weekLabel } from '../format'
import { MatchPicker } from '../MatchPicker'
import { useShallow } from 'zustand/react/shallow'

type Sel = { kind: 'slot'; i: number } | { kind: 'bench'; p: number } | null

export function TeamView() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { setStarters, optimize, toggleAutoSub, toggleAutoLineup, openPlayer, drop, notify, cancelClaim, openTrade } = useApp(useShallow((s) => ({ setStarters: s.setStarters, optimize: s.optimize, toggleAutoSub: s.toggleAutoSub, toggleAutoLineup: s.toggleAutoLineup, openPlayer: s.openPlayer, drop: s.drop, notify: s.notify, cancelClaim: s.cancelClaim, openTrade: s.openTrade })))
  const [sel, setSel] = useState<Sel>(null)
  const me = league.teams[0]
  const week = currentWeek(d, league)
  const done = league.phase === 'complete'
  const st = me.starters
  const bench = me.roster.filter((p) => !st.includes(p))
  const locked = (p: number | null) => p !== null && (done || slotLocked(d, league, ME, p, week))
  const row = standings(league).findIndex((r) => r.teamId === 0)
  const srow = standings(league)[row]
  const proj = st.reduce<number>((a, p) => a + (p === null ? 0 : playerWeek(d, league, ME, p, week).total), 0)

  const selPlayer = sel ? (sel.kind === 'slot' ? st[sel.i] : sel.p) : null

  const isTarget = (target: Sel): boolean => {
    if (!sel || !target) return false
    if (sel.kind === 'slot') {
      const p = st[sel.i]
      if (target.kind === 'bench') {
        return !locked(target.p) && d.players[target.p].elig.includes(SLOTS[sel.i]) && (p === null || true)
      }
      if (target.i === sel.i || locked(st[target.i])) return false
      const okP = p === null || d.players[p].elig.includes(SLOTS[target.i])
      const q = st[target.i]
      const okQ = q === null || d.players[q].elig.includes(SLOTS[sel.i])
      return okP && okQ && (p !== null || q !== null)
    }
    if (target.kind === 'slot') {
      return !locked(st[target.i]) && d.players[sel.p].elig.includes(SLOTS[target.i])
    }
    return false
  }

  const doMove = (target: Sel) => {
    if (!sel || !target) return
    const next = [...st]
    if (sel.kind === 'slot' && target.kind === 'bench') next[sel.i] = target.p
    else if (sel.kind === 'bench' && target.kind === 'slot') next[target.i] = sel.p
    else if (sel.kind === 'slot' && target.kind === 'slot') {
      ;[next[sel.i], next[target.i]] = [next[target.i], next[sel.i]]
    }
    const err = setStarters(next)
    if (err) notify(err, 'bad')
    setSel(null)
  }

  const click = (target: Sel, p: number | null) => {
    if (done) return
    if (sel && isTarget(target)) return doMove(target)
    if (sel && JSON.stringify(sel) === JSON.stringify(target)) return setSel(null)
    if (p !== null && locked(p)) return notify(`${d.players[p].name} is locked: the match that counts for him has started`, 'info')
    if (target?.kind === 'slot' && p === null) {
      setSel(target)
      return
    }
    setSel(target)
  }

  const myClaims = league.claims.filter((c) => c.teamId === 0)

  return (
    <>
      <div className="page-title">
        <FTeamAvatar t={me} size="lg" />
        <div>
          <h1>{me.name}</h1>
          <div className="sub">
            {srow.w + srow.mw}-{srow.l + srow.ml} · {ordinal(row + 1)} in league · {fmt(srow.pf, 1)} PF
          </div>
        </div>
        <div className="grow" />
        <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, 120px)' }}>
          <div className="tile">
            <div className="v turf">{fmt(proj, 1)}</div>
            <div className="k">{weekLabel(week)} proj</div>
          </div>
          <div className="tile">
            <div className="v">${me.faab}</div>
            <div className="k">FAAB left</div>
          </div>
          <div className="tile">
            <div className="v">#{league.waiverOrder.indexOf(0) + 1}</div>
            <div className="k">Waiver priority</div>
          </div>
        </div>
      </div>

      <div className="row wrap" style={{ marginBottom: 14 }}>
        <button className="btn primary" disabled={done} onClick={() => { optimize(); notify('Lineup optimised by projection') }}>
          <Wand2 size={15} /> Optimise lineup
        </button>
        <button className="btn" onClick={toggleAutoSub} title="Swap in an eligible bench player when a starter misses the XI">
          <Sparkles size={15} className={me.autoSub ? 'turf' : 'dim'} /> Auto-sub: {me.autoSub ? 'On' : 'Off'}
        </button>
        <button className="btn" onClick={toggleAutoLineup} title="Re-optimise your lineup by projection at the start of every gameweek">
          <Wand2 size={15} className={me.autoLineup ? 'turf' : 'dim'} /> Auto-set weekly: {me.autoLineup ? 'On' : 'Off'}
        </button>
        <button className="btn" onClick={() => openTrade(1)} disabled={done}>
          <ArrowLeftRight size={15} /> Propose trade
        </button>
        <span className="muted" style={{ fontSize: 12.5, marginLeft: 6 }}>
          {sel ? (selPlayer !== null ? `Moving ${d.players[selPlayer!].name}: tap a highlighted row` : 'Tap a highlighted player to fill this slot') : 'Tap a player, then tap where to move him.'}
        </span>
      </div>

      <div className="rule-note">
        <b>One match counts.</b> Only one match per player counts each week: his first, unless you lock in another. For
        players with two matches, tap the match you want <i>before his first match starts</i>. After that the choice is
        closed. A player is fixed in your lineup once the match that counts for him begins.
      </div>

      <div className="card">
        <div className="lineup-head">
          <span>Slot</span>
          <span>Player</span>
          <span className="hide-md">{weekLabel(week)}</span>
          <span className="right">Pts</span>
          <span className="right hide-md">Proj</span>
          <span className="right">Season</span>
          <span />
        </div>
        {SLOTS.map((s, i) => (
          <LineupRow
            key={i}
            slot={s}
            pid={st[i]}
            selected={sel?.kind === 'slot' && sel.i === i}
            target={isTarget({ kind: 'slot', i })}
            locked={locked(st[i])}
            onClick={() => click({ kind: 'slot', i }, st[i])}
            onOpen={openPlayer}
          />
        ))}
        <div className="up dim" style={{ padding: '14px 14px 6px', borderBottom: '1px solid var(--line)' }}>Bench</div>
        {bench.map((p) => (
          <LineupRow
            key={p}
            slot="BN"
            pid={p}
            selected={sel?.kind === 'bench' && sel.p === p}
            target={isTarget({ kind: 'bench', p })}
            locked={locked(p)}
            onClick={() => click({ kind: 'bench', p }, p)}
            onOpen={openPlayer}
            onDrop={
              done
                ? undefined
                : () => {
                    if (!confirm(`Drop ${d.players[p].name}? He goes on waivers.`)) return
                    const err = drop(p)
                    notify(err ?? `Dropped ${d.players[p].name}`, err ? 'bad' : 'ok')
                  }
            }
          />
        ))}
        {bench.length === 0 && <div className="dim" style={{ padding: 14, fontSize: 13 }}>No bench players.</div>}
      </div>

      {myClaims.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <h3>Pending waiver claims</h3>
            <span className="dim" style={{ fontSize: 12 }}>Processed when the gameweek ends</span>
          </div>
          {myClaims.map((c) => (
            <div key={c.id} className="txn">
              <div className="txn-ic turf">$</div>
              <div>
                <b>{d.players[c.add].name}</b>
                <span className="muted"> · bid ${c.bid}</span>
                {c.drop !== null && <span className="muted"> · drop {d.players[c.drop].name}</span>}
              </div>
              <button className="btn sm" onClick={() => cancelClaim(c.id)}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function LineupRow({ slot, pid, selected, target, locked, onClick, onOpen, onDrop }: { slot: string; pid: number | null; selected: boolean; target: boolean; locked: boolean; onClick: () => void; onOpen: (p: number) => void; onDrop?: () => void }) {
  const d = getData()
  const league = useApp((s) => s.league)!
  const week = currentWeek(d, league)
  const p = pid !== null ? d.players[pid] : null
  const wp = pid !== null ? playerWeek(d, league, ME, pid, week) : null
  const season = p ? seasonToDate(p, league.played) : null
  return (
    <div className={`lineup-row ${selected ? 'selected' : ''} ${target ? 'target' : ''} ${locked ? 'locked' : ''}`} onClick={onClick}>
      <span className={`slot ${slot}`}>{slot}</span>
      {p ? (
        <div className="row" style={{ minWidth: 0 }}>
          <PlayerAvatar p={p} />
          <div style={{ minWidth: 0 }}>
            <div
              className="pname ellipsis"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onOpen(p.idx)
              }}
            >
              {p.name}
            </div>
            <div className="pmeta" style={{ marginTop: 2 }}>
              <TeamChip code={p.team} />
              <RoleTag p={p} />
              <span className="dim">· {p.elig.join('/')}</span>
              {locked && <Lock size={11} className="dim" />}
            </div>
            <div className="show-md" style={{ marginTop: 6 }}>
              <MatchPicker pid={p.idx} />
            </div>
          </div>
        </div>
      ) : (
        <span className="empty-slot">Empty — tap to fill</span>
      )}
      <div className="hide-md">{p && <MatchPicker pid={p.idx} />}</div>
      <div className="num right" style={{ fontWeight: 700, fontSize: 16 }}>{wp ? fmt(wp.banked) : ''}</div>
      <div className="num right dim hide-md">{wp ? fmt(wp.total, 1) : ''}</div>
      <div className="num right muted">{season ? fmt(season.pts, 1) : ''}</div>
      <div>
        {target && <span className="chip" style={{ color: 'var(--sky)', background: 'rgba(108,196,255,.14)' }}>Swap</span>}
        {!target && onDrop && !locked && (
          <button
            className="btn sm icon ghost danger"
            title="Drop"
            onClick={(e) => {
              e.stopPropagation()
              onDrop()
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
