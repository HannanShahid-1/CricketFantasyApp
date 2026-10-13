import { matchProjection, seasonToDate, type Data, type Player } from './data'
import type { League } from './league'
import { fantasyAdvice, gameVerdict } from './fantasyAdvice'
import { scoutingProfile, performanceContext } from './playerProfile'
import { bowlLine, fieldLine, fmt, oversStr, type StatLine } from './scoring'

export function playerRanks(d: Data, p: Player, played: number) {
  const value = (x: Player) => seasonToDate(x, played).pts
  const eligible = (x: Player) => seasonToDate(x, played).apps > 0
  return {
    season: d.raw.simSeason,
    role: eligible(p) ? 1 + d.pool.filter((x) => x.role === p.role && eligible(x) && value(x) > value(p)).length : null,
    overall: eligible(p) ? 1 + d.pool.filter((x) => eligible(x) && value(x) > value(p)).length : null,
  }
}

export function playerOwnership(l: League | null, pid: number) {
  if (!l) return { rostered: null, started: null }
  // This is one local league, not an invented percentage across all leagues.
  return { rostered: l.teams.some((t) => t.roster.includes(pid)) ? 100 : 0,
    started: l.teams.some((t) => t.roster.includes(pid) && t.starters.includes(pid)) ? 100 : 0 }
}

export function playerSeasonStats(d: Data, p: Player, played: number) {
  const completed = [...p.games.values()].filter((g) => g.mi < played)
  // Season stats never borrow prior-season results, even before the first appearance.
  const lines: StatLine[] = completed.map((g) => g.line)
  const sum = (key: keyof StatLine) => lines.reduce((n, l) => n + Number(l[key]), 0)
  const runs = sum('r'), balls = sum('b'), outs = sum('out'), wickets = sum('w'), conceded = sum('rc'), bowled = sum('bb')
  const batting = p.role === 'WK' || p.role === 'BAT' || p.role === 'ARB'
  const stats = batting
    ? [['Runs', String(runs)], ['Bat avg', outs ? fmt(runs / outs, 1) : '—'], ['Strike rate', balls ? fmt(runs * 100 / balls, 1) : '—'], ['4s / 6s', `${sum('fours')} / ${sum('sixes')}`]]
    : [['Wickets', String(wickets)], ['Economy', bowled ? fmt(conceded * 6 / bowled, 2) : '—'], ['Bowl avg', wickets ? fmt(conceded / wickets, 1) : '—'], ['Overs', oversStr(bowled)]]
  if (p.role === 'ARB') stats.push(['Wickets', String(wickets)], ['Economy', bowled ? fmt(conceded * 6 / bowled, 2) : '—'])
  if (p.role === 'ARW') stats.push(['Runs', String(runs)], ['Strike rate', balls ? fmt(runs * 100 / balls, 1) : '—'])
  if (p.role === 'WK') stats.push(['Catches / stumpings', `${sum('ct')} / ${sum('st')}`])
  return { season: d.raw.simSeason, apps: lines.length, stats }
}

export interface PlayerReport { key: string; title: string; date: string; summary: string; analysis: string; mi: number; kind: 'Preview' | 'Recap' }
export function playerReports(d: Data, p: Player, played: number, leagueSize = 8): PlayerReport[] {
  const mis = d.teamMis[p.team] ?? []
  const reports: PlayerReport[] = []
  const next = mis.find((mi) => mi >= played)
  if (next !== undefined) {
    const m = d.matches[next], projection = matchProjection(d, p, next, played)
    const profile = scoutingProfile(d, p, played)
    const advice = fantasyAdvice(d, p, played, leagueSize)
    const identity = profile.identity.startsWith('Role still') ? 'His specialist role is not established in the available history.' : `His recent usage: ${profile.identity}.`
    reports.push({ key: `preview-${next}`, kind: 'Preview', date: m.raw.date, mi: next,
      title: `${p.fullName} · Next up: ${projection.opponent}`,
      summary: `${p.name} faces ${projection.opponent} on ${m.raw.date} at ${m.raw.venue}. His forecast is ${fmt(projection.total, 1)} total FPTS, including estimated playing probability.`,
      analysis: `${advice.opinion} ${identity}` })
  }
  for (const mi of mis.filter((x) => x < played).reverse().slice(0, 3)) {
    const m = d.matches[mi], g = p.games.get(mi), opponent = m.teams.find((t) => t !== p.team)!
    if (!g) {
      reports.push({ key: `recap-${mi}`, kind: 'Recap', mi, date: m.raw.date, title: `${p.fullName} · Did not appear`, summary: `${p.name} did not appear against ${opponent} and recorded 0 FPTS.`, analysis: `A zero stings for managers who started him. ${fantasyAdvice(d, p, mi + 1, leagueSize).opinion}`, })
      continue
    }
    const forecast = matchProjection(d, p, mi, mi).total
    const before = scoutingProfile(d, p, mi)
    const context = performanceContext(before, g.pts.total)
    const headline = g.line.w >= 3 ? `Takes ${g.line.w} wickets against ${opponent}`
      : g.line.r >= 50 ? `Hits ${g.line.r}${g.line.out ? '' : '*'} against ${opponent}`
      : g.line.out && g.line.r === 0 ? `Dismissed without scoring against ${opponent}`
      : g.line.bb >= 12 && g.line.w === 0 ? `Goes wicketless against ${opponent}`
      : g.line.w > 0 && (p.role === 'BOWL' || p.role === 'ARW' || g.line.r < 20) ? `Takes ${g.line.w} wicket${g.line.w === 1 ? '' : 's'} against ${opponent}`
      : g.line.batted ? `Makes ${g.line.r}${g.line.out ? '' : '*'} against ${opponent}` : context.label
    const workload = before.oversPerAppearance !== null && g.line.bb / 6 < before.oversPerAppearance * 0.6
      ? `He bowled ${oversStr(g.line.bb)} overs, fewer than his recent ${fmt(before.oversPerAppearance, 1)}-over average; the scorecard alone does not explain the change.`
      : before.ballsPerInnings !== null && g.line.batted && g.line.b < before.ballsPerInnings * 0.6
        ? `He faced ${g.line.b} deliveries compared with his recent average of ${fmt(before.ballsPerInnings, 1)}, limiting his time at the crease.`
        : g.line.bb >= 12 ? `His bowling economy was ${fmt(g.line.rc * 6 / g.line.bb, 1)} runs per over.`
          : g.line.b >= 10 ? `He scored at a strike rate of ${fmt(g.line.r * 100 / g.line.b, 1)}.` : '' 
    const details = [g.line.batted ? `${g.line.r}${g.line.out ? '' : '*'} runs off ${g.line.b} balls` : 'did not bat', bowlLine(g.line) ? `${g.line.w}/${g.line.rc} from ${oversStr(g.line.bb)} overs` : null, fieldLine(g.line)].filter(Boolean).join('; ')
    reports.push({ key: `recap-${mi}`, kind: 'Recap', mi, date: m.raw.date,
      title: `${p.fullName} · ${headline}`,
      summary: `${p.name} recorded ${details} against ${opponent}, finishing with ${fmt(g.pts.total, 1)} total FPTS${m.raw.winner ? ` in ${p.team}'s ${m.raw.winner === p.team ? 'win' : 'loss'}` : ''}.`,
      analysis: `${gameVerdict(d, p, mi, g.pts.total, leagueSize)} ${workload} The pre-match estimate was ${fmt(forecast, 1)} FPTS.` })
  }
  return reports
}

