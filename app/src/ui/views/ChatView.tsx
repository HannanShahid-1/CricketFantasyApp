import { ArrowLeft, ArrowLeftRight, Gavel, SendHorizontal, SmilePlus } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  channelMembers, dmChannel, dmPartner, isDm, lastMessage, LEAGUE_CHANNEL, messagesIn, REACTIONS, readCursor, unreadCount,
  type ChannelId, type ChatMessage,
} from '../../engine/chat'
import { currentWeek, managerName, PERSONA_LABEL, TRADE_DEADLINE_WEEK, type FTeam, type League } from '../../engine/league'
import { getData, ME, useApp } from '../../store'
import { EventMessage } from '../chat/ChatCards'
import { fmtAgo, fmtClock, previewText } from '../chat/chatText'
import { FTeamAvatar, Logo } from '../common'
import { fmtDate, weekLabel } from '../format'

const GROUP_MS = 5 * 60 * 1000
const NOBODY: number[] = []

export function ChatView() {
  const league = useApp((s) => s.league)!
  const channel = useApp((s) => s.chatChannel)
  const openChat = useApp((s) => s.openChat)
  const [mobileConvo, setMobileConvo] = useState(true)

  const dms = useMemo(
    () =>
      league.teams
        .filter((t) => t.id !== ME)
        .map((t) => ({ t, ch: dmChannel(ME, t.id), last: lastMessage(league.chat, dmChannel(ME, t.id)) }))
        .sort((a, b) => (b.last?.id ?? 0) - (a.last?.id ?? 0) || a.t.name.localeCompare(b.t.name)),
    [league],
  )
  const select = (ch: ChannelId) => {
    openChat(ch)
    setMobileConvo(true)
  }

  return (
    <div className={`chat ${mobileConvo ? 'show-convo' : ''}`}>
      <aside className="chat-list">
        <div className="chat-list-h">
          <h2>Chat</h2>
        </div>
        <ConvoItem
          on={channel === LEAGUE_CHANNEL}
          onClick={() => select(LEAGUE_CHANNEL)}
          avatar={<div className="league-av"><Logo size={22} /></div>}
          name={league.name}
          sub={`${league.numTeams} managers`}
          last={lastMessage(league.chat, LEAGUE_CHANNEL)}
          unread={unreadCount(league.chat, LEAGUE_CHANNEL, ME)}
          inDm={false}
        />
        <div className="chat-list-label up dim">Direct messages</div>
        {dms.map(({ t, ch, last }) => (
          <ConvoItem
            key={ch}
            on={channel === ch}
            onClick={() => select(ch)}
            avatar={<FTeamAvatar t={t} />}
            name={managerName(t)}
            sub={t.name}
            last={last}
            unread={unreadCount(league.chat, ch, ME)}
            inDm
          />
        ))}
      </aside>
      <Conversation key={channel} channel={channel} onBack={() => setMobileConvo(false)} />
    </div>
  )
}

function ConvoItem({ on, onClick, avatar, name, sub, last, unread, inDm }: {
  on: boolean; onClick: () => void; avatar: ReactNode; name: string; sub: string
  last?: ChatMessage; unread: number; inDm: boolean
}) {
  const league = useApp((s) => s.league)!
  return (
    <button className={`convo ${on ? 'on' : ''} ${unread ? 'unread' : ''}`} onClick={onClick}>
      {avatar}
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6 }}>
          <span className="convo-name ellipsis">{name}</span>
          <span className="grow" />
          {last && <span className="convo-time">{fmtAgo(last.at)}</span>}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 2 }}>
          <span className="convo-prev ellipsis">{last ? previewText(league, last, inDm) : sub}</span>
          <span className="grow" />
          {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------- conversation

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'new'; key: string }
  | { kind: 'event'; key: string; m: ChatMessage }
  | { kind: 'group'; key: string; author: number; msgs: ChatMessage[] }

