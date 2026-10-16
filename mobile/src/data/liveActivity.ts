import { useEffect, useRef } from 'react'
import { currentWeek, matchupsForWeek, type League, type Matchup } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME } from '@shared/store'
import { fmtDate, weekLabel } from '@shared/ui/format'
import { matchupOdds } from '@shared/ui/helpers'
import { simulatedFromBase, teamWeekBase } from '@shared/ui/matchupSimulation'
import { LiveActivity } from '../../modules/seam-live-activity'
import { useGameLeague } from '@/data/gameLeague'
import { useLiveSim } from '@/data/simulation'
import { usePrefs } from '@/data/prefs'
import { hex, useTheme, type Theme } from '@/theme/theme'

// Your matchup as a Live Activity (Settings → Live Activity): the widget is targets/matchup-activity, started and
// updated through modules/seam-live-activity. With no push server it only changes while Seam is open: playing a
// match, a simulation, a lineup change.

/** why the Live Activity can't be shown, or null: it needs the Xcode build on an iPhone (not Expo Go), allowed in iOS Settings */
export const liveActivityProblem = () =>
  !LiveActivity ? 'Live Activities need the Xcode build of Seam, not Expo Go.'
  : !LiveActivity.isEnabled() ? 'Turn on Live Activities for Seam in iOS Settings.' : null

type Sim = ReturnType<typeof useLiveSim.getState>

/** Attributes and content for MatchupAttributes (modules/seam-live-activity/ios/MatchupAttributes.swift), or null for none */
function snapshot(league: League, sim: Sim, t: Theme) {
  if (league.phase !== 'season') return null
  const d = getData()
  const week = currentWeek(d, league)
  const raw = matchupsForWeek(league, week).find((x) => x.a === ME || x.b === ME)
  if (!raw) return null
  // your team on the left
  const m: Matchup = raw.b === ME ? { ...raw, a: raw.b, b: raw.a } : raw
  const simOn = sim.m !== null && sim.m.gw === week
  const { sa, sb, pA, final } = matchupOdds(d, league, m, simOn ? (id) => simulatedFromBase(teamWeekBase(d, league, id, week), sim.m!, sim.scores) : undefined)
  const g = d.gameweeks[week - 1]
  const started = simOn || league.replayMatch != null || league.played > g.mis[0]
  const playedIn = g.mis.filter((mi) => mi < league.played).length
  // the one status line under the bar (a dot marks it live)
  const detail = simOn
    ? `${sim.m!.teams.join(' v ')} · ${sim.over ? `${sim.over} ov` : 'first ball'}`
    : `${weekLabel(week)} · ${final ? 'Final' : started ? `${playedIn} of ${g.mis.length} played` : `starts ${fmtDate(g.start, false)}`}`
  const [A, B] = [league.teams[m.a], league.teams[m.b]]
  return {
    attributes: {
      key: `${league.createdAt}-${week}-${m.b}`,
      week: weekLabel(week),
      me: { name: A.name, avatar: A.avatar },
      opp: { name: B.name, avatar: B.avatar },
    },
    state: {
      my: fmt(sa.score),
      opp: fmt(sb.score),
      myProj: fmt(sa.proj, 1),
      oppProj: fmt(sb.proj, 1),
      lead: Math.sign(Math.round(sa.score * 100) - Math.round(sb.score * 100)),
      win: Math.round(pA * 100),
      status: final ? 'final' : started ? 'live' : 'upcoming',
      detail,
      myColor: hex(t.team(A.color)),
      oppColor: hex(t.team(B.color)),
      accent: hex(t.c.accent),
    },
  }
}

/**
 * Keeps the Live Activity in step with your matchup while it's turned on. Mounted once at the root as a component of
 * its own, so the simulation feed (many updates a second) re-renders only this, not the navigator.
 */
export function MatchupActivitySync() {
  useMatchupActivity()
  return null
}

function useMatchupActivity() {
  const on = usePrefs((p) => p.liveActivity) && LiveActivity !== null
  const league = useGameLeague()
  const t = useTheme()
  // read when an update goes out, so a simulation tick only schedules one and never re-renders anything
  const inputs = useRef({ on, league, t })
  inputs.current = { on, league, t }
  const sent = useRef({ key: '', at: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!LiveActivity) return
    const send = () => {
      timer.current = null
      const { on, league, t } = inputs.current
      const snap = on && league ? snapshot(league, useLiveSim.getState(), t) : null
      const next = snap && ([JSON.stringify(snap.attributes), JSON.stringify(snap.state)] as const)
      const key = next ? next.join() : ''
      if (key === sent.current.key) return
      sent.current = { key, at: Date.now() }
      ;(next ? LiveActivity!.sync(next[0], next[1]) : LiveActivity!.end()).catch(() => {
        // not allowed (Live Activities off in iOS Settings) or Seam in the background: the next change tries again
        sent.current.key = ''
      })
    }
    // at most one update a second (a simulation ticks far faster), always ending on the latest
    const schedule = () => {
      timer.current ??= setTimeout(send, Math.max(0, sent.current.at + 1000 - Date.now()))
    }
    schedule()
    return on ? useLiveSim.subscribe(schedule) : undefined
  }, [on, league, t])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
}
