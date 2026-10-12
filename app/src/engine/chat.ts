// League chat: one league-wide channel plus a direct-message channel for every pair of managers.
// Plain data and pure functions so the same model can move to a server (messages + read cursors
// tables) when the league goes multiplayer. Members are fantasy team ids.

export type ChannelId = string // 'league' | `dm:${lo}:${hi}`

export const LEAGUE_CHANNEL: ChannelId = 'league'

export type TradeStage =
  | 'proposed' | 'accepted' | 'declined' | 'withdrawn' | 'expired'
  | 'review' | 'approved' | 'vetoed' | 'failed'

export type ChatEvent =
  | { type: 'league-created' }
  | { type: 'draft-complete' }
  | { type: 'txn'; teamId: number; adds: number[]; drops: number[] }
  | { type: 'waivers'; week: number; claims: { teamId: number; add: number; drop: number | null; bid: number }[] }
  | { type: 'trade'; tradeId: number; stage: TradeStage; by?: number | null }
  | { type: 'week-result'; week: number }
  | { type: 'playoffs-set' }
  | { type: 'champion'; teamId: number }

export interface ChatMessage {
  id: number
  channel: ChannelId
  /** team id, or null for a league/system message */
  author: number | null
  /** wall-clock ms */
  at: number
  /** league calendar day the message belongs to (ISO date) */
  date: string
  week: number
  text?: string
  event?: ChatEvent
  /** emoji → team ids */
  reactions?: Record<string, number[]>
}

export interface ReadCursor {
  id: number
  at: number
}

export interface ChatState {
  seq: number
  messages: ChatMessage[]
  /** channel → member → last message they have seen */
  reads: Record<ChannelId, Record<number, ReadCursor>>
}

export const REACTIONS = ['👍', '😂', '🔥', '😬', '🏏'] as const

export function emptyChat(): ChatState {
  return { seq: 1, messages: [], reads: {} }
}

export function dmChannel(a: number, b: number): ChannelId {
  return `dm:${Math.min(a, b)}:${Math.max(a, b)}`
}

export function isDm(c: ChannelId) {
  return c.startsWith('dm:')
}

/** the other member of a DM channel */
export function dmPartner(c: ChannelId, me: number): number {
  const [, a, b] = c.split(':').map(Number)
  return a === me ? b : a
}

export function channelMembers(c: ChannelId, allTeams: number[]): number[] {
  if (!isDm(c)) return allTeams
  const [, a, b] = c.split(':').map(Number)
  return [a, b]
}

export function post(chat: ChatState, m: Omit<ChatMessage, 'id' | 'at'> & { at?: number }): ChatMessage {
  const msg: ChatMessage = { ...m, id: chat.seq++, at: m.at ?? Date.now() }
  chat.messages.push(msg)
  if (msg.author !== null) markRead(chat, msg.channel, msg.author, msg.id, msg.at)
  return msg
}

export function messagesIn(chat: ChatState, c: ChannelId): ChatMessage[] {
  return chat.messages.filter((m) => m.channel === c)
}

export function lastMessage(chat: ChatState, c: ChannelId): ChatMessage | undefined {
  for (let i = chat.messages.length - 1; i >= 0; i--) if (chat.messages[i].channel === c) return chat.messages[i]
  return undefined
}

export function readCursor(chat: ChatState, c: ChannelId, member: number): ReadCursor | undefined {
  return chat.reads[c]?.[member]
}

/** Move a member's cursor forward (never back). Defaults to the latest message in the channel. */
export function markRead(chat: ChatState, c: ChannelId, member: number, upTo?: number, at = Date.now()): boolean {
  const id = upTo ?? lastMessage(chat, c)?.id
  if (id === undefined) return false
  const cur = chat.reads[c]?.[member]
  if (cur && cur.id >= id) return false
  chat.reads[c] = { ...chat.reads[c], [member]: { id, at } }
  return true
}

export function unreadCount(chat: ChatState, c: ChannelId, member: number): number {
  const seen = readCursor(chat, c, member)?.id ?? 0
  let n = 0
  for (const m of chat.messages) if (m.channel === c && m.id > seen && m.author !== member) n++
  return n
}

export function toggleReaction(chat: ChatState, msgId: number, member: number, emoji: string) {
  const m = chat.messages.find((x) => x.id === msgId)
  if (!m) return
  const r = { ...m.reactions }
  const who = r[emoji] ?? []
  r[emoji] = who.includes(member) ? who.filter((x) => x !== member) : [...who, member]
  if (!r[emoji].length) delete r[emoji]
  m.reactions = r
}
