import { Stack } from 'expo-router'
import { View } from 'react-native'
import { getData, useApp } from '@shared/store'
import { useLaunchIntro } from '@/components/LaunchIntro'
import { usePrefs } from '@/data/prefs'
import { nav } from '@/nav'
import { THEME_ORDER } from '@/generated/themes'
import { hasLightMode, themeLooks, useTheme, useThemeStore, type ColorMode, type ThemeId } from '@/theme/theme'
import { confirm, haptic, Icon, Row, RowIcon, Screen, Section, Segmented, SwitchRow, Txt } from '@/ui'

const MODES: { key: ColorMode; label: string }[] = [
  { key: 'system', label: 'Automatic' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
]

/** App settings (sheet from the gear button): theme and light/dark mode, testing tools, reset. */
export function SettingsScreen() {
  const t = useTheme()
  const themeId = useThemeStore((s) => s.id)
  const mode = useThemeStore((s) => s.mode)
  const testingTools = usePrefs((s) => s.testingTools)
  const hasLeague = useApp((s) => s.league !== null)

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          unstable_headerRightItems: () => [{ type: 'button', label: 'Done', variant: 'done', onPress: nav.close }],
        }}
      />
      <Screen>
        <Section
          title="Appearance"
          inset={64}
          footer={hasLightMode(themeId) ? `${t.name} has a light and a dark look. Automatic follows your iPhone's setting.` : undefined}
        >
          {THEME_ORDER.map((x) => {
            const id = x.id as ThemeId
            return (
              <Row
                key={x.id}
                title={x.name}
                left={<Swatch id={id} />}
                right={x.id === themeId ? <Icon name="checkmark" size={16} color={t.c.accent} weight="semibold" /> : undefined}
                onPress={() => {
                  haptic.select()
                  useThemeStore.getState().set(id)
                }}
              />
            )
          })}
          {hasLightMode(themeId) && (
            <View key="mode" style={{ padding: 12 }}>
              <Segmented options={MODES} value={mode} onChange={(m) => useThemeStore.getState().setMode(m)} />
            </View>
          )}
        </Section>

        <Section
          title="Testing"
          footer="Sim buttons, the Simulate menu and Quick start. Turn them off for the clean look of the real app: the season then moves on as you watch matches live."
        >
          <SwitchRow title="Testing tools" icon="hammer" value={testingTools} onChange={(v) => usePrefs.getState().setPref('testingTools', v)} />
        </Section>

        <Section>
          <Row
            title="Replay launch animation"
            left={<RowIcon name="play.circle" color={t.c.accent} />}
            onPress={() => {
              // it plays over the app, so close this sheet first
              nav.close()
              setTimeout(() => useLaunchIntro.getState().replay(), 450)
            }}
          />
        </Section>

        {hasLeague && (
          <Section footer="Deletes this league on this phone and starts over.">
            <Row
              title="Reset league"
              destructive
              left={<RowIcon name="arrow.counterclockwise" color={t.c.loss} />}
              onPress={async () => {
                if (await confirm({ title: 'Reset league?', message: 'This deletes the league and starts over.', ok: 'Reset', destructive: true })) {
                  useApp.getState().reset()
                  nav.home()
                }
              }}
            />
          </Section>
        )}

        <Txt size={12} tone="dim" style={{ textAlign: 'center' }}>
          Data: Cricsheet.org (ODC-BY) · IPL {getData().raw.simSeason} replay
        </Txt>
      </Screen>
    </>
  )
}

/** A theme's look in miniature: background, a card and the accent (split into its dark and light looks if it has both). */
function Swatch({ id }: { id: ThemeId }) {
  const t = useTheme()
  const looks = themeLooks(id)
  return (
    <View style={{ width: 36, height: 28, borderRadius: 7, borderWidth: 1, borderColor: t.c.line2, overflow: 'hidden', flexDirection: 'row' }}>
      {looks.map((look, i) => (
        <View key={look.key} style={{ flex: 1, backgroundColor: look.c.bg, padding: 4, paddingLeft: i ? 0 : 4, flexDirection: 'row', gap: 3 }}>
          <View style={{ flex: 1, borderRadius: 3, backgroundColor: look.c.panel }} />
          {i === looks.length - 1 && <View style={{ width: 7, borderRadius: 3, backgroundColor: look.c.accent }} />}
        </View>
      ))}
    </View>
  )
}
