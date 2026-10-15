import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { LEAGUE_CHANNEL } from '@shared/engine/chat'
import { useApp } from '@shared/store'
import { totalUnread } from '@shared/ui/chat/chatText'
import { useChatNotifications, useOpenChannel } from '@/components/chat/notifications'
import { useTheme } from '@/theme/theme'

/**
 * The native iOS tab bar (Liquid Glass). Each tab is its own navigation stack. The bar hides inside a conversation,
 * so the composer gets the bottom edge (like Messages); the league chat is a tab root, so it keeps the bar.
 */
export default function TabsLayout() {
  const t = useTheme()
  const unread = useApp((s) => (s.league ? totalUnread(s.league) : 0))
  // the league chat is the Chat tab's first screen, so the bar stays there; a DM hides it
  const inConversation = useOpenChannel((s) => s.channel !== null && s.channel !== LEAGUE_CHANNEL)
  useChatNotifications()
  const tab = { contentStyle: { backgroundColor: t.c.bg } }
  return (
    <NativeTabs tintColor={t.c.accent} iconColor={{ default: t.c.muted, selected: t.c.accent }} hidden={inConversation}>
      <NativeTabs.Trigger name="matchup" {...tab}>
        <NativeTabs.Trigger.Label>Matchup</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sportscourt.fill" md="sports_cricket" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="team" {...tab}>
        <NativeTabs.Trigger.Label>My Team</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat" {...tab}>
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" md="chat" />
        {unread > 0 && <NativeTabs.Trigger.Badge>{unread > 99 ? '99+' : String(unread)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="players" {...tab}>
        <NativeTabs.Trigger.Label>Players</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.3.fill" md="groups" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="league" {...tab}>
        <NativeTabs.Trigger.Label>League</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.number" md="leaderboard" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
