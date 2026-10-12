import type { Data, Player } from '../engine/data'
import { matchupsForWeek, matchupWinner, playerWeek, type League } from '../engine/league'
import { batLine, bowlLine, fmt } from '../engine/scoring'
import { opponentLabel } from './format'

/** Compact line for one match, e.g. "45 (30), 2/28" */
function matchLine(p: Player, mi: number): string {
  const g = p.games.get(mi)
  if (!g) return 'DNP'
  const parts: string[] = []
  const b = batLine(g.line)
  const w = bowlLine(g.line)
  if (b) parts.push(b.replace(/ \d+×[46]/g, ''))
  if (w) parts.push(`${g.line.w}/${g.line.rc}`)
  if (g.line.ct + g.line.st) parts.push(`${g.line.ct + g.line.st} ct`)
  return parts.join(', ') || 'played'
}

/** What his counting match did (or which match will count), e.g. "45 (30), 2/28" or "Counts v MI Tue 7 Apr" */
export function weekSummary(d: Data, p: Player, counted: number | null, played: number): string {
  if (counted === null) return 'No match this week'
  if (counted < played) return matchLine(p, counted)
  return `Counts ${opponentLabel(d, p.team, counted)}`
}

export function teamStarters(l: League, teamId: number, week: number) {
  const r = l.results[week]
  return r ? r.starters[teamId] : l.teams[teamId].starters
}

export function liveTeamScore(d: Data, l: League, teamId: number, week: number, playedOverride?: number) {
  const played = l.results[week] ? Infinity : (playedOverride ?? l.played)
  let score = 0
  let proj = 0
  for (const p of teamStarters(l, teamId, week)) {
    if (p === null) continue
    const wp = playerWeek(d, l, teamId, p, week, played)
    score += wp.banked
    proj += wp.total
  }
  return { score, proj }
}

/** Template-driven weekly recap. Stand-in for an LLM-written recap later. */
export function weekRecap(d: Data, l: League, week: number): string[] | null {
  const r = l.results[week]
  if (!r) return null
  const name = (id: number) => (id === 0 ? 'You' : l.teams[id].name)
  const ms = matchupsForWeek(l, week).map((m) => {
    const sa = r.scores[m.a]
    const sb = r.scores[m.b]
    const w = matchupWinner(l, m)
    return { m, sa, sb, w, margin: Math.abs(sa - sb) }
  })
  if (!ms.length) return null
  const blow = [...ms].sort((a, b) => b.margin - a.margin)[0]
  const close = [...ms].sort((a, b) => a.margin - b.margin)[0]

  // top individual performance among starters
  let top: { p: Player; pts: number; team: number } | null = null
  for (const t of l.teams) {
    for (const pid of r.starters[t.id]) {
      if (pid === null) continue
      const p = d.players[pid]
      const pts = playerWeek(d, l, t.id, pid, week, Infinity).banked
      if (!top || pts > top.pts) top = { p, pts, team: t.id }
    }
  }
  const scores = Object.entries(r.scores).sort((a, b) => b[1] - a[1])
  const high = scores[0]

  const out: string[] = []
  const wl = (x: (typeof ms)[number]) => {
    const winner = x.w ?? x.m.a
    const loser = winner === x.m.a ? x.m.b : x.m.a
    return { winner, loser, ws: Math.max(x.sa, x.sb), ls: Math.min(x.sa, x.sb) }
  }
  const b = wl(blow)
  out.push(
    `${name(b.winner)} ${['ran riot against', 'steamrolled', 'cruised past'][week % 3]} ${b.loser === 0 ? 'you' : name(b.loser)}, winning ${fmt(b.ws)}–${fmt(b.ls)} — the biggest margin of ${week > 6 ? 'the round' : `Week ${week}`} at ${fmt(blow.margin)} points.`,
  )
  if (close !== blow) {
    const c = wl(close)
    out.push(`The nail-biter: ${name(c.winner)} edged ${c.loser === 0 ? 'you' : name(c.loser)} by just ${fmt(close.margin)} (${fmt(c.ws)}–${fmt(c.ls)}).`)
  }
  if (top) {
    out.push(
      `Player of the week: ${top.p.name} (${top.p.team}) piled up ${fmt(top.pts)} points for ${top.team === 0 ? 'your side' : name(top.team)}.`,
    )
  }
  out.push(`${name(Number(high[0]))} posted the week's top score with ${fmt(high[1])}${r.median !== null ? `; the league median was ${fmt(r.median)}` : ''}.`)
  return out
}
