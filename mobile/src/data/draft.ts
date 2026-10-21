import { chooseDraftPick, teamOnClock } from '@shared/engine/league'
import { getData, useApp } from '@shared/store'
import { draftRating } from '@shared/ui/draftRankings'

/** Same queue/roster/persona rules as the engine; only the mobile draft's valuation model changes. */
export function mobileDraftAuto() {
  const { league, draftPick } = useApp.getState()
  if (!league || league.phase !== 'draft') return
  const team = teamOnClock(league)
  if (team === null) return
  const d = getData()
  draftPick(chooseDraftPick(d, league, team, { useQueue: league.teams[team].isUser, noise: league.teams[team].isUser ? 0 : undefined, value: (p) => draftRating(d, p).value }))
}
