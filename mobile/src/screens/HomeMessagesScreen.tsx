import { getData } from '@shared/store'
import { totalUnread } from '@shared/ui/chat/chatText'
import { lastMessage, LEAGUE_CHANNEL } from '@shared/engine/chat'
import { previewText } from '@shared/ui/chat/chatText'
import { LeagueAvatar } from '@/components/chat/LeagueAvatar'
import { useLeagues } from '@/data/leagues'
import { openSavedLeague } from './HomeScreen'
import { Chip, EmptyState, Row, Screen, Section } from '@/ui'

export function HomeMessagesScreen() {
  const leagues = useLeagues((s) => s.leagues)
  const available = leagues.filter((l) => l.phase !== 'draft' && l.dataVersion === getData().version)
  return (
    <Screen>
      {available.length ? <Section>{available.map((l) => {
        const last = lastMessage(l.chat, LEAGUE_CHANNEL)
        const unread = totalUnread(l)
        return <Row key={l.createdAt} title={l.name} subtitle={last ? previewText(l, last, false) : 'Open your league chat'} left={<LeagueAvatar size={40} />} right={unread ? <Chip label={String(unread)} tone="accent" /> : undefined} chevron onPress={() => void openSavedLeague(l.createdAt, 'chat')} />
      })}</Section> : <EmptyState icon="bubble.left.and.bubble.right" title="Your league, your conversations" message="League chats appear here once your draft is complete." />}
    </Screen>
  )
}
