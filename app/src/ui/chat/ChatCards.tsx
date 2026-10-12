import {
  ArrowLeftRight, Check, CircleDollarSign, Gavel, Hourglass, LayoutGrid, Minus, Plus, Trophy, X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { ChatEvent, ChatMessage } from '../../engine/chat'
import { restOfSeason } from '../../engine/data'
import {
  managerName, matchupsForWeek, matchupWinner, REG_WEEKS, standings,
  type TradeOffer, type TradeStatus,
} from '../../engine/league'
import { fmt } from '../../engine/scoring'
import { getData, ME, useApp } from '../../store'
import { FTeamAvatar, PlayerAvatar, RoleTag, TeamChip } from '../common'
import { weekLabel } from '../format'
import { teamLabel, tradeLine, who } from './chatText'
import { useShallow } from 'zustand/react/shallow'

const STATUS: Record<TradeStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending', tone: 'gold' },
  review: { label: 'In review', tone: 'sky' },
  approved: { label: 'Processed', tone: 'ok' },
  declined: { label: 'Declined', tone: 'bad' },
  withdrawn: { label: 'Withdrawn', tone: '' },
  expired: { label: 'Expired', tone: '' },
  vetoed: { label: 'Vetoed', tone: 'bad' },
  failed: { label: 'Failed', tone: 'bad' },
}

// ---------------------------------------------------------------- building blocks

function PlayerLine({ p, value, tone }: { p: number; value?: number; tone?: 'add' | 'drop' }) {
  const d = getData()
  const openPlayer = useApp((s) => s.openPlayer)
  const pl = d.players[p]
  return (
    <button className="cc-player" onClick={() => openPlayer(p)}>
      {tone && <span className={`cc-sign ${tone}`}>{tone === 'add' ? <Plus size={12} /> : <Minus size={12} />}</span>}
      <PlayerAvatar p={pl} size="sm" />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="cc-pname ellipsis">{pl.name}</span>
        <span className="pmeta" style={{ marginTop: 1 }}>
          <TeamChip code={pl.team} /> <RoleTag p={pl} />
        </span>
      </span>
      {value !== undefined && <span className="num muted" style={{ fontSize: 13 }} title="Rest-of-season projection">{fmt(value, 0)}</span>}
    </button>
  )
}

function Card({ icon, tone, title, aside, children, className = '' }: { icon: ReactNode; tone: string; title: ReactNode; aside?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`cc ${className}`} style={{ ['--cc' as string]: tone }}>
      <div className="cc-h">
        <span className="cc-ic">{icon}</span>
        <div className="grow cc-title">{title}</div>
        {aside}
      </div>
      {children}
    </div>
  )
}

export function SystemLine({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="sys-line">
      {icon}
      <span>{children}</span>
    </div>
  )
}

// ---------------------------------------------------------------- event message

export function EventMessage({ m, inDm }: { m: ChatMessage; inDm: boolean }) {
  const league = useApp((s) => s.league)!
  const e = m.event!
  switch (e.type) {
    case 'league-created':
      return (
        <SystemLine icon={<Gavel size={13} />}>
          <b>{league.name}</b> was created. {league.commissionerId === ME ? 'You are' : `${managerName(league.teams[league.commissionerId])} is`} the commissioner.
        </SystemLine>
      )
    case 'draft-complete':
      return (
        <Card icon={<LayoutGrid size={15} />} tone="var(--turf)" title="The draft is complete">
          <div className="cc-b dim" style={{ fontSize: 13 }}>
            {league.draft.rounds} rounds, {league.numTeams} teams, {league.draft.picks.length} picks. Set your lineup — Week 1 is up next.
          </div>
        </Card>
      )
    case 'txn':
      return <TxnCard teamId={e.teamId} adds={e.adds} drops={e.drops} />
    case 'waivers':
      return <WaiversCard e={e} />
    case 'week-result':
      return <WeekResultCard week={e.week} />
    case 'playoffs-set':
      return <PlayoffsCard />
    case 'champion':
      return (
        <Card icon={<Trophy size={15} />} tone="var(--gold)" title={<><b>{league.teams[e.teamId].name}</b> are the champions</>} className="cc-champ">
          <div className="cc-b row" style={{ gap: 12 }}>
            <FTeamAvatar t={league.teams[e.teamId]} size="lg" />
            <div className="dim" style={{ fontSize: 13 }}>
              {managerName(league.teams[e.teamId])} {e.teamId === ME ? 'win' : 'wins'} the {league.name}. 🏆
            </div>
          </div>
        </Card>
      )
    case 'trade': {
      const t = league.trades.find((x) => x.id === e.tradeId)
      if (!t) return null
      if (inDm && e.stage === 'proposed') return <TradeOfferCard t={t} />
      if (inDm) return <SystemLine icon={<ArrowLeftRight size={13} />}>{tradeLine(league, t, e)}</SystemLine>
      return <LeagueTradeCard t={t} stage={e.stage} by={e.by ?? null} />
    }
  }
}

