import { Stack } from 'expo-router'
import { useSettingsButton, useStackOptions, useTabTitle } from '@/ui'

export default function PlayersStack() {
  const options = useStackOptions()
  const settings = useSettingsButton()
  const title = useTabTitle('Players')
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ ...title, unstable_headerRightItems: settings }} />
    </Stack>
  )
}