function buildRows(msgs: ChatMessage[], firstUnread: number | null): Row[] {
  const rows: Row[] = []
  let day = ''
  for (const m of msgs) {
    const dayKey = `${m.week}|${m.date}`
    if (dayKey !== day) {
      day = dayKey
      rows.push({ kind: 'day', key: `d${m.id}`, label: `${weekLabel(m.week)} · ${fmtDate(m.date)}` })
    }
    if (m.id === firstUnread) rows.push({ kind: 'new', key: 'new' })
    if (m.author === null || !m.text) {
      rows.push({ kind: 'event', key: `e${m.id}`, m })
      continue
    }
    const prev = rows[rows.length - 1]
    if (prev?.kind === 'group' && prev.author === m.author && m.at - prev.msgs[prev.msgs.length - 1].at < GROUP_MS) prev.msgs.push(m)
    else rows.push({ kind: 'group', key: `g${m.id}`, author: m.author, msgs: [m] })
  }
  return rows
}

/** A single conversation. `compact` is the docked league chat on the Matchup screen. */
export function Conversation({ channel, onBack, compact, action }: { channel: ChannelId; onBack?: () => void; compact?: boolean; action?: ReactNode }) {
  const league = useApp((s) => s.league)!
  const typing = useApp((s) => s.typing[channel] ?? NOBODY)
  const markRead = useApp((s) => s.markRead)
  const msgs = useMemo(() => messagesIn(league.chat, channel), [league.chat, channel])
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  // "New messages" divider: where the unread run started when this conversation was opened
  const [firstUnread] = useState<number | null>(() => {
    const seen = readCursor(league.chat, channel, ME)?.id ?? 0
    return msgs.find((m) => m.id > seen && m.author !== ME)?.id ?? null
  })
  const rows = useMemo(() => buildRows(msgs, firstUnread), [msgs, firstUnread])
  const seen = useSeenPositions(league, channel, msgs)

  useEffect(() => {
    const mark = () => document.visibilityState === 'visible' && markRead(channel)
    mark()
    window.addEventListener('focus', mark)
    document.addEventListener('visibilitychange', mark)
    return () => {
      window.removeEventListener('focus', mark)
      document.removeEventListener('visibilitychange', mark)
    }
  }, [channel, msgs.length, markRead])

  // open at the unread divider (or the bottom), then follow new messages while at the bottom
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const div = el.querySelector('.new-divider') as HTMLElement | null
    el.scrollTop = div ? div.offsetTop - 80 : el.scrollHeight
  }, [])
  const lastMine = msgs.length > 0 && msgs[msgs.length - 1].author === ME
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && (stick.current || lastMine)) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [msgs.length, typing.length, lastMine])

  return (
    <section className={`convo-pane ${compact ? 'compact' : ''}`}>
      {compact ? <DockHeader action={action} /> : <ConvoHeader channel={channel} onBack={onBack ?? (() => {})} />}
      <div
        className="msgs"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
        }}
      >
        {msgs.length === 0 && <EmptyConvo channel={channel} />}
        {rows.map((r) => {
          if (r.kind === 'day') return <div key={r.key} className="day-sep"><span>{r.label}</span></div>
          if (r.kind === 'new') return <div key={r.key} className="new-divider"><span>New messages</span></div>
          if (r.kind === 'event')
            return (
              <Fragment key={r.key}>
                <div className="msg-event"><EventMessage m={r.m} inDm={isDm(channel)} /></div>
                <SeenRow ids={seen.get(r.m.id)} mine={false} dm={isDm(channel)} />
              </Fragment>
            )
          return <Group key={r.key} channel={channel} author={r.author} msgs={r.msgs} seen={seen} />
        })}
        {typing.length > 0 && <Typing ids={typing} channel={channel} />}
      </div>
      <Composer channel={channel} autoFocus={!compact} />
    </section>
  )
}

function DockHeader({ action }: { action?: ReactNode }) {
  const league = useApp((s) => s.league)!
  const commish = league.teams[league.commissionerId]
  return (
    <header className="convo-h">
      <div className="league-av sm"><Logo size={16} /></div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="convo-h-name ellipsis">League chat</div>
        <div className="convo-h-sub ellipsis">
          {league.numTeams} managers · <Gavel size={11} style={{ verticalAlign: -1 }} /> {commish.id === ME ? 'You' : managerName(commish)}
        </div>
      </div>
      {action}
    </header>
  )
}

