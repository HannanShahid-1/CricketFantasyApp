import { Stack } from 'expo-router'
import { useSettingsButton, useStackOptions } from '@/ui'

export default function LeagueStack() {
  const options = useStackOptions()
  const settings = useSettingsButton()
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'League', unstable_headerRightItems: settings }} />
      <Stack.Screen name="playoffs" options={{ title: 'Playoffs', headerLargeTitle: false }} />
      <Stack.Screen name="fixtures" options={{ title: 'IPL Fixtures', headerLargeTitle: false }} />
      <Stack.Screen name="activity" options={{ title: 'Activity', headerLargeTitle: false }} />
      <Stack.Screen name="draft-board" options={{ title: 'Draft Board', headerLargeTitle: false }} />
      <Stack.Screen name="scoring" options={{ title: 'Scoring', headerLargeTitle: false }} />
    </Stack>
  )
}
