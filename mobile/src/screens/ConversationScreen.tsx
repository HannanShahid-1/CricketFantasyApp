import { Stack, useFocusEffect, useIsFocused, useLocalSearchParams, type NativeStackNavigationOptions } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList, Pressable, useWindowDimensions, View, type ListRenderItemInfo, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  dmChannel, dmPartner, isDm, LEAGUE_CHANNEL, messagesIn, unreadCount, type ChannelId,
} from '@shared/engine/chat'
import { managerName, PERSONA_LABEL, type League } from '@shared/engine/league'
import { ME, useApp } from '@shared/store'
import { buildRows, firstUnread, seenPositions } from '@shared/ui/chat/chatRows'
import { totalUnread, tradesOpen } from '@shared/ui/chat/chatText'
import { Composer } from '@/components/chat/Composer'
import { useAppActive, useKeyboardHeight } from '@/components/chat/hooks'
import { LeagueAvatar } from '@/components/chat/LeagueAvatar'
import { buildItems, ChatRowView, TypingRow, type ChatItem } from '@/components/chat/Messages'
import { clearOpenChannel, setOpenChannel } from '@/data/chatNotifications'
import { ReactionPicker } from '@/components/chat/ReactionPicker'
import { nav } from '@/nav'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, EmptyState, Icon, Screen, TeamBadge, Txt } from '@/ui'

// One conversation: the league channel (the Chat tab's first screen) or a DM. An inverted list keeps the newest message at the bottom, above the
// composer, and a blurred header lets messages scroll under it. Opening it marks it read, and so does every message
// that arrives while it's on screen.

const NOBODY: number[] = []

/** The DM partner, or null for the league channel; undefined if the channel isn't one of yours. */
function partnerOf(l: League, channel: ChannelId): number | null | undefined {
  if (channel === LEAGUE_CHANNEL) return null
  if (!isDm(channel)) return undefined
  const p = dmPartner(channel, ME)
  return l.teams[p] && dmChannel(ME, p) === channel ? p : undefined
}

export function ConversationScreen() {
  const raw = useLocalSearchParams<{ channel: string }>().channel
  const channel = (Array.isArray(raw) ? raw[0] : raw) ?? LEAGUE_CHANNEL
  const known = useApp((s) => !!s.league && partnerOf(s.league, channel) !== undefined)
  if (!known) {
    return (
      <>
        <Stack.Screen options={{ title: 'Chat' }} />
        <Screen>
          <EmptyState icon="bubble.left.and.bubble.right" title="Conversation not found" message="It may belong to a league that was reset." />
        </Screen>
      </>
    )
  }
  // A new channel param (e.g. opening a DM from the members menu) starts a fresh conversation view. The provider
  // measures this screen's own safe area, so the composer clears the tab bar in the league chat (a tab root) and
  // just the home indicator in a DM (where the bar hides).
  return (
    <SafeAreaProvider>
      <Conversation key={channel} channel={channel} />
    </SafeAreaProvider>
  )
}