function ConvoHeader({ channel, onBack }: { channel: ChannelId; onBack: () => void }) {
  const league = useApp((s) => s.league)!
  const openTrade = useApp((s) => s.openTrade)
  const d = getData()
  const back = (
    <button className="btn icon ghost chat-back" onClick={onBack} aria-label="Back to conversations">
      <ArrowLeft size={18} />
    </button>
  )
  if (!isDm(channel)) {
    const commish = league.teams[league.commissionerId]
    return (
      <header className="convo-h">
        {back}
        <div className="league-av"><Logo size={22} /></div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="convo-h-name ellipsis">{league.name}</div>
          <div className="convo-h-sub ellipsis">
            {league.numTeams} managers · <Gavel size={11} style={{ verticalAlign: -1 }} /> Commissioner: {commish.id === ME ? 'You' : managerName(commish)}
          </div>
        </div>
        <div className="av-stack hide-sm">
          {league.teams.slice(0, 6).map((t) => <FTeamAvatar key={t.id} t={t} size="sm" />)}
          {league.teams.length > 6 && <span className="av-more">+{league.teams.length - 6}</span>}
        </div>
      </header>
    )
  }
  const t = league.teams[dmPartner(channel, ME)]
  const closed = currentWeek(d, league) >= TRADE_DEADLINE_WEEK || league.phase !== 'season'
  return (
    <header className="convo-h">
      {back}
      <FTeamAvatar t={t} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="convo-h-name ellipsis">{managerName(t)}</div>
        <div className="convo-h-sub ellipsis">{t.name} · {PERSONA_LABEL[t.persona]}</div>
      </div>
      <button className="btn sm" disabled={closed} title={closed ? 'Trades are closed' : undefined} onClick={() => openTrade(t.id)}>
        <ArrowLeftRight size={14} /> Propose trade
      </button>
    </header>
  )
}

function EmptyConvo({ channel }: { channel: ChannelId }) {
  const league = useApp((s) => s.league)!
  if (!isDm(channel)) return <div className="chat-empty">Say hi to the league 👋</div>
  const t = league.teams[dmPartner(channel, ME)]
  return (
    <div className="chat-empty">
      <FTeamAvatar t={t} size="lg" />
      <div style={{ fontWeight: 700, marginTop: 10 }}>{managerName(t)}</div>
      <div className="dim" style={{ fontSize: 13 }}>{t.name}. Messages and trade offers between you two show up here.</div>
    </div>
  )
}

function Author({ t, commish }: { t: FTeam; commish: boolean }) {
  return (
    <div className="msg-author">
      <b>{managerName(t)}</b>
      <span className="dim">{t.name}</span>
      {commish && <span className="commish" title="Commissioner"><Gavel size={10} /> Commish</span>}
    </div>
  )
}

