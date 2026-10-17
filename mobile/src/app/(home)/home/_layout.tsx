import { Stack } from 'expo-router'
import { useStackOptions } from '@/ui'
export default function Layout() {
  const options = useStackOptions()
  return <Stack screenOptions={options}><Stack.Screen name="index" options={{ title: 'Seam' }} /></Stack>
}
