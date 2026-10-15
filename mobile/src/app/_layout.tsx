import { BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque'
import { ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch'
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts,
} from '@expo-google-fonts/inter'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useApp } from '@shared/store'
import { LaunchIntro, useLaunchIntro } from '@/components/LaunchIntro'
import { boot } from '@/data/boot'
import { useTheme } from '@/theme/theme'
import { ToastHost } from '@/ui/Toast'

export default function RootLayout() {
  const [fonts] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
    ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold,
    BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold,
  })
  const [ready, setReady] = useState(false)
  useEffect(() => {
    boot().then(() => setReady(true))
  }, [])
  const t = useTheme()
  const intro = useLaunchIntro((s) => (s.visible ? s.run : null))

  // the launch animation covers start-up, then reveals the app (and replays from Settings)
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {fonts && ready && <App />}
      {intro !== null && <LaunchIntro key={intro} ready={!!fonts && ready} />}
    </View>
  )
}

function App() {
  const t = useTheme()
  const phase = useApp((s) => s.league?.phase ?? null)

  const base = t.dark ? DarkTheme : DefaultTheme
  const sheet = { presentation: 'modal' as const, contentStyle: { backgroundColor: t.c.bg } }
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: t.c.bg, card: t.c.panel, text: t.c.text, border: t.c.line, primary: t.c.accent } }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" options={sheet} />
        {/* no league yet: create one */}
        <Stack.Protected guard={phase === null}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={phase === 'draft'}>
          <Stack.Screen name="draft" />
        </Stack.Protected>
        <Stack.Protected guard={phase === 'season' || phase === 'complete'}>
          <Stack.Screen name="(tabs)" />
          {/* a page sheet like the others: on iOS 27 a formSheet doesn't draw its ScrollView (the sheet came up blank) */}
          <Stack.Screen name="add/[id]" options={sheet} />
          <Stack.Screen name="trade" options={sheet} />
          <Stack.Screen name="match" options={sheet} />
          <Stack.Screen name="live/[mi]" options={{ ...sheet, presentation: 'fullScreenModal' }} />
        </Stack.Protected>
        {/* player cards open from the draft room too */}
        <Stack.Protected guard={phase !== null}>
          <Stack.Screen name="player/[id]" options={sheet} />
        </Stack.Protected>
      </Stack>
      <ToastHost />
    </ThemeProvider>
  )
}