function Group({ channel, author, msgs, seen }: { channel: ChannelId; author: number; msgs: ChatMessage[]; seen: Map<number, number[]> }) {
  const league = useApp((s) => s.league)!
  const mine = author === ME
  const t = league.teams[author]
  return (
    <div className={`msg-group ${mine ? 'mine' : ''}`}>
      {!mine && <FTeamAvatar t={t} size="sm" />}
      <div className="msg-col">
        {!mine && !isDm(channel) && <Author t={t} commish={league.commissionerId === author} />}
        {msgs.map((m, i) => (
          <Fragment key={m.id}>
            <Bubble m={m} mine={mine} first={i === 0} last={i === msgs.length - 1} />
            <SeenRow ids={seen.get(m.id)} mine={mine} dm={isDm(channel)} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function Bubble({ m, mine, first, last }: { m: ChatMessage; mine: boolean; first: boolean; last: boolean }) {
  const league = useApp((s) => s.league)!
  const react = useApp((s) => s.react)
  const [picker, setPicker] = useState(false)
  const reactions = Object.entries(m.reactions ?? {})
  return (
    <div className={`bubble-wrap ${mine ? 'mine' : ''}`} onMouseLeave={() => setPicker(false)}>
      <div className={`bubble ${mine ? 'mine' : ''} ${first ? 'first' : ''} ${last ? 'last' : ''}`} title={fmtClock(m.at)}>
        {m.text}
      </div>
      <div className={`react-bar ${picker ? 'open' : ''}`}>
        {picker ? (
          REACTIONS.map((e) => (
            <button key={e} onClick={() => { react(m.id, e); setPicker(false) }}>{e}</button>
          ))
        ) : (
          <button onClick={() => setPicker(true)} aria-label="React"><SmilePlus size={15} /></button>
        )}
      </div>
      {last && <span className="msg-time">{fmtClock(m.at)}</span>}
      {reactions.length > 0 && (
        <div className="reactions">
          {reactions.map(([e, who]) => (
            <button
              key={e}
              className={`reaction ${who.includes(ME) ? 'me' : ''}`}
              onClick={() => react(m.id, e)}
              title={who.map((id) => (id === ME ? 'You' : managerName(league.teams[id]))).join(', ')}
            >
              {e} <span>{who.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** For each message, the other members whose read cursor stops there. */
function useSeenPositions(league: League, channel: ChannelId, msgs: ChatMessage[]) {
  return useMemo(() => {
    const at = new Map<number, number[]>()
    const members = channelMembers(channel, league.teams.map((t) => t.id)).filter((id) => id !== ME)
    for (const id of members) {
      const c = readCursor(league.chat, channel, id)
      if (!c) continue
      let pos: ChatMessage | undefined
      for (const m of msgs) if (m.id <= c.id) pos = m
      if (!pos || pos.author === id) continue
      at.set(pos.id, [...(at.get(pos.id) ?? []), id])
    }
    return at
  }, [league.chat, league.teams, channel, msgs])
}

function SeenRow({ ids, mine, dm }: { ids?: number[]; mine: boolean; dm?: boolean }) {
  const league = useApp((s) => s.league)!
  if (!ids?.length) return null
  const names = ids.map((id) => managerName(league.teams[id]))
  if (dm) {
    const c = readCursor(league.chat, dmChannel(ids[0], ME), ids[0])
    return <div className={`seen ${mine ? 'mine' : ''}`}>Seen{c ? ` ${fmtClock(c.at)}` : ''}</div>
  }
  return (
    <div className={`seen ${mine ? 'mine' : ''}`} title={`Seen by ${names.join(', ')}`}>
      <span className="seen-avs">
        {ids.slice(0, 5).map((id) => <span key={id} className="seen-av" style={{ background: league.teams[id].color }} />)}
      </span>
      {ids.length > 5 ? `+${ids.length - 5}` : ''}
    </div>
  )
}

function Typing({ ids, channel }: { ids: number[]; channel: ChannelId }) {
  const league = useApp((s) => s.league)!
  const names = ids.map((id) => managerName(league.teams[id]))
  return (
    <div className="msg-group typing-row">
      <FTeamAvatar t={league.teams[ids[0]]} size="sm" />
      <div className="msg-col">
        <div className="bubble typing first last" aria-label="typing"><i /><i /><i /></div>
        <div className="typing-label">
          {isDm(channel) ? `${names[0]} is typing` : names.length === 1 ? `${names[0]} is typing` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing`}
        </div>
      </div>
    </div>
  )
}

function Composer({ channel, autoFocus }: { channel: ChannelId; autoFocus: boolean }) {
  const league = useApp((s) => s.league)!
  const sendMessage = useApp((s) => s.sendMessage)
  const [text, setText] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  const target = isDm(channel) ? managerName(league.teams[dmPartner(channel, ME)]) : 'the league'

  useEffect(() => {
    if (autoFocus) ta.current?.focus()
  }, [channel, autoFocus])
  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [text])

  const send = () => {
    if (!text.trim()) return
    sendMessage(channel, text)
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }
  return (
    <div className="composer">
      <textarea
        ref={ta}
        rows={1}
        value={text}
        maxLength={1000}
        placeholder={`Message ${target}`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
      />
      <button className="send" onClick={send} disabled={!text.trim()} aria-label="Send">
        <SendHorizontal size={18} />
      </button>
    </div>
  )
}
