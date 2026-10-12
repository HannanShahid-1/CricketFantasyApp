// Plain formatting helpers shared by the UI (kept out of component files so hot reload works).
import type { Data } from '../engine/data'

export function initials(name: string) {
  const parts = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const last = parts[parts.length - 1]
  const first = parts[0]
  return (first[0] + last[0]).toUpperCase()
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

export function opponentLabel(d: Data, team: string, mi: number) {
  const m = d.matches[mi]
  const opp = m.teams[0] === team ? m.teams[1] : m.teams[0]
  return `v ${opp} ${fmtDate(m.raw.date)}`
}
