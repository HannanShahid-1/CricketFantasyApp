// Editorial fantasy opinions, not promises or official player classifications.
import { availability, perMatchProj, ROLE_LABEL, type Data, type Player } from './data'
import { scoutingProfile } from './playerProfile'
import { fmt } from './scoring'

export interface FantasyAdvice {
  tier: string | null
  recommendation: 'Strong start' | 'Start consideration' | 'Matchup-dependent' | 'Bench / watchlist' | 'Wait for XI' | 'Unproven'
  opinion: string
  explanation: string
}
export function fantasyAdvice(d: Data, p: Player, played: number, leagueSize = 8): FantasyAdvice {
  const size = Math.max(1, leagueSize)
  const profile = scoutingProfile(d, p, played)
  const known = (x: Player) => x.history.length + [...x.games.keys()].filter((mi) => mi < played).length
  const value = (x: Player) => perMatchProj(d, x, played) * availability(d, x, played)
  const chance = availability(d, p, played)
  const explanation = `Editorial tiers compare expected FPTS among established players in the same primary role: ${size} players per tier in this ${size}-team league. Start advice also considers competition for eligible starting slots and estimated playing probability. These are opinions, not season-total ranks.`
  if (profile.limited) return { tier: null, recommendation: 'Unproven', opinion: `${p.name} is a watchlist option for now. There is not enough history to call him a reliable fantasy starter; look for repeated opportunities before buying into a breakout.`, explanation }
  const peers = d.pool.filter((x) => x.role === p.role && known(x) >= 5)
  const positionRank = 1 + peers.filter((x) => value(x) > value(p)).length
  const tier = `${ROLE_LABEL[p.role]}${Math.ceil(positionRank / size)}`
  const previousFixtures = (d.teamMis[p.team] ?? []).filter((mi) => mi < played).reverse()
  let missed = 0
  for (const mi of previousFixtures) { if (p.games.has(mi)) break; missed++ }
  if (missed > 0) return { tier, recommendation: 'Wait for XI', opinion: `${p.name} has missed his team's last ${missed} match${missed === 1 ? '' : 'es'}. Keep him out of a committed starting spot until his return is confirmed; his ${tier} tier describes fantasy value, not current availability. The match data does not explain the absence.`, explanation }
  if (chance < 0.55) return { tier, recommendation: 'Wait for XI', opinion: `The ${tier} label is not a green light to start ${p.name}. His estimated playing chance is only ${Math.round(chance * 100)}%; wait for a confirmed XI and keep an alternative ready.`, explanation }
  const slot = p.role === 'WK' ? 'WK' : p.role === 'BAT' || p.role === 'ARB' ? 'BAT' : 'BOWL'
  const starterDepth = size * (slot === 'WK' ? 1 : 4)
  const competition = d.pool.filter((x) => x.elig.includes(slot) && known(x) >= 5)
  const starterRank = 1 + competition.filter((x) => value(x) > value(p)).length
  const strong = starterRank <= Math.ceil(starterDepth * 0.6) && chance >= 0.65
  const start = starterRank <= starterDepth && chance >= 0.6
  const fringe = starterRank <= starterDepth * 1.3
  const recommendation = strong ? 'Strong start' : start ? 'Start consideration' : fringe ? 'Matchup-dependent' : 'Bench / watchlist'
  const direction = profile.trend === 'rising' ? `His last three appearances average ${fmt(profile.recentAverage!, 1)} FPTS, giving managers a reason to lean into the recent form.`
    : profile.trend === 'falling' ? `His last three appearances average ${fmt(profile.recentAverage!, 1)} FPTS. The dip takes some shine off his appeal, so weigh your alternatives before locking him in.`
      : profile.volatile ? 'There is upside here, but his uneven historical returns make him a riskier choice when you need a steady score.'
        : `Across ${profile.sampleSize} known appearances, he averages ${fmt(profile.average!, 1)} FPTS—a useful baseline for expectations.`
  const call = strong ? `${p.name} profiles as a ${tier}-level option and belongs high on your start list, provided he is named in the XI.`
    : start ? `${p.name} sits in the ${tier} tier and is a reasonable starting option in your ${size}-team league, provided his place in the XI is confirmed.`
      : fringe ? `${p.name} is a ${tier}, matchup-dependent option. Compare his selected fixture with your other starters before giving him the spot.`
        : `${p.name} is currently a ${tier} depth option. Managers with stronger alternatives can leave him on the bench and wait for more convincing form or opportunity.`
  return { tier, recommendation, opinion: `${call} ${direction}`, explanation }
}

export function gameVerdict(d: Data, p: Player, mi: number, points: number, leagueSize = 8) {
  const before = scoutingProfile(d, p, mi)
  const advice = fantasyAdvice(d, p, mi + 1, leagueSize)
  if (before.limited || before.average === null) return `${points >= 15 ? 'An encouraging return that puts him on the watchlist' : 'A result to file away rather than overreact to'}, but one match is not enough to establish his fantasy level. ${advice.opinion}`
  const difference = points - before.average
  const threshold = Math.max(4, before.average * 0.3)
  const reaction = difference > threshold
    ? `${fmt(points, 1)} FPTS will have his managers smiling: that was comfortably above his usual ${fmt(before.average, 1)}-point return. One big game earns attention, not an automatic must-start label.`
    : difference < -threshold
      ? `${fmt(points, 1)} FPTS was a frustrating return by his usual ${fmt(before.average, 1)}-point standards. ${advice.recommendation === 'Strong start' ? 'This looks more like a reason to reset expectations than an automatic benching.' : 'Managers should compare their alternatives rather than assume a bounce-back is coming.'}`
      : `A ${fmt(points, 1)}-point return was broadly in line with his usual ${fmt(before.average, 1)}. Useful context for managers, even if it was not a week-winning performance.`
  return `${reaction} ${advice.opinion}`
}
