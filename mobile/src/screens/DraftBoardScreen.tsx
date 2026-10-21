import { useGameLeague } from '@/data/gameLeague'
import { DraftRoom } from './DraftScreen'

export function DraftBoardScreen() {
  const league = useGameLeague()!
  return <DraftRoom league={league} review />
}