function Conversation({ channel }: { channel: ChannelId }) {
  const t = useTheme()
  const s = useStyles(styles)
  const league = useApp((st) => st.league)!
  const typing = useApp((st) => st.typing[channel] ?? NOBODY)
  const markRead = useApp((st) => st.markRead)
  const headerHeight = useHeaderHeight()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardHeight()
  const list = useRef<FlatList<ChatItem>>(null)
  const partner = partnerOf(league, channel) ?? null

  // rows only change with the chat (or a team's name/colour), never with other league updates
  const msgs = useMemo(() => messagesIn(league.chat, channel), [league.chat, channel])
  // "New messages" divider: where the unread run started when the conversation opened
  const [unreadFrom] = useState(() => firstUnread(league, channel, msgs))
  // seenPositions reads only the chat (which msgs follows) and the teams
  const items = useMemo(
    () => buildItems(buildRows(msgs, unreadFrom), seenPositions(league, channel, msgs)),
    [msgs, unreadFrom, league.teams, channel],
  )

  // read while on screen and the app is in front; new messages arriving re-trigger it
  const focused = useIsFocused()
  const active = useAppActive()
  const lastId = msgs.length ? msgs[msgs.length - 1].id : 0
  useEffect(() => {
    if (focused && active) markRead(channel)
  }, [focused, active, lastId, channel, markRead])
  // the open conversation doesn't toast its own messages
  useFocusEffect(
    useCallback(() => {
      setOpenChannel(channel)
      return () => clearOpenChannel(channel)
    }, [channel]),
  )

  // open at the "New messages" divider when it's off screen, otherwise at the newest message
  const [dividerAt] = useState(() => items.findIndex((x) => x.kind === 'new'))
  const jumpToDivider = dividerAt > 8
  const placed = useRef(!jumpToDivider)
  // inverted: viewPosition 1 is the top of the list; the negative offset keeps the divider clear of the header
  const showDivider = (index: number) =>
    list.current?.scrollToIndex({ index, viewPosition: 1, viewOffset: -8, animated: false })
  const onContentSizeChange = () => {
    if (placed.current) return
    placed.current = true
    requestAnimationFrame(() => showDivider(dividerAt))
  }
  // not laid out yet: get close using the average row height, then try once more
  const retried = useRef(false)
  const onScrollToIndexFailed = (info: { index: number; averageItemLength: number }) => {
    list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false })
    if (retried.current) return
    retried.current = true
    setTimeout(() => showDivider(info.index), 80)
  }

  // "jump to latest" once you've scrolled a screen or so up
  const [away, setAway] = useState(false)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const far = e.nativeEvent.contentOffset.y > 600
    if (far !== away) setAway(far)
  }
  const toLatest = useCallback(() => list.current?.scrollToOffset({ offset: 0, animated: true }), [])

  const typingRow = useMemo(() => <TypingRow ids={typing} channel={channel} />, [typing, channel])
  const renderItem = useCallback(({ item }: ListRenderItemInfo<ChatItem>) => <ChatRowView item={item} channel={channel} />, [channel])
  const options = useHeaderOptions(league, channel, partner)
  const name = partner === null ? 'the league' : managerName(league.teams[partner])

  return (
    <View style={s.root}>
      <Stack.Screen options={options} />
      {/* Keeps react-native-screens from switching the list to automatic content insets: they'd land on the wrong
          ends of an inverted list. The list pads itself for the header instead. */}
      <View collapsable={false} pointerEvents="none" style={s.guard} />
      <ReactionPicker top={headerHeight}>
        <View style={{ flex: 1 }}>
          <FlatList
            ref={list}
            inverted
            data={items}
            renderItem={renderItem}
            keyExtractor={keyOf}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustsScrollIndicatorInsets={false}
            // inverted: the content's bottom edge is the top of the screen
            contentContainerStyle={[s.content, msgs.length === 0 && s.empty]}
            // always mounted (empty when nobody's typing), so the list's maintainVisibleContentPosition index holds
            ListHeaderComponent={typingRow}
            ListFooterComponent={msgs.length === 0 ? <EmptyConvo partner={partner} /> : null}
            maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 120 }}
            initialNumToRender={jumpToDivider ? Math.min(dividerAt + 6, 80) : 15}
            onContentSizeChange={onContentSizeChange}
            onScrollToIndexFailed={onScrollToIndexFailed}
            onScroll={onScroll}
            scrollEventThrottle={100}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          />
          {away && (
            <Pressable onPress={toLatest} style={s.jump} hitSlop={8} accessibilityRole="button" accessibilityLabel="Jump to latest">
              <Icon name="chevron.down" size={15} color={t.c.text} weight="semibold" />
            </Pressable>
          )}
        </View>
      </ReactionPicker>
      <Composer channel={channel} placeholder={`Message ${name}`} bottom={Math.max(keyboard, insets.bottom)} onSent={toLatest} />
    </View>
  )
}

const keyOf = (item: ChatItem) => item.key

