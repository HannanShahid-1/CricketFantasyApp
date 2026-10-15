import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { ROLE_LABEL, type Data, type Player } from '../engine/data'
import type { FTeam } from '../engine/league'
import { getData } from '../store'
import { initials, opponentLabel } from './format'

export function Logo({ size = 34, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={spin ? 'spin-ball' : undefined} aria-hidden>
      <defs>
        <radialGradient id="lg-ball" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff7a6b" />
          <stop offset="55%" stopColor="#d72f33" />
          <stop offset="100%" stopColor="#7e1418" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="17" fill="url(#lg-ball)" />
      <path d="M9 8.5 C 17 15, 17 25, 9 31.5" fill="none" stroke="#f6e9c9" strokeWidth="1.3" strokeDasharray="1.6 2.1" strokeLinecap="round" />
      <path d="M12.2 6.6 C 20.5 14, 20.5 26, 12.2 33.4" fill="none" stroke="#f6e9c9" strokeWidth="1.3" strokeDasharray="1.6 2.1" strokeLinecap="round" />
      <ellipse cx="14" cy="12" rx="5" ry="3" fill="rgba(255,255,255,0.18)" transform="rotate(-30 14 12)" />
    </svg>
  )
}

export function PlayerAvatar({ p, size }: { p: Player; size?: 'sm' | 'lg' | 'xl' }) {
  const t = getData().teams[p.team || p.profileTeam || '']
  return (
    <div className={`avatar ${size ?? ''}`} style={{ ['--tc' as string]: t?.color ?? '#334', ['--ta' as string]: t?.accent ?? '#556' }}>
      <PlayerPortrait p={p} />
    </div>
  )
}

export function PlayerPortrait({ p }: { p: Player }) {
  const [failed, setFailed] = useState<string>()
  return p.photo && failed !== p.photo
    ? <img src={`${import.meta.env.BASE_URL}${p.photo}`} alt={p.fullName} loading="lazy" onError={() => setFailed(p.photo)} />
    : <span className="portrait-fallback">{initials(p.name)}</span>
}

export function TeamChip({ code }: { code: string }) {
  const t = getData().teams[code]
  if (!t) return null
  return (
    <span className="tchip" title={t.name}>
      <i style={{ background: t.color, boxShadow: `inset -3px 0 0 ${t.accent}` }} />
      {code}
    </span>
  )
}

export function RoleTag({ p }: { p: Player }) {
  return <span className={`role ${p.role}`}>{ROLE_LABEL[p.role]}</span>
}

export function FTeamAvatar({ t, size }: { t: FTeam; size?: 'sm' | 'lg' }) {
  return (
    <div className={`fteam-av ${size ?? ''}`} style={{ ['--c' as string]: t.color }} role="img" aria-label={t.name}>
      {t.avatar}
    </div>
  )
}

export function Modal({ onClose, children, size, header, className = '' }: { onClose: () => void; children: ReactNode; size?: 'sm' | 'lg'; header?: ReactNode; className?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ?? ''} ${className}`}>
        {header && (
          <div className="modal-h">
            <div className="grow">{header}</div>
            <button className="btn icon ghost" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Small circles for a player's IPL matches in a gameweek. With `counted`, the match that counts is ringed
 *  and the others are faded (only one match per player counts each week). */
export function MatchBalls({ d, p, gw, played, live, counted }: { d: Data; p: Player; gw: number; played: number; live?: number | null; counted?: number | null }) {
  const mis = d.teamGw[p.team]?.[gw] ?? []
  if (!mis.length) return <span className="dim" style={{ fontSize: 11 }}>No match</span>
  const marks = counted !== undefined && mis.length > 1
  return (
    <span className="balls" title={mis.map((mi) => `${opponentLabel(d, p.team, mi)}${marks && mi === counted ? ' (counts)' : ''}`).join(' · ')}>
      {mis.map((mi) => {
        const done = mi < played
        const isLive = live === mi
        const dnp = done && !p.games.has(mi)
        const role = marks ? (mi === counted ? 'counts' : 'nc') : ''
        return <span key={mi} className={`mb ${isLive ? 'live' : dnp ? 'dnp' : done ? 'done' : ''} ${role}`} />
      })}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
