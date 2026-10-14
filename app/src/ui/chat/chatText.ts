// Text helpers for chat: conversation previews, notification lines, timestamps, unread totals, trade card copy.
import { dmChannel, isDm, LEAGUE_CHANNEL, unreadCount, type ChatEvent, type ChatMessage, type TradeStage } from '../../engine/chat'
import {
  currentWeek, managerName, TRADE_DEADLINE_WEEK, type League, type TradeOffer, type TradeStatus,
} from '../../engine/league'
import { getData, ME } from '../../store'
import { weekLabel } from '../format'

export const who = (l: League, id: number) => (id === ME ? 'You' : managerName(l.teams[id]))
export const teamLabel = (l: League, id: number) => (id === ME ? 'You' : l.teams[id].name)

/** One-line summary for the conversation list and notifications. */
export function previewText(l: League, m: ChatMessage, inDm: boolean): string {
  if (m.text) {
    if (m.author === ME) return `You: ${m.text}`
    return inDm || m.author === null ? m.text : `${managerName(l.teams[m.author])}: ${m.text}`
  }
  const e = m.event
  if (!e) return ''
  const d = getData()
  switch (e.type) {
    case 'league-created': return 'League created'
    case 'draft-complete': return 'The draft is complete'
    case 'txn': {
      const t = teamLabel(l, e.teamId)
      return e.adds.length ? `${t} added ${d.players[e.adds[0]].name}` : `${t} dropped ${d.players[e.drops[0]].name}`
    }
    case 'waivers': return `Waivers processed · ${e.claims.length} claim${e.claims.length === 1 ? '' : 's'}`
    case 'week-result': return `${weekLabel(e.week)} final`
    case 'playoffs-set': return 'The playoff bracket is set'
    case 'champion': return `🏆 ${l.teams[e.teamId].name} are champions`
    case 'trade': {
      const t = l.trades.find((x) => x.id === e.tradeId)
      if (!t) return 'Trade'
      return tradeLine(l, t, e)
    }
  }
}

export function tradeLine(l: League, t: TradeOffer, e: Extract<ChatEvent, { type: 'trade' }>): string {
  switch (e.stage) {
    case 'proposed': return t.from === ME ? `You sent ${who(l, t.to)} a trade offer` : `${who(l, t.from)} sent you a trade offer`
    case 'accepted': return `${who(l, t.to)} accepted the trade${l.settings.tradeReview === 'commissioner' ? ' · waiting on the commissioner' : ''}`
    case 'declined': return `${who(l, t.to)} declined the trade`
    case 'withdrawn': return `${who(l, t.from)} withdrew the offer`
    case 'expired': return 'The offer expired'
    case 'review': return 'Trade pending review'
    case 'approved': return e.by === null || e.by === undefined ? 'Trade processed · review period ended' : 'The commissioner approved the trade'
    case 'vetoed': return 'The commissioner vetoed the trade'
    case 'failed': return `Trade failed${t.reason ? `: ${t.reason}` : ''}`
  }
}

/**
 * The toast for a new message, or null when it shouldn't notify: only direct messages from other managers and trade
 * offers sent to you do.
 */
export function incomingNotice(l: League, m: ChatMessage): string | null {
  if (m.author === ME || !isDm(m.channel)) return null
  const e = m.event
  const offer = e?.type === 'trade' && e.stage === 'proposed' && l.trades.find((x) => x.id === e.tradeId)?.to === ME
  if (!m.text && !offer) return null
  const text = previewText(l, m, true)
  if (m.author === null) return `🤝 ${text}`
  return `💬 ${managerName(l.teams[m.author])}: ${text.length > 70 ? `${text.slice(0, 70)}…` : text}`
}

/** Trades can be proposed in season, before the deadline week starts. */
export function tradesOpen(l: League): boolean {
  return l.phase === 'season' && currentWeek(getData(), l) < TRADE_DEADLINE_WEEK
}

/** What a free-agency card says the team did. */
export const txnVerb = (adds: number[], drops: number[]) =>
  adds.length && drops.length ? 'added and dropped' : adds.length ? 'added' : 'dropped'

/** The line under a trade offer card in a DM: when it expires, who it's waiting on, or how it ended. */
export function offerStatusText(l: League, t: TradeOffer): string {
  switch (t.status) {
    case 'pending': return t.to === ME ? `Expires at the end of ${weekLabel(t.expiresWeek)}.` : `Waiting on ${who(l, t.to)}…`
    case 'review':
      return l.commissionerId === ME ? 'Accepted. As commissioner, approve or veto it in the league chat.' : 'Accepted. Waiting on the commissioner.'
    case 'approved': return 'Done. The players have moved.'
    case 'failed': return t.reason ?? ''
    default: return ''
  }
}

/** Headline, colour token and footnote of a trade card in the league chat (review, approved, vetoed, failed). */
export function leagueTradeInfo(l: League, t: TradeOffer, stage: TradeStage, by: number | null): {
  title: string; tone: 'gold' | 'accent' | 'loss'; foot: string | null
} {
  switch (stage) {
    case 'review':
      return {
        title: t.status === 'review' ? 'Trade pending review' : 'Trade sent for review',
        tone: 'gold',
        foot: t.status === 'review' ? null : `Outcome: ${TRADE_STATUS[t.status].label.toLowerCase()}`,
      }
    case 'approved':
      return { title: 'Trade processed', tone: 'accent', foot: by === null ? 'Review period ended with no veto.' : `Approved by the commissioner (${who(l, by)}).` }
    case 'vetoed':
      return { title: 'Trade vetoed', tone: 'loss', foot: `Vetoed by the commissioner (${by === null ? 'league' : who(l, by)}).` }
    default:
      return { title: 'Trade failed', tone: 'loss', foot: t.reason ?? null }
  }
}

export function fmtClock(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function fmtAgo(ms: number) {
  const s = (Date.now() - ms) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function totalUnread(l: League) {
  let n = unreadCount(l.chat, LEAGUE_CHANNEL, ME)
  for (const t of l.teams) if (t.id !== ME) n += unreadCount(l.chat, dmChannel(ME, t.id), ME)
  return n
}

/** Label and chip tone for each trade status ('' = neutral). */
export const TRADE_STATUS: Record<TradeStatus, { label: string; tone: 'gold' | 'sky' | 'ok' | 'bad' | '' }> = {
  pending: { label: 'Pending', tone: 'gold' },
  review: { label: 'In review', tone: 'sky' },
  approved: { label: 'Processed', tone: 'ok' },
  declined: { label: 'Declined', tone: 'bad' },
  withdrawn: { label: 'Withdrawn', tone: '' },
  expired: { label: 'Expired', tone: '' },
  vetoed: { label: 'Vetoed', tone: 'bad' },
  failed: { label: 'Failed', tone: 'bad' },
}

/** The two sides of a trade, labelled from your point of view ('me') or for the league chat ('league'). */
export function tradeSides(l: League, t: TradeOffer, perspective: 'me' | 'league'): { label: string; ps: number[] }[] {
  // `give` moves from -> to, `get` moves to -> from
  if (perspective === 'me') {
    return t.from === ME
      ? [{ label: 'You get', ps: t.get }, { label: 'You give', ps: t.give }]
      : [{ label: 'You get', ps: t.give }, { label: 'You give', ps: t.get }]
  }
  return [
    { label: `${teamLabel(l, t.from)} get${t.from === ME ? '' : 's'}`, ps: t.get },
    { label: `${teamLabel(l, t.to)} get${t.to === ME ? '' : 's'}`, ps: t.give },
  ]
}
