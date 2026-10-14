// Adding, claiming and trading players: rules of thumb shared by the web and iPhone sheets.
import { restOfSeason, type Data } from '../engine/data'
import { isLocked, ROSTER_SIZE, slotLocked, tradeValue, type League } from '../engine/league'

/** A starting FAAB bid: about 15% of his rest-of-season value, at least $1, never more than the budget. */
export const suggestedBid = (budget: number, ros: number) => Math.min(budget, Math.max(1, Math.round(ros * 0.15)))

/** Trade offers `from` has sent `to` that are still waiting for an answer. */
export const pendingOffers = (l: League, from: number, to: number) =>
  l.trades.filter((t) => t.status === 'pending' && t.from === from && t.to === to).length

/**
 * What a trade from `from` to `to` means if it goes through now (the engine's rules, from `from`'s side):
 * `staying`: players you give who have already played for you this week, so they finish the week in your lineup
 * (off roster) and their points count for you; `nextWeek`: players you get whose week has started, so they can't
 * play for you until next week; and both rosters' sizes afterwards (over the limit means dropping down).
 */
export function tradeImpact(d: Data, l: League, from: number, to: number, give: number[], get: number[]) {
  const A = l.teams[from]
  const B = l.teams[to]
  return {
    staying: give.filter((p) => A.starters.includes(p) && slotLocked(d, l, from, p)),
    nextWeek: get.filter((p) => isLocked(d, l, p)),
    mine: A.roster.length - give.length + get.length,
    theirs: B.roster.length - get.length + give.length,
  }
}

/**
 * Rest-of-season value each way, from `from`'s side. Getting more players than you give costs the least valuable
 * ones you'd have to cut to get back to the roster limit (the same sum AI managers do).
 */
export function tradeBalance(d: Data, l: League, from: number, give: number[], get: number[]) {
  const after = l.teams[from].roster.filter((p) => !give.includes(p)).concat(get)
  const cut = after
    .map((p) => restOfSeason(d, d.players[p], l.played))
    .sort((a, b) => a - b)
    .slice(0, Math.max(0, after.length - ROSTER_SIZE))
    .reduce((a, v) => a + v, 0)
  return { give: tradeValue(d, l, give), get: tradeValue(d, l, get) - cut }
}
