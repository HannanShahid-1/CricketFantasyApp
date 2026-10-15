import { Redirect } from 'expo-router'
import { useApp } from '@shared/store'

/** App entry: setup until there's a league, the draft room while drafting, then the season tabs. */
export default function Index() {
  const phase = useApp((s) => s.league?.phase ?? null)
  return <Redirect href={phase === null ? '/setup' : phase === 'draft' ? '/draft' : '/matchup'} />
}
