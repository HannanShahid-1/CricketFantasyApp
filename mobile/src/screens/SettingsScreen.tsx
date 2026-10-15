import { Stack } from 'expo-router'
import { View } from 'react-native'
import { getData, useApp } from '@shared/store'
import { useLaunchIntro } from '@/components/LaunchIntro'
import { usePrefs } from '@/data/prefs'
import { nav } from '@/nav'
import { THEME_ORDER, THEME_TOKENS } from '@/generated/themes'
import { useTheme, useThemeStore, type ThemeId } from '@/theme/theme'
import { confirm, haptic, Icon, Row, RowIcon, Screen, Section, SwitchRow, Txt } from '@/ui'

/** App settings (sheet from the "…" menu): theme, testing tools, reset. */
export function SettingsScreen() {
  const t = useTheme()
  const themeId = useThemeStore((s) => s.id)
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
        <Section title="Appearance" inset={64}>
          {THEME_ORDER.map((x) => {
            const tok = THEME_TOKENS[x.id as ThemeId]
            return (
              <Row
                key={x.id}
                title={x.name}
                left={<Swatch bg={tok.bg} panel={tok.panel} accent={tok.accent} />}
                right={x.id === themeId ? <Icon name="checkmark" size={16} color={t.c.accent} weight="semibold" /> : undefined}
                onPress={() => {
                  haptic.select()
                  useThemeStore.getState().set(x.id as ThemeId)
                }}
              />
            )
          })}
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

/** A theme's look in miniature: background, a card and the accent. */
function Swatch({ bg, panel, accent }: { bg: string; panel: string; accent: string }) {
  const t = useTheme()
  return (
    <View style={{ width: 36, height: 28, borderRadius: 7, backgroundColor: bg, borderWidth: 1, borderColor: t.c.line2, padding: 4, flexDirection: 'row', gap: 3 }}>
      <View style={{ flex: 1, borderRadius: 3, backgroundColor: panel }} />
      <View style={{ width: 7, borderRadius: 3, backgroundColor: accent }} />
    </View>
  )
}
