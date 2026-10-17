import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { totalUnread } from '@shared/ui/chat/chatText'
import { useLeagues } from '@/data/leagues'
import { useTheme } from '@/theme/theme'

export default function HomeTabs() {
  const t = useTheme()
  const unread = useLeagues((s) => s.leagues.reduce((n, l) => n + totalUnread(l), 0))
  return (
    <NativeTabs tintColor={t.c.accent} iconColor={{ default: t.c.muted, selected: t.c.accent }}>
      <NativeTabs.Trigger name="home"><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="house.fill" md="home" /></NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity"><NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="bell.fill" md="notifications" /></NativeTabs.Trigger>
      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" md="chat" />
        {unread > 0 && <NativeTabs.Trigger.Badge>{unread > 99 ? '99+' : String(unread)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="preferences"><NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label><NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" /></NativeTabs.Trigger>
    </NativeTabs>
  )
}