/** Title (avatar, name, who/what) and actions for the conversation's header. */
function useHeaderOptions(league: League, channel: ChannelId, partner: number | null): NativeStackNavigationOptions {
  const t = useTheme()
  const open = tradesOpen(league)
  const { teams, name } = league
  // unread DMs, shown on the league chat's Messages button
  const dmUnread = totalUnread(league) - unreadCount(league.chat, LEAGUE_CHANNEL, ME)
  return useMemo((): NativeStackNavigationOptions => {
    const title = partner === null ? name : managerName(teams[partner])
    const common: NativeStackNavigationOptions = {
      title,
      headerTitle: () => <ConvoTitle channel={channel} partner={partner} />,
      // an opaque bar (like Messages): iOS 26's scroll-edge blur under a transparent header can't follow an inverted
      // list and ends up covering it, so the list starts below the header instead of scrolling under it
      headerTransparent: false,
      headerStyle: { backgroundColor: t.c.bg },
      headerShadowVisible: true,
    }
    if (partner !== null) {
      return {
        ...common,
        unstable_headerRightItems: () => [{
          type: 'button',
          label: 'Propose trade',
          icon: { type: 'sfSymbol', name: 'arrow.left.arrow.right' },
          tintColor: t.c.accent,
          disabled: !open,
          accessibilityHint: open ? undefined : 'Trades are closed',
          onPress: () => nav.trade(partner),
        }],
      }
    }
    return {
      ...common,
      // every conversation: DM a manager from there (unread DMs show on the badge)
      unstable_headerLeftItems: () => [{
        type: 'button',
        label: 'Messages',
        icon: { type: 'sfSymbol', name: 'bubble.left.and.bubble.right' },
        tintColor: t.c.text,
        badge: dmUnread > 0 ? { value: dmUnread > 99 ? '99+' : dmUnread, style: { backgroundColor: t.c.accent, color: t.c.accentInk } } : undefined,
        accessibilityLabel: dmUnread > 0 ? `Messages, ${dmUnread} unread` : 'Messages',
        onPress: nav.messages,
      }],
    }
  }, [t, channel, partner, open, teams, name, dmUnread])
}

/** Header title: the avatar beside the name, with team and persona (DM) or members and commissioner (league). */
function ConvoTitle({ channel, partner }: { channel: ChannelId; partner: number | null }) {
  const s = useStyles(styles)
  const { width } = useWindowDimensions()
  const league = useApp((st) => st.league)
  const typing = useApp((st) => (st.typing[channel]?.length ?? 0) > 0)
  if (!league) return null
  let title: string
  let sub: string
  if (partner === null) {
    const commish = league.teams[league.commissionerId]
    title = league.name
    sub = `${league.numTeams} managers · Commissioner: ${commish.id === ME ? 'You' : managerName(commish)}`
  } else {
    const team = league.teams[partner]
    title = managerName(team)
    sub = `${team.name} · ${PERSONA_LABEL[team.persona]}`
  }
  return (
    <View style={[s.title, { maxWidth: width - 150 }]}>
      {partner === null ? <LeagueAvatar size={30} /> : <TeamBadge team={league.teams[partner]} size={30} />}
      <View style={{ flexShrink: 1 }}>
        <Txt display size={15.5} weight={700} numberOfLines={1}>{title}</Txt>
        <Txt size={11.5} tone={typing && partner !== null ? 'accent' : 'muted'} numberOfLines={1}>
          {typing && partner !== null ? 'typing…' : sub}
        </Txt>
      </View>
    </View>
  )
}

/** A conversation with nothing in it yet. */
function EmptyConvo({ partner }: { partner: number | null }) {
  const s = useStyles(styles)
  const league = useApp((st) => st.league)
  if (!league) return null
  if (partner === null) return <EmptyState icon="hand.wave" title="Say hi to the league 👋" />
  const team = league.teams[partner]
  return (
    <View style={s.intro}>
      <TeamBadge team={team} size={64} />
      <Txt display size={20} weight={700} style={{ marginTop: 6 }}>{managerName(team)}</Txt>
      <Txt size={13.5} tone="muted">{team.name} · {PERSONA_LABEL[team.persona]}</Txt>
      <Txt size={14} tone="dim" style={s.introText}>Messages and trade offers between you two show up here.</Txt>
      {tradesOpen(league) && <Button title="Propose trade" icon="arrow.left.arrow.right" kind="tinted" onPress={() => nav.trade(partner)} style={{ marginTop: 6 }} />}
    </View>
  )
}

const styles = (t: Theme) => ({
  root: { flex: 1, backgroundColor: t.c.bg },
  guard: { position: 'absolute' as const, width: 0, height: 0 },
  content: { paddingTop: 10, paddingBottom: 12, paddingHorizontal: 16 },
  empty: { flexGrow: 1, justifyContent: 'center' as const },
  jump: {
    position: 'absolute' as const, right: 16, bottom: 12, width: 38, height: 38, borderRadius: 19,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: t.c.panel3,
    borderWidth: 1, borderColor: t.c.line2, shadowColor: t.c.shade, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  title: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9 },
  intro: { alignItems: 'center' as const, gap: 4, paddingHorizontal: 24, paddingVertical: 32 },
  introText: { textAlign: 'center' as const, marginTop: 8, lineHeight: 20 },
})
