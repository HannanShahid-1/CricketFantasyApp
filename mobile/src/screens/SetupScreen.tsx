import { useRef, useState, type RefObject } from 'react'
import { ScrollView, StyleSheet, TextInput, View, type ReturnKeyTypeOptions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createLeague, ROSTER_SIZE, SLOTS, type LeagueOptions } from '@shared/engine/league'
import { getData } from '@shared/store'
import {
  DEFAULT_LEAGUE_OPTIONS, DRAFT_SPEEDS, draftSlotLabel, leagueFormat, PICK_TIMERS, setupFeatures, TEAM_COUNTS, type DraftSpeed,
  type SetupFeature,
} from '@shared/ui/draft'
import { Stack } from 'expo-router'
import { quickStartLeague } from '@/data/boot'
import { addLeague, useLeagues } from '@/data/leagues'
import { nav } from '@/nav'
import { usePrefs } from '@/data/prefs'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, chooseOption, Icon, report, Row, RowIcon, Section, Segmented, type SFSymbol, SlotBadge, Txt } from '@/ui'

// First run: a welcome, then the league form (names, size, your draft slot, pick timer, AI speed) and the format.
// "Enter the draft room" creates the league in its draft phase and the root layout opens the draft room. With the
// testing tools on, Quick start skips the draft (the AI drafts every team).

const FEATURE_ICON: Record<SetupFeature, SFSymbol> = {
  draft: 'list.number',
  weeks: 'calendar',
  live: 'dot.radiowaves.left.and.right',
  moves: 'arrow.left.arrow.right',
}
const TEAMS = TEAM_COUNTS.map((n) => ({ key: String(n), label: `${n} teams` }))
const TIMERS = PICK_TIMERS.map((x) => ({ key: String(x.value), label: x.short }))
const SPEEDS = DRAFT_SPEEDS.map((x) => ({ key: x.value, label: x.label }))

