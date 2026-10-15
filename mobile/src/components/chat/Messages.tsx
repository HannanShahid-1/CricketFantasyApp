import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import { dmPartner, isDm, type ChannelId, type ChatMessage } from '@shared/engine/chat'
import { managerName, type FTeam } from '@shared/engine/league'
import { ME, useApp } from '@shared/store'
import { dmSeenAt, typingLabel, type ChatRow } from '@shared/ui/chat/chatRows'
import { fmtClock } from '@shared/ui/chat/chatText'
import { alpha, mix, useStyles, useTheme, type Theme } from '@/theme/theme'
import { haptic, Icon, TeamBadge, Txt } from '@/ui'
import { BubbleBody, bubblePos, type BubblePos } from './Bubble'
import { EventMessage } from './EventCards'
import { useReactionPicker } from './ReactionPicker'

// The rows of a conversation. Layout (days, the unread divider, author runs) comes from the shared chatRows; this
// file draws them the iOS way. Rows are memoised on a signature of what they show, because every chat change clones
// the chat and so hands each row new message objects.

/** Avatar beside other managers' messages in the league channel. */
const AV = 28
const INDENT = AV + 8

/** A conversation row plus `sig`, which changes exactly when the row has to redraw. */
export type ChatItem =
  | { kind: 'day'; key: string; sig: string; label: string }
  | { kind: 'new'; key: string; sig: string }
  | { kind: 'event'; key: string; sig: string; m: ChatMessage; seen?: number[] }
  | { kind: 'group'; key: string; sig: string; author: number; msgs: ChatMessage[]; seen: (number[] | undefined)[] }

const reactionSig = (m: ChatMessage) =>
  m.reactions ? Object.entries(m.reactions).map(([e, ids]) => e + ids.join('.')).join('|') : ''

/** Rows for an inverted list (newest first), with the read markers attached to the messages they sit under. */
export function buildItems(rows: ChatRow[], seen: Map<number, number[]>): ChatItem[] {
  const items = rows.map((r): ChatItem => {
    switch (r.kind) {
      case 'day': return { ...r, sig: r.label }
      case 'new': return { ...r, sig: '' }
      case 'event': {
        const ids = seen.get(r.m.id)
        return { ...r, seen: ids, sig: ids?.join('.') ?? '' }
      }
      case 'group': {
        const ids = r.msgs.map((m) => seen.get(m.id))
        return { ...r, seen: ids, sig: r.msgs.map((m, i) => `${m.id}:${reactionSig(m)}:${ids[i]?.join('.') ?? ''}`).join(',') }
      }
    }
  })
  return items.reverse()
}

export const ChatRowView = memo(
  function ChatRowView({ item, channel }: { item: ChatItem; channel: ChannelId }) {
    switch (item.kind) {
      case 'day': return <DaySeparator label={item.label} />
      case 'new': return <NewDivider />
      case 'event': return <EventRow m={item.m} seen={item.seen} channel={channel} />
      case 'group': return <Group author={item.author} msgs={item.msgs} seen={item.seen} channel={channel} />
    }
  },
  (a, b) => a.channel === b.channel && a.item.key === b.item.key && a.item.sig === b.item.sig,
)

function DaySeparator({ label }: { label: string }) {
  const s = useStyles(styles)
  return <Txt size={12} weight={600} tone="dim" style={s.day}>{label}</Txt>
}

function NewDivider() {
  const s = useStyles(styles)
  return (
    <View style={s.newRow} accessibilityRole="header">
      <View style={s.newLine} />
      <Txt up size={11} weight={700} tone="accent">New messages</Txt>
      <View style={s.newLine} />
    </View>
  )
}

function EventRow({ m, seen, channel }: { m: ChatMessage; seen?: number[]; channel: ChannelId }) {
  const s = useStyles(styles)
  return (
    <View style={s.event}>
      <EventMessage m={m} inDm={isDm(channel)} />
      {seen && <Meta at={null} seen={seen} channel={channel} mine indented={false} />}
    </View>
  )
}

