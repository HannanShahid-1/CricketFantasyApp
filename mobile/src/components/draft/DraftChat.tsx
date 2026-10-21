import { useIsFocused } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { FlatList, View } from 'react-native'
import { LEAGUE_CHANNEL, messagesIn } from '@shared/engine/chat'
import { managerName } from '@shared/engine/league'
import { useApp } from '@shared/store'
import { Composer } from '@/components/chat/Composer'
import { alpha, useTheme } from '@/theme/theme'
import { Txt } from '@/ui'

/** The actual league conversation, available without leaving the draft. */
export function DraftChat() {
  const t = useTheme()
  const chat = useApp((s) => s.league!.chat)
  const teams = useApp((s) => s.league!.teams)
  const rows = useMemo(() => [...messagesIn(chat, LEAGUE_CHANNEL)].reverse(), [chat])
  const last = rows[0]?.id
  const focused = useIsFocused()
  useEffect(() => { if (focused) useApp.getState().markRead(LEAGUE_CHANNEL) }, [last, focused])
  return <View style={{ flex: 1 }}>
    <FlatList inverted data={rows} keyExtractor={(m) => String(m.id)} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, gap: 8 }} renderItem={({ item }) => (
      <View style={{ padding: 10, borderRadius: t.r.md, backgroundColor: item.author === null ? 'transparent' : alpha(t.c.tint, 0.05) }}>
        <Txt size={10} tone="accent" weight={700}>{item.author === null ? 'Seam' : managerName(teams[item.author])}</Txt>
        <Txt size={13} style={{ marginTop: 3 }}>{item.text ?? (item.event?.type === 'league-created' ? 'Welcome to the draft room.' : item.event?.type === 'draft-complete' ? 'The draft is complete.' : 'League update')}</Txt>
      </View>
    )} />
    <Composer channel={LEAGUE_CHANNEL} placeholder="Message the league" bottom={0} onSent={() => {}} />
  </View>
}
