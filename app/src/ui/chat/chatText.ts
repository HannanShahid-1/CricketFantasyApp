// Text helpers for chat: conversation previews, notification lines, timestamps, unread totals.
import { dmChannel, LEAGUE_CHANNEL, unreadCount, type ChatEvent, type ChatMessage } from '../../engine/chat'
import { managerName, type League, type TradeOffer } from '../../engine/league'
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
