import { Stack } from 'expo-router'
import { useSettingsButton, useStackOptions } from '@/ui'

export default function PlayersStack() {
  const options = useStackOptions()
  const settings = useSettingsButton()
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'Players', unstable_headerRightItems: settings }} />
    </Stack>
  )
}
