import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { ROLE_LABEL, type Data, type Player } from '../engine/data'
import type { FTeam } from '../engine/league'
import { getData } from '../store'

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

export function initials(name: string) {
  const parts = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]
  const first = parts[0]
  return (first[0] + last[0]).toUpperCase()
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
    <div className={`fteam-av ${size ?? ''}`} style={{ ['--c' as string]: t.color }}>
      {initials(t.name)}
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

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtDate(iso: string, withDay = true) {
  const d = new Date(iso + 'T00:00:00')
  return `${withDay ? WD[d.getDay()] + ' ' : ''}${d.getDate()} ${MO[d.getMonth()]}`
}

export function weekLabel(w: number) {
  if (w === 7) return 'Semis'
  if (w === 8) return 'Final'
  return `Week ${w}`
}

/** small circles showing a player's IPL matches in a gameweek */
export function MatchBalls({ d, p, gw, played, live }: { d: Data; p: Player; gw: number; played: number; live?: number | null }) {
  const mis = d.teamGw[p.team]?.[gw] ?? []
  if (!mis.length) return <span className="dim" style={{ fontSize: 11 }}>No match</span>
  return (
    <span className="balls" title={mis.map((mi) => opponentLabel(d, p.team, mi)).join(' · ')}>
      {mis.map((mi) => {
        const done = mi < played
        const isLive = live === mi
        const dnp = done && !p.games.has(mi)
        return <span key={mi} className={`mb ${isLive ? 'live' : dnp ? 'dnp' : done ? 'done' : ''}`} />
      })}
    </span>
  )
}

export function opponentLabel(d: Data, team: string, mi: number) {
  const m = d.matches[mi]
  const opp = m.teams[0] === team ? m.teams[1] : m.teams[0]
  return `v ${opp} ${fmtDate(m.raw.date)}`
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
