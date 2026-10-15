import { Stack } from 'expo-router'
import { useSettingsButton, useStackOptions } from '@/ui'

export default function TeamStack() {
  const options = useStackOptions()
  const settings = useSettingsButton()
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: 'My Team', unstable_headerRightItems: settings }} />
    </Stack>
  )
}
