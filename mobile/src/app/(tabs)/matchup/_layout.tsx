import { Stack } from 'expo-router'
import { useSettingsButton, useStackOptions } from '@/ui'

export default function MatchupStack() {
  const options = useStackOptions()
  const settings = useSettingsButton()
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Matchup', unstable_headerRightItems: settings }} />
    </Stack>
  )
}