/** One author's run of messages. In the league channel others get an avatar and their name above the run. */
function Group({ author, msgs, seen, channel }: { author: number; msgs: ChatMessage[]; seen: (number[] | undefined)[]; channel: ChannelId }) {
  const s = useStyles(styles)
  const team = useApp((st) => st.league?.teams[author])
  const commish = useApp((st) => st.league?.commissionerId === author)
  if (!team) return null
  const mine = author === ME
  const named = !mine && !isDm(channel)
  return (
    <View style={s.group}>
      {named && <AuthorLine team={team} commish={commish} />}
      {msgs.map((m, i) => (
        <Message
          key={m.id}
          m={m}
          mine={mine}
          pos={bubblePos(i, msgs.length)}
          avatar={named ? (i === msgs.length - 1 ? team : null) : undefined}
          seen={seen[i]}
          channel={channel}
        />
      ))}
    </View>
  )
}

function AuthorLine({ team, commish }: { team: FTeam; commish: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  return (
    <View style={s.author}>
      <Txt size={12.5} weight={600} tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {managerName(team)}
        <Txt size={12.5} tone="dim">{`  ${team.name}`}</Txt>
      </Txt>
      {commish && (
        <View style={s.commish}>
          <Icon name="building.columns.fill" size={9} color={t.c.gold} />
          <Txt size={10} weight={700} tone="gold">Commish</Txt>
        </View>
      )}
    </View>
  )
}

/**
 * A bubble with its reactions, time and read marker. `avatar`: the author's badge (last bubble of a league run),
 * null for a spacer (other bubbles of that run), undefined when the conversation shows no avatars.
 */
function Message({ m, mine, pos, avatar, seen, channel }: {
  m: ChatMessage; mine: boolean; pos: BubblePos; avatar?: FTeam | null; seen?: number[]; channel: ChannelId
}) {
  const s = useStyles(styles)
  const bubble = useRef<View>(null)
  const pick = useReactionPicker()
  const indented = avatar !== undefined
  const last = pos === 'last' || pos === 'single'
  const hold = () => bubble.current?.measureInWindow((x, y, width, height) => pick({ m, mine, pos, rect: { x, y, width, height } }))
  return (
    <>
      <View style={[s.line, mine && s.end]}>
        {avatar !== undefined && (avatar ? <TeamBadge team={avatar} size={AV} /> : <View style={{ width: AV }} />)}
        <Pressable
          ref={bubble}
          onLongPress={hold}
          delayLongPress={250}
          style={s.bubbleWrap}
          accessibilityLabel={m.text}
          accessibilityHint="Press and hold to react"
        >
          <BubbleBody text={m.text ?? ''} mine={mine} pos={pos} />
        </Pressable>
      </View>
      {m.reactions && <Reactions m={m} mine={mine} indented={indented} onHold={hold} />}
      {(last || seen) && <Meta at={last ? m.at : null} seen={seen} channel={channel} mine={mine} indented={indented} />}
    </>
  )
}

/** Reaction counts tucked under the bubble. Tap one to add or remove yours; press and hold to see who reacted. */
function Reactions({ m, mine, indented, onHold }: { m: ChatMessage; mine: boolean; indented: boolean; onHold: () => void }) {
  const s = useStyles(styles)
  const react = useApp((st) => st.react)
  const teams = useApp((st) => st.league?.teams)
  const entries = Object.entries(m.reactions ?? {})
  if (!entries.length || !teams) return null
  return (
    <View style={[s.reactions, mine ? s.end : indented && s.indent]}>
      {entries.map(([e, ids]) => {
        const me = ids.includes(ME)
        return (
          <Pressable
            key={e}
            onPress={() => {
              haptic.select()
              react(m.id, e)
            }}
            onLongPress={onHold}
            style={[s.reaction, me && s.reactionMine]}
            accessibilityRole="button"
            accessibilityLabel={`${e} from ${ids.map((id) => (id === ME ? 'you' : managerName(teams[id]))).join(', ')}`}
            accessibilityHint={me ? 'Removes your reaction' : 'Adds your reaction'}
          >
            <Txt size={13}>{e}</Txt>
            <Txt num size={12} weight={700} tone={me ? 'accent' : 'muted'}>{ids.length}</Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Under a message: its time (last of a run) and who has read up to it. */
function Meta({ at, seen, channel, mine, indented }: { at: number | null; seen?: number[]; channel: ChannelId; mine: boolean; indented: boolean }) {
  const s = useStyles(styles)
  const dm = isDm(channel)
  return (
    <View style={[s.meta, mine ? s.end : indented && s.indent]}>
      {at !== null && <Txt size={11} tone="dim">{fmtClock(at)}</Txt>}
      {at !== null && seen && dm && <Txt size={11} tone="dim">·</Txt>}
      {seen && (dm ? <SeenAt partner={dmPartner(channel, ME)} /> : <SeenDots ids={seen} />)}
    </View>
  )
}

/** "Seen 3:14 PM" in a DM. */
function SeenAt({ partner }: { partner: number }) {
  const at = useApp((st) => (st.league ? dmSeenAt(st.league, partner) : undefined))
  return <Txt size={11} weight={600} tone="dim">Seen{at ? ` ${fmtClock(at)}` : ''}</Txt>
}

/** League read receipts: a dot in each reader's team colour. Tap for names. */
function SeenDots({ ids }: { ids: number[] }) {
  const t = useTheme()
  const s = useStyles(styles)
  const teams = useApp((st) => st.league?.teams)
  const [named, setNamed] = useState(false)
  if (!teams) return null
  const names = ids.map((id) => managerName(teams[id])).join(', ')
  return (
    <Pressable onPress={() => setNamed(!named)} hitSlop={10} style={s.dots} accessibilityRole="button" accessibilityLabel={`Seen by ${names}`}>
      {named ? (
        <Txt size={11} tone="dim">Seen by {names}</Txt>
      ) : (
        <>
          {ids.slice(0, 5).map((id, i) => (
            <View key={id} style={[s.dot, { backgroundColor: t.team(teams[id].color), marginLeft: i ? -4 : 0 }]} />
          ))}
          {ids.length > 5 && <Txt size={10.5} tone="dim" style={{ marginLeft: 3 }}>+{ids.length - 5}</Txt>}
        </>
      )}
    </Pressable>
  )
}

/** Someone is typing: their avatar (league) and a bubble of pulsing dots, with "Priya is typing" under it. */
export function TypingRow({ ids, channel }: { ids: number[]; channel: ChannelId }) {
  const s = useStyles(styles)
  const team = useApp((st) => (ids.length ? st.league?.teams[ids[0]] : undefined))
  const label = useApp((st) => (st.league && ids.length ? typingLabel(st.league, channel, ids) : ''))
  const named = !isDm(channel)
  if (!team) return null
  return (
    <View style={s.group} accessible accessibilityLabel={label}>
      <View style={s.line}>
        {named && <TeamBadge team={team} size={AV} />}
        <View style={s.typing}>
          <TypingDots />
        </View>
      </View>
      <View style={[s.meta, named && s.indent]}>
        <Txt size={11} tone="dim">{label}</Txt>
      </View>
    </View>
  )
}

function TypingDots() {
  const t = useTheme()
  const phase = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(phase, { toValue: 4, duration: 1400, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [phase])
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={{
            width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.c.muted,
            opacity: phase.interpolate({ inputRange: [0, i + 0.5, i + 1, i + 1.5, 4], outputRange: [0.3, 0.3, 1, 0.3, 0.3] }),
          }}
        />
      ))}
    </View>
  )
}

const styles = (t: Theme) => ({
  group: { paddingTop: 10, gap: 2 },
  author: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingLeft: INDENT + 6, marginBottom: 2 },
  commish: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, height: 17, paddingHorizontal: 6, borderRadius: 999,
    backgroundColor: alpha(t.c.gold, 0.14),
  },
  line: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 8 },
  end: { justifyContent: 'flex-end' as const },
  indent: { paddingLeft: INDENT + 6 },
  bubbleWrap: { maxWidth: '78%' as const, flexShrink: 1 },
  reactions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4, marginTop: -5, paddingHorizontal: 8 },
  reaction: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, height: 26, paddingHorizontal: 7, borderRadius: 13,
    borderWidth: 2, borderColor: t.c.bg, backgroundColor: t.c.panel2,
  },
  reactionMine: { backgroundColor: mix(t.c.accent, t.c.panel2, 0.28) },
  meta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, minHeight: 18, paddingTop: 2, paddingHorizontal: 6 },
  dots: { flexDirection: 'row' as const, alignItems: 'center' as const },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: t.c.bg },
  event: { paddingVertical: 8, gap: 2 },
  day: { textAlign: 'center' as const, paddingTop: 18, paddingBottom: 4 },
  newRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingTop: 14, paddingBottom: 4 },
  newLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: alpha(t.c.accent, 0.5) },
  typing: { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 18, backgroundColor: t.c.panel3 },
})
