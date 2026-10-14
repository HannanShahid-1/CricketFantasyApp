import { CalendarRange, Gavel, Radio, Shuffle, Trophy } from 'lucide-react'
import { useState } from 'react'
import { SLOTS, type LeagueOptions } from '../engine/league'
import { getData, useApp } from '../store'
import { Logo } from './common'
import { DEFAULT_LEAGUE_OPTIONS, DRAFT_SPEEDS, draftSlotLabel, leagueFormat, PICK_TIMERS, setupFeatures, TEAM_COUNTS, type SetupFeature } from './draft'

const FEATURE_ICON: Record<SetupFeature, typeof Gavel> = { draft: Gavel, weeks: CalendarRange, live: Radio, moves: Shuffle }

export function Setup() {
  const newLeague = useApp((s) => s.newLeague)
  const d = getData()
  const [o, setO] = useState<LeagueOptions>(DEFAULT_LEAGUE_OPTIONS)
  const set = <K extends keyof LeagueOptions>(k: K, v: LeagueOptions[K]) => setO({ ...o, [k]: v })

  return (
    <div className="landing">
      <div className="hero">
        <div className="row" style={{ gap: 14 }}>
          <Logo size={52} />
          <div>
            <div className="brand-name" style={{ fontSize: 30 }}>SEAM</div>
            <div className="brand-sub">Season-long fantasy cricket</div>
          </div>
        </div>
        <h1>
          Draft your XI.
          <br />
          Own the <em>season.</em>
        </h1>
        <p>
          A Sleeper-style redraft league for the IPL. Snake draft against AI managers, set a weekly lineup,
          work the waiver wire and chase a title — replayed ball by ball from the real {d.raw.simSeason} season.
        </p>
        <div className="col" style={{ gap: 14, marginTop: 6 }}>
          {setupFeatures(d).map((f) => {
            const I = FEATURE_ICON[f.key]
            return (
              <div className="feature" key={f.key}>
                <div className="feature-ic">
                  <I size={17} />
                </div>
                <div>
                  <div style={{ fontWeight: 650 }}>{f.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{f.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="setup-panel">
        <div className="card setup-card col" style={{ gap: 16 }}>
          <div className="row">
            <Trophy size={18} className="gold" />
            <h2 className="display" style={{ margin: 0, fontSize: 20 }}>Create a league</h2>
          </div>
          <div className="seam" />
          <div className="field">
            <label>League name</label>
            <input className="input" value={o.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Your team name</label>
            <input className="input" value={o.teamName} onChange={(e) => set('teamName', e.target.value)} />
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field">
              <label>Teams</label>
              <div className="seg">
                {TEAM_COUNTS.map((n) => (
                  <button key={n} className={o.numTeams === n ? 'on' : ''} onClick={() => setO({ ...o, numTeams: n, draftSlot: 'random' })}>
                    {n} teams
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Draft slot</label>
              <select className="input" value={String(o.draftSlot)} onChange={(e) => set('draftSlot', e.target.value === 'random' ? 'random' : Number(e.target.value))}>
                <option value="random">{draftSlotLabel('random')}</option>
                {Array.from({ length: o.numTeams }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {draftSlotLabel(i + 1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid2" style={{ gap: 12 }}>
            <div className="field">
              <label>Pick timer</label>
              <select className="input" value={o.timer} onChange={(e) => set('timer', Number(e.target.value))}>
                {PICK_TIMERS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>AI pick speed</label>
              <select className="input" value={o.speed} onChange={(e) => set('speed', e.target.value as LeagueOptions['speed'])}>
                {DRAFT_SPEEDS.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="tile" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              {SLOTS.map((s, i) => (
                <span key={i} className={`slot ${s}`} style={{ minWidth: 0, padding: '0 5px', fontSize: 10, height: 20 }}>
                  {s}
                </span>
              ))}
            </div>
            <span className="muted">{leagueFormat().join(' · ')}</span>
          </div>
          <button className="btn primary" style={{ height: 46, fontSize: 15 }} onClick={() => newLeague(o)}>
            Enter the draft room
          </button>
        </div>
      </div>
    </div>
  )
}
