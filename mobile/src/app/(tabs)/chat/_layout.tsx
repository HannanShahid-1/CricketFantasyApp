import { Stack } from 'expo-router'
import { useStackOptions } from '@/ui'

export default function ChatStack() {
  const options = useStackOptions()
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ headerLargeTitle: false }} />
      <Stack.Screen name="messages" options={{ title: 'Messages' }} />
      <Stack.Screen name="[channel]" options={{ headerLargeTitle: false }} />
    </Stack>
  )
}