function TxnCard({ teamId, adds, drops }: { teamId: number; adds: number[]; drops: number[] }) {
  const league = useApp((s) => s.league)!
  const t = league.teams[teamId]
  const verb = adds.length && drops.length ? 'added and dropped' : adds.length ? 'added' : 'dropped'
  return (
    <Card
      icon={adds.length ? <Plus size={15} /> : <Minus size={15} />}
      tone={adds.length ? 'var(--turf)' : 'var(--loss)'}
      title={<span className="row" style={{ gap: 8 }}><FTeamAvatar t={t} size="sm" /><span><b>{teamLabel(league, teamId)}</b> <span className="dim">{verb}</span></span></span>}
      aside={<span className="chip">Free agency</span>}
    >
      <div className="cc-b cc-players">
        {adds.map((p) => <PlayerLine key={p} p={p} tone="add" />)}
        {drops.map((p) => <PlayerLine key={p} p={p} tone="drop" />)}
      </div>
    </Card>
  )
}

function WaiversCard({ e }: { e: Extract<ChatEvent, { type: 'waivers' }> }) {
  const league = useApp((s) => s.league)!
  const d = getData()
  const openPlayer = useApp((s) => s.openPlayer)
  return (
    <Card icon={<CircleDollarSign size={15} />} tone="var(--gold)" title={<><b>Waivers processed</b> <span className="dim">· after {weekLabel(e.week)}</span></>}>
      <div className="cc-b" style={{ display: 'grid', gap: 8 }}>
        {e.claims.map((c, i) => (
          <div key={i} className="cc-claim">
            <FTeamAvatar t={league.teams[c.teamId]} size="sm" />
            <div className="grow" style={{ minWidth: 0, fontSize: 13, lineHeight: 1.5 }}>
              <b>{teamLabel(league, c.teamId)}</b>
              <div>
                <span className="turf">+ </span>
                <b className="link" onClick={() => openPlayer(c.add)}>{d.players[c.add].name}</b>
                {c.drop !== null && (
                  <>
                    <span className="loss"> &nbsp;− </span>
                    <span className="link muted" onClick={() => openPlayer(c.drop!)}>{d.players[c.drop].name}</span>
                  </>
                )}
              </div>
            </div>
            <span className="chip gold">${c.bid}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function WeekResultCard({ week }: { week: number }) {
  const league = useApp((s) => s.league)!
  const { setTab, setViewWeek } = useApp(useShallow((s) => ({ setTab: s.setTab, setViewWeek: s.setViewWeek })))
  const r = league.results[week]
  if (!r) return null
  const ms = matchupsForWeek(league, week).sort((a, b) => Number(b.a === ME || b.b === ME) - Number(a.a === ME || a.b === ME))
  return (
    <Card
      icon={<Trophy size={15} />}
      tone="var(--sky)"
      title={<b>{weekLabel(week)} final</b>}
      aside={<button className="btn xs" onClick={() => { setViewWeek(week); setTab('matchup') }}>View</button>}
    >
      <div className="cc-b" style={{ display: 'grid', gap: 4 }}>
        {ms.map((m, i) => {
          const w = matchupWinner(league, m)
          const mine = m.a === ME || m.b === ME
          return (
            <div key={i} className={`cc-score ${mine ? 'mine' : ''}`}>
              {m.label && <div className="cc-score-label">{m.label}</div>}
              {[m.a, m.b].map((id) => (
                <div key={id} className={`cc-score-row ${w === id ? 'won' : ''}`}>
                  <FTeamAvatar t={league.teams[id]} size="sm" />
                  <span className="grow ellipsis">{league.teams[id].name}{id === ME && <span className="dim"> (you)</span>}</span>
                  <span className="num">{fmt(r.scores[id], 1)}</span>
                </div>
              ))}
            </div>
          )
        })}
        {r.median !== null && week <= REG_WEEKS && <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>League median {fmt(r.median, 1)} · beat it for an extra win</div>}
      </div>
    </Card>
  )
}

function PlayoffsCard() {
  const league = useApp((s) => s.league)!
  const setTab = useApp((s) => s.setTab)
  const top = standings(league).slice(0, 4)
  return (
    <Card icon={<Trophy size={15} />} tone="var(--gold)" title={<b>The playoff bracket is set</b>} aside={<button className="btn xs" onClick={() => setTab('playoffs')}>Bracket</button>}>
      <div className="cc-b" style={{ display: 'grid', gap: 6 }}>
        {top.map((s, i) => (
          <div key={s.teamId} className="row" style={{ gap: 10, fontSize: 13 }}>
            <span className="num dim" style={{ width: 14 }}>{i + 1}</span>
            <FTeamAvatar t={league.teams[s.teamId]} size="sm" />
            <span className="grow ellipsis">{league.teams[s.teamId].name}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- trades

function TradeSides({ t, perspective }: { t: TradeOffer; perspective: 'me' | 'league' }) {
  const league = useApp((s) => s.league)!
  const d = getData()
  const ros = (p: number) => restOfSeason(d, d.players[p], league.played)
  // `give` moves from → to, `get` moves to → from
  const sides =
    perspective === 'me'
      ? t.from === ME
        ? [{ label: 'You get', ps: t.get }, { label: 'You give', ps: t.give }]
        : [{ label: 'You get', ps: t.give }, { label: 'You give', ps: t.get }]
      : [{ label: `${teamLabel(league, t.from)} get${t.from === ME ? '' : 's'}`, ps: t.get }, { label: `${teamLabel(league, t.to)} get${t.to === ME ? '' : 's'}`, ps: t.give }]
  const live = t.status === 'pending' || t.status === 'review'
  return (
    <div className="cc-sides">
      {sides.map((s) => (
        <div key={s.label} className="cc-side">
          <div className="cc-side-h">
            <span className="up dim">{s.label}</span>
            {live && <span className="num dim" style={{ fontSize: 12 }}>{fmt(s.ps.reduce((a, p) => a + ros(p), 0), 0)} proj</span>}
          </div>
          {s.ps.map((p) => <PlayerLine key={p} p={p} value={live ? ros(p) : undefined} />)}
        </div>
      ))}
    </div>
  )
}

function CommishActions({ t }: { t: TradeOffer }) {
  const league = useApp((s) => s.league)!
  const { reviewTrade, notify } = useApp(useShallow((s) => ({ reviewTrade: s.reviewTrade, notify: s.notify })))
  if (t.status !== 'review' || league.commissionerId !== ME) return null
  return (
    <div className="cc-actions">
      <span className="dim grow" style={{ fontSize: 12 }}>
        <Gavel size={12} style={{ verticalAlign: -1 }} /> You're the commissioner. Processes automatically when the next match starts.
      </span>
      <button className="btn sm danger" onClick={() => { reviewTrade(t.id, false); notify('Trade vetoed', 'info') }}>
        <X size={14} /> Veto
      </button>
      <button
        className="btn sm primary"
        onClick={() => {
          const err = reviewTrade(t.id, true)
          notify(err ?? 'Trade approved and processed', err ? 'bad' : 'ok')
        }}
      >
        <Check size={14} /> Approve
      </button>
    </div>
  )
}

function LeagueTradeCard({ t, stage, by }: { t: TradeOffer; stage: TradeStage; by: number | null }) {
  const league = useApp((s) => s.league)!
  const head =
    stage === 'review'
      ? { title: t.status === 'review' ? 'Trade pending review' : 'Trade sent for review', tone: 'var(--gold)', icon: <Hourglass size={15} /> }
      : stage === 'approved'
        ? { title: 'Trade processed', tone: 'var(--turf)', icon: <ArrowLeftRight size={15} /> }
        : stage === 'vetoed'
          ? { title: 'Trade vetoed', tone: 'var(--loss)', icon: <Gavel size={15} /> }
          : { title: 'Trade failed', tone: 'var(--loss)', icon: <X size={15} /> }
  const foot =
    stage === 'approved'
      ? by === null ? 'Review period ended with no veto.' : `Approved by the commissioner (${who(league, by)}).`
      : stage === 'vetoed'
        ? `Vetoed by the commissioner (${by === null ? 'league' : who(league, by)}).`
        : stage === 'failed'
          ? t.reason
          : t.status !== 'review'
            ? `Outcome: ${STATUS[t.status].label.toLowerCase()}`
            : null
  return (
    <Card icon={head.icon} tone={head.tone} title={<b>{head.title}</b>} aside={stage === 'review' && <span className={`chip ${STATUS[t.status].tone}`}>{STATUS[t.status].label}</span>}>
      <div className="cc-b">
        <TradeSides t={t} perspective="league" />
        {foot && <div className="dim" style={{ fontSize: 12, marginTop: 10 }}>{foot}</div>}
      </div>
      {stage === 'review' && <CommishActions t={t} />}
    </Card>
  )
}

type TradeStage = Extract<ChatEvent, { type: 'trade' }>['stage']

export function TradeOfferCard({ t }: { t: TradeOffer }) {
  const league = useApp((s) => s.league)!
  const { respondTrade, withdrawTrade, notify } = useApp(useShallow((s) => ({ respondTrade: s.respondTrade, withdrawTrade: s.withdrawTrade, notify: s.notify })))
  const st = STATUS[t.status]
  const incoming = t.to === ME
  const other = incoming ? t.from : t.to
  return (
    <Card
      className="cc-offer"
      icon={<ArrowLeftRight size={15} />}
      tone="var(--sky)"
      title={<><b>Trade offer</b> <span className="dim">· {incoming ? `from ${who(league, t.from)}` : `to ${who(league, t.to)}`}</span></>}
      aside={<span className={`chip ${st.tone}`}>{st.label}</span>}
    >
      <div className="cc-b">
        {t.note && <div className="cc-note">“{t.note}”</div>}
        <TradeSides t={t} perspective="me" />
        <div className="dim" style={{ fontSize: 12, marginTop: 10 }}>
          {t.status === 'pending' && (incoming ? `Expires at the end of ${weekLabel(t.expiresWeek)}.` : `Waiting on ${who(league, other)}…`)}
          {t.status === 'review' && (league.commissionerId === ME ? 'Accepted. As commissioner, approve or veto it in the league chat.' : 'Accepted. Waiting on the commissioner.')}
          {t.status === 'approved' && 'Done. The players have moved.'}
          {t.status === 'failed' && t.reason}
        </div>
      </div>
      {t.status === 'pending' && (
        <div className="cc-actions">
          <div className="grow" />
          {incoming ? (
            <>
              <button className="btn sm" onClick={() => respondTrade(t.id, false)}>
                <X size={14} /> Decline
              </button>
              <button
                className="btn sm primary"
                onClick={() => {
                  const err = respondTrade(t.id, true)
                  if (err) notify(err, 'bad')
                }}
              >
                <Check size={14} /> Accept
              </button>
            </>
          ) : (
            <button className="btn sm" onClick={() => withdrawTrade(t.id)}>Withdraw</button>
          )}
        </div>
      )}
      <CommishActions t={t} />
    </Card>
  )
}
