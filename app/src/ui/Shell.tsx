import {
  Activity, BookOpen, CalendarDays, ChevronDown, FastForward, LayoutGrid, ListOrdered, Play,
  RotateCcw, SkipForward, Swords, Trophy, Users, UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { currentWeek, LAST_WEEK, REG_WEEKS } from '../engine/league'
import { getData, useApp, type Tab } from '../store'
import { FTeamAvatar, fmtDate, Logo, TeamChip, weekLabel } from './common'
import { ActivityView } from './views/ActivityView'
import { DraftRecapView } from './views/DraftRecapView'
import { FixturesView } from './views/FixturesView'
import { LeagueView } from './views/LeagueView'
import { MatchupView } from './views/MatchupView'
import { PlayersView } from './views/PlayersView'
import { PlayoffsView } from './views/PlayoffsView'
import { ScoringView } from './views/ScoringView'
import { TeamView } from './views/TeamView'

const NAV: { k: Tab; label: string; icon: typeof Swords }[] = [
  { k: 'matchup', label: 'Matchup', icon: Swords },
  { k: 'team', label: 'My Team', icon: UserRound },
  { k: 'players', label: 'Players', icon: Users },
  { k: 'league', label: 'Standings', icon: ListOrdered },
  { k: 'playoffs', label: 'Playoffs', icon: Trophy },
  { k: 'fixtures', label: 'IPL Fixtures', icon: CalendarDays },
  { k: 'activity', label: 'Activity', icon: Activity },
  { k: 'draft', label: 'Draft Board', icon: LayoutGrid },
  { k: 'scoring', label: 'Scoring', icon: BookOpen },
]

export function Shell() {
  const { tab, setTab } = useApp()
  const league = useApp((s) => s.league)!
  const me = league.teams[0]
  const mainRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <Logo size={32} />
          <div>
            <div className="brand-name">SEAM</div>
            <div className="brand-sub">Fantasy cricket</div>
          </div>
        </div>
        <div className="league-card">
          <FTeamAvatar t={me} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 700, fontSize: 13 }}>{me.name}</div>
            <div className="dim ellipsis" style={{ fontSize: 11 }}>{league.name}</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n, i) => (
            <div key={n.k} style={{ display: 'contents' }}>
              {(i === 5 || i === 7) && <div className="sep" />}
              <button className={tab === n.k ? 'on' : ''} onClick={() => setTab(n.k)}>
                <n.icon size={18} />
                {n.label}
              </button>
            </div>
          ))}
        </nav>
        <div className="side-foot">
          Data: Cricsheet.org (ODC-BY)
          <br />
          IPL {getData().raw.simSeason} replay · local prototype
        </div>
      </aside>
      <div className="main" ref={mainRef}>
        <ClockBar />
        <div className="content">
          {tab === 'matchup' && <MatchupView />}
          {tab === 'team' && <TeamView />}
          {tab === 'players' && <PlayersView />}
          {tab === 'league' && <LeagueView />}
          {tab === 'playoffs' && <PlayoffsView />}
          {tab === 'fixtures' && <FixturesView />}
          {tab === 'activity' && <ActivityView />}
          {tab === 'draft' && <DraftRecapView />}
          {tab === 'scoring' && <ScoringView />}
        </div>
      </div>
    </div>
  )
}

function ClockBar() {
  const d = getData()
  const league = useApp((s) => s.league)!
  const { simMatch, simWeek, simTo, openLive, reset, notify } = useApp()
  const [menu, setMenu] = useState(false)
  const done = league.played >= d.matches.length
  const week = currentWeek(d, league)
  const gw = d.gameweeks[week - 1]
  const inWeek = gw.mis.filter((mi) => mi < league.played).length
  const next = done ? null : d.matches[league.played]

  const confirmReset = () => {
    if (confirm('Delete this league and start over?')) reset()
  }

  return (
    <div className="clockbar">
      <div className="gw-badge">
        <span>{week > REG_WEEKS ? 'PLAYOFF' : 'WEEK'}</span>
        <b>{week > REG_WEEKS ? (week === 7 ? 'SF' : 'F') : week}</b>
      </div>
      <div style={{ minWidth: 150 }}>
        <div style={{ fontWeight: 700 }}>{done ? 'Season complete' : weekLabel(week)}</div>
        <div className="dim" style={{ fontSize: 12 }}>
          {fmtDate(gw.start, false)} – {fmtDate(gw.end, false)} · {inWeek}/{gw.mis.length} matches
        </div>
        <div className="progress" style={{ marginTop: 6, width: 150 }}>
          <i style={{ width: `${(inWeek / gw.mis.length) * 100}%` }} />
        </div>
      </div>
      {next && (
        <div className="next-match">
          <span className="chip live" style={{ height: 22 }}>NEXT</span>
          <div className="row" style={{ gap: 6 }}>
            <TeamChip code={next.teams[0]} />
            <span className="dim" style={{ fontSize: 11 }}>v</span>
            <TeamChip code={next.teams[1]} />
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            {fmtDate(next.raw.date)} · {next.raw.time}
          </span>
        </div>
      )}
      <div className="grow" />
      {!done && league.phase === 'season' && (
        <>
          <button className="btn live" onClick={() => openLive(league.played)}>
            <Play size={15} fill="currentColor" /> Watch live
          </button>
          <button className="btn" onClick={simMatch} title="Instantly sim the next IPL match">
            <SkipForward size={15} /> Sim match
          </button>
          <button
            className="btn"
            onClick={() => {
              simWeek()
              notify(`${weekLabel(week)} complete`, 'info')
            }}
          >
            <FastForward size={15} /> Sim week
          </button>
        </>
      )}
      <div style={{ position: 'relative' }}>
        <button className="btn icon" onClick={() => setMenu(!menu)} aria-label="More">
          <ChevronDown size={16} />
        </button>
        {menu && (
          <div className="card" style={{ position: 'absolute', right: 0, top: 44, width: 220, padding: 6, zIndex: 30 }} onMouseLeave={() => setMenu(false)}>
            {!done && week <= REG_WEEKS && (
              <MenuItem onClick={() => { simTo(REG_WEEKS); setMenu(false) }} icon={<FastForward size={15} />}>
                Sim to playoffs
              </MenuItem>
            )}
            {!done && (
              <MenuItem onClick={() => { simTo(LAST_WEEK); setMenu(false) }} icon={<Trophy size={15} />}>
                Sim entire season
              </MenuItem>
            )}
            <MenuItem onClick={confirmReset} icon={<RotateCcw size={15} />} danger>
              Reset league
            </MenuItem>
          </div>
        )}
      </div>
    </div>
  )
}

function MenuItem({ children, onClick, icon, danger }: { children: ReactNode; onClick: () => void; icon: ReactNode; danger?: boolean }) {
  return (
    <button className={`btn ghost ${danger ? 'danger' : ''}`} style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 10 }} onClick={onClick}>
      {icon} {children}
    </button>
  )
}