export function SetupScreen() {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const insets = useSafeAreaInsets()
  const busy = useLeagues((st) => st.busy)
  const testingTools = usePrefs((st) => st.testingTools)
  const [o, setO] = useState<LeagueOptions>(DEFAULT_LEAGUE_OPTIONS)
  const [barHeight, setBarHeight] = useState(0)
  const teamInput = useRef<TextInput>(null)
  const set = <K extends keyof LeagueOptions>(k: K, v: LeagueOptions[K]) => setO((x) => ({ ...x, [k]: v }))
  const [roster, ...rules] = leagueFormat()

  const setTeams = (n: number) =>
    setO((x) => ({ ...x, numTeams: n, draftSlot: x.draftSlot !== 'random' && x.draftSlot > n ? 'random' : x.draftSlot }))

  const chooseSlot = () =>
    chooseOption<LeagueOptions['draftSlot']>({
      title: 'Draft slot',
      message: 'Where you pick in round 1. The order snakes back each round.',
      options: [
        { value: 'random', label: draftSlotLabel('random') },
        ...Array.from({ length: o.numTeams }, (_, i) => ({ value: i + 1, label: draftSlotLabel(i + 1) })),
      ],
      value: o.draftSlot,
      tint: t.c.accent,
      onChoose: (v) => set('draftSlot', v),
    })

  const start = async () => {
    if (await addLeague(createLeague(d, { ...o, name: o.name.trim(), teamName: o.teamName.trim() }))) nav.enterLeague()
  }

  const quickStart = async () => {
    if (await quickStartLeague()) { report(null, 'League ready: the AI drafted every team'); nav.enterLeague() }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'New IPL league', headerLeft: () => <Button title="Cancel" kind="plain" onPress={nav.close} /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: barHeight + 24, gap: 32 }}
      >
        <View style={s.hero}>
          <View style={s.appIcon}>
            <Icon name="cricket.ball.fill" size={46} color={t.c.liveInk} />
          </View>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Txt display weight={700} size={42} style={{ letterSpacing: 0.5 }}>Seam</Txt>
            <Txt up size={12} weight={600} tone="muted">Season-long fantasy cricket</Txt>
          </View>
          <Txt display weight={700} size={28} style={{ textAlign: 'center', lineHeight: 34, marginTop: 10 }}>
            Draft your XI.{'\n'}Own the <Txt display weight={700} size={28} tone="accent">season.</Txt>
          </Txt>
          <Txt size={15} tone="muted" style={{ textAlign: 'center', lineHeight: 21 }}>
            A Sleeper-style redraft league for the IPL. Snake draft against AI managers, set a weekly lineup, work the
            waiver wire and chase a title, replayed ball by ball from the real {d.raw.simSeason} season.
          </Txt>
        </View>

        <View style={s.features}>
          {setupFeatures(d).map((f) => (
            <View key={f.key} style={s.feature}>
              <View style={s.featureIcon}>
                <Icon name={FEATURE_ICON[f.key]} size={26} color={t.c.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={15.5} weight={600}>{f.title}</Txt>
                <Txt size={13.5} tone="muted" style={{ lineHeight: 18 }}>{f.detail}</Txt>
              </View>
            </View>
          ))}
        </View>

        <Section title="Your league">
          <Field
            label="League name"
            value={o.name}
            onChange={(v) => set('name', v)}
            placeholder="IPL Draft League"
            returnKeyType="next"
            onSubmit={() => teamInput.current?.focus()}
          />
          <Field inputRef={teamInput} label="Your team" value={o.teamName} onChange={(v) => set('teamName', v)} placeholder="My Team" returnKeyType="done" />
        </Section>

        <Section
          title="Draft"
          footer={`${o.numTeams - 1} AI managers fill the other seats. ${ROSTER_SIZE} rounds, snake order: it reverses every round.`}
        >
          <Row
            title="Teams"
            left={<RowIcon name="person.3.fill" color={t.c.sky} />}
            right={<Segmented options={TEAMS} value={String(o.numTeams)} onChange={(k) => setTeams(Number(k))} style={{ width: 170 }} />}
          />
          <Row
            title="Draft slot"
            left={<RowIcon name="number" color={t.c.gold} />}
            value={draftSlotLabel(o.draftSlot)}
            right={<Icon name="chevron.up.chevron.down" size={13} color={t.c.dim} weight="semibold" />}
            onPress={chooseSlot}
          />
          <Row
            title="Pick timer"
            subtitle={o.timer ? 'When it runs out, the AI picks for you.' : 'Take as long as you like.'}
            left={<RowIcon name="timer" color={t.c.live} />}
          >
            <Segmented options={TIMERS} value={String(o.timer)} onChange={(k) => set('timer', Number(k))} style={{ marginTop: 8 }} />
          </Row>
          <Row
            title="AI pick speed"
            subtitle="How quickly the AI managers pick. You can change it in the draft."
            left={<RowIcon name="hare.fill" color={t.c.win} />}
          >
            <Segmented<DraftSpeed> options={SPEEDS} value={o.speed} onChange={(k) => set('speed', k)} style={{ marginTop: 8 }} />
          </Row>
        </Section>

        <Section title="Format" footer={`${rules.join(' · ')}.`}>
          <View style={{ padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {SLOTS.map((slot, i) => <SlotBadge key={i} slot={slot} small />)}
            </View>
            <Txt size={14} tone="muted">{roster} · {ROSTER_SIZE} players per team</Txt>
          </View>
        </Section>
      </ScrollView>
      {/* no navigation bar on this screen: keep scrolled content out from under the status bar */}
      <View style={[s.statusBar, { height: insets.top }]} />

      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
        <Button title="Enter the draft room" kind="filled" size="large" disabled={busy || !o.name.trim() || !o.teamName.trim()} onPress={start} />
        {testingTools && <Button title="Quick start: the AI drafts for you" kind="plain" size="small" disabled={busy} onPress={quickStart} />}
      </View>
    </View>
  )
}

/** A form row: label on the left, the text field filling the right (tapping the label focuses the field). */
function Field({ inputRef, label, value, onChange, placeholder, returnKeyType, onSubmit }: {
  inputRef?: RefObject<TextInput | null>; label: string; value: string; onChange: (v: string) => void; placeholder: string
  returnKeyType: ReturnKeyTypeOptions; onSubmit?: () => void
}) {
  const t = useTheme()
  const own = useRef<TextInput>(null)
  const input = inputRef ?? own
  return (
    <Row
      title={label}
      onPress={() => input.current?.focus()}
      right={
        <TextInput
          ref={input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={t.c.dim}
          selectionColor={t.c.accent}
          keyboardAppearance={t.dark ? 'dark' : 'light'}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmit}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={32}
          clearButtonMode="while-editing"
          style={{ flex: 1.6, paddingVertical: 4, textAlign: 'right', color: t.c.text, fontFamily: t.font.body(400), fontSize: 16 }}
        />
      }
    />
  )
}

const styles = (t: Theme) => ({
  hero: { alignItems: 'center' as const, gap: 12, paddingTop: 8 },
  appIcon: {
    width: 84, height: 84, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: t.c.live,
    shadowColor: t.c.live, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
  },
  features: { gap: 18, paddingHorizontal: 8 },
  feature: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16 },
  featureIcon: { width: 36, alignItems: 'center' as const },
  statusBar: { position: 'absolute' as const, top: 0, left: 0, right: 0, backgroundColor: t.c.bg },
  bar: { position: 'absolute' as const, left: 0, right: 0, bottom: 0, gap: 4, paddingTop: 12, paddingHorizontal: 16, backgroundColor: t.c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line2 },
})
