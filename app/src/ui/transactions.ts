// Adding, claiming and trading players: rules of thumb shared by the web and iPhone sheets.
import type { League } from '../engine/league'

/** A starting FAAB bid: about 15% of his rest-of-season value, at least $1, never more than the budget. */
export const suggestedBid = (budget: number, ros: number) => Math.min(budget, Math.max(1, Math.round(ros * 0.15)))

/** Trade offers `from` has sent `to` that are still waiting for an answer. */
export const pendingOffers = (l: League, from: number, to: number) =>
  l.trades.filter((t) => t.status === 'pending' && t.from === from && t.to === to).length
