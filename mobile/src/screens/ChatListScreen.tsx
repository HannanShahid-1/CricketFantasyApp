import { Link } from 'expo-router'
import { memo, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { LEAGUE_CHANNEL, lastMessage, unreadCount, type ChannelId } from '@shared/engine/chat'
import { managerName, type League } from '@shared/engine/league'
import { ME, useApp } from '@shared/store'
import { dmThreads } from '@shared/ui/chat/chatRows'
import { fmtAgo, previewText, tradesOpen } from '@shared/ui/chat/chatText'
import { LeagueAvatar } from '@/components/chat/LeagueAvatar'
import { nav } from '@/nav'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { TeamBadge, Txt } from '@/ui'

// Every conversation, Messages style (opened from the league chat, the Chat tab's first screen). The league channel
// first, then a DM with each manager, most recent first. Tap to open; press and hold for quick actions.

const AVATAR = 48

interface Convo {
  channel: ChannelId
  /** the other manager in a DM, null for the league channel */
  teamId: number | null
  name: string
  sub: string
  preview: string
  time: string
  unread: number
}

function convos(l: League): Convo[] {
  const last = lastMessage(l.chat, LEAGUE_CHANNEL)
  const commish = l.teams[l.commissionerId]
  const league: Convo = {
    channel: LEAGUE_CHANNEL,
    teamId: null,
    name: l.name,
    sub: `${l.numTeams} managers · Commissioner: ${commish.id === ME ? 'You' : managerName(commish)}`,
    preview: last ? previewText(l, last, false) : 'Say hi to the league 👋',
    time: last ? fmtAgo(last.at) : '',
    unread: unreadCount(l.chat, LEAGUE_CHANNEL, ME),
  }
  const dms = dmThreads(l).map(({ t, channel, last: m }): Convo => ({
    channel,
    teamId: t.id,
    name: managerName(t),
    sub: t.name,
    preview: m ? previewText(l, m, true) : 'No messages yet',
    time: m ? fmtAgo(m.at) : '',
    unread: unreadCount(l.chat, channel, ME),
  }))
  return [league, ...dms]
}

export function ChatListScreen() {
  const t = useTheme()
  const s = useStyles(styles)
  const league = useApp((st) => st.league)
  const typing = useApp((st) => st.typing)
  const list = useMemo(() => (league ? convos(league) : []), [league])
  const tradable = !!league && tradesOpen(league)
  if (!league) return null
  const [first, ...dms] = list
  const row = (c: Convo, separator: boolean) => (
    <ConvoRow key={c.channel} {...c} typing={(typing[c.channel]?.length ?? 0) > 0} tradable={tradable} separator={separator} />
  )
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.content}>
      {row(first, false)}
      <Txt up size={12} weight={600} tone="muted" style={s.section}>Direct messages</Txt>
      {dms.map((c, i) => row(c, i < dms.length - 1))}
    </ScrollView>
  )
}

/** One conversation. Primitive props only, so it redraws just when what it shows changes. */
const ConvoRow = memo(function ConvoRow({ channel, teamId, name, sub, preview, time, unread, typing, tradable, separator }: Convo & {
  typing: boolean; tradable: boolean; separator: boolean
}) {
  const s = useStyles(styles)
  const team = useApp((st) => (teamId === null ? null : st.league?.teams[teamId]))
  const markRead = useApp((st) => st.markRead)
  const [pressed, setPressed] = useState(false)
  const hasUnread = unread > 0
  return (
    <Link href={channel === LEAGUE_CHANNEL ? '/chat' : { pathname: '/chat/[channel]', params: { channel } }} asChild>
      <Link.Trigger>
        {/* one flat style: Link's Slot rejects style arrays and drops function styles, so the highlight is state */}
        <Pressable
          style={pressed ? StyleSheet.flatten([s.row, s.pressed]) : s.row}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityLabel={`${name}${hasUnread ? `, ${unread} unread` : ''}. ${preview}`}
        >
          {team ? <TeamBadge team={team} size={AVATAR} /> : <LeagueAvatar size={AVATAR} />}
          <View style={s.text}>
            <View style={s.line}>
              <Txt size={16.5} weight={hasUnread ? 700 : 600} numberOfLines={1} style={{ flex: 1 }}>{name}</Txt>
              <Txt size={13.5} tone={hasUnread ? 'accent' : 'muted'}>{time}</Txt>
            </View>
            <Txt size={12.5} tone="dim" numberOfLines={1}>{sub}</Txt>
            <View style={s.line}>
              <Txt size={14.5} tone={typing ? 'accent' : hasUnread ? 'text' : 'muted'} numberOfLines={1} style={{ flex: 1 }}>
                {typing ? 'typing…' : preview}
              </Txt>
              {hasUnread && (
                <View style={s.badge}>
                  <Txt num size={12} weight={700} style={s.badgeText}>{unread > 99 ? '99+' : unread}</Txt>
                </View>
              )}
            </View>
          </View>
          {separator && <View style={s.sep} />}
        </Pressable>
      </Link.Trigger>
      <Link.Menu title={teamId === null ? name : `${name} · ${sub}`}>
        <Link.MenuAction icon="checkmark.message" disabled={!hasUnread} onPress={() => markRead(channel)}>Mark as read</Link.MenuAction>
        {teamId !== null && (
          <Link.MenuAction icon="arrow.left.arrow.right" disabled={!tradable} onPress={() => nav.trade(teamId)}>Propose trade</Link.MenuAction>
        )}
      </Link.Menu>
    </Link>
  )
})

const styles = (t: Theme) => ({
  content: { paddingTop: 4, paddingBottom: 32 },
  section: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 6 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  pressed: { backgroundColor: t.c.line2 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  line: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  badge: {
    minWidth: 21, height: 21, paddingHorizontal: 6, borderRadius: 11, backgroundColor: t.c.accent,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  badgeText: { color: t.c.accentInk },
  sep: {
    position: 'absolute' as const, bottom: 0, right: 0, left: 16 + AVATAR + 12,
    height: StyleSheet.hairlineWidth, backgroundColor: t.c.line2,
  },
})
