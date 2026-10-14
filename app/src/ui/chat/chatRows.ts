// How a conversation is laid out, shared by the web and iPhone chat screens: day separators, the "new messages"
// divider, consecutive messages grouped by author, read receipts and the typing line.
import {
  channelMembers, dmChannel, isDm, lastMessage, readCursor, type ChannelId, type ChatMessage,
} from '../../engine/chat'
import { managerName, type FTeam, type League } from '../../engine/league'
import { ME } from '../../store'
import { fmtDate, weekLabel } from '../format'

/** Messages from one author less than this far apart share a group (one avatar and name). */
const GROUP_MS = 5 * 60 * 1000

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'new'; key: string }
  | { kind: 'event'; key: string; m: ChatMessage }
  | { kind: 'group'; key: string; author: number; msgs: ChatMessage[] }

/** The first unread message from someone else, where the "New messages" divider goes (null if all read). */
export function firstUnread(l: League, channel: ChannelId, msgs: ChatMessage[]): number | null {
  const seen = readCursor(l.chat, channel, ME)?.id ?? 0
  return msgs.find((m) => m.id > seen && m.author !== ME)?.id ?? null
}

export function buildRows(msgs: ChatMessage[], unreadFrom: number | null): ChatRow[] {
  const rows: ChatRow[] = []
  let day = ''
  for (const m of msgs) {
    const dayKey = `${m.week}|${m.date}`
    if (dayKey !== day) {
      day = dayKey
      rows.push({ kind: 'day', key: `d${m.id}`, label: `${weekLabel(m.week)} · ${fmtDate(m.date)}` })
    }
    if (m.id === unreadFrom) rows.push({ kind: 'new', key: 'new' })
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

/** For each message id, the other members whose read cursor stops there ("Seen" markers). */
export function seenPositions(l: League, channel: ChannelId, msgs: ChatMessage[]): Map<number, number[]> {
  const at = new Map<number, number[]>()
  const members = channelMembers(channel, l.teams.map((t) => t.id)).filter((id) => id !== ME)
  for (const id of members) {
    const c = readCursor(l.chat, channel, id)
    if (!c) continue
    let pos: ChatMessage | undefined
    for (const m of msgs) if (m.id <= c.id) pos = m
    if (!pos || pos.author === id) continue
    at.set(pos.id, [...(at.get(pos.id) ?? []), id])
  }
  return at
}

/** When the DM partner read up to a message (for "Seen 3:14 PM"). */
export const dmSeenAt = (l: League, partner: number) => readCursor(l.chat, dmChannel(partner, ME), partner)?.at

export function typingLabel(l: League, channel: ChannelId, ids: number[]): string {
  const names = ids.map((id) => managerName(l.teams[id]))
  if (isDm(channel) || names.length === 1) return `${names[0]} is typing`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing`
}

/** Your DMs with every other manager, most recent first. */
export function dmThreads(l: League): { t: FTeam; channel: ChannelId; last?: ChatMessage }[] {
  return l.teams
    .filter((t) => t.id !== ME)
    .map((t) => ({ t, channel: dmChannel(ME, t.id), last: lastMessage(l.chat, dmChannel(ME, t.id)) }))
    .sort((a, b) => (b.last?.id ?? 0) - (a.last?.id ?? 0) || a.t.name.localeCompare(b.t.name))
}
