import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { dmChannel } from '@shared/engine/chat'
import { managerName, tradeProblem } from '@shared/engine/league'
import { getData, ME, useApp } from '@shared/store'
import { SheetFooter } from '@/components/sheets/SheetChrome'
import { TradeSummary, useTradeHeader } from '@/components/trade/parts'
import { useGameLeague } from '@/data/gameLeague'
import { intParam, nav } from '@/nav'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, EmptyState, report, Section, Txt } from '@/ui'

// Propose a trade, step 2: the whole deal at a glance, an optional message, Send.

/** "3,7,12" → [3, 7, 12] */
const ids = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v ?? '').split(',').filter(Boolean).map(Number)

export function TradeReviewScreen() {
  const params = useLocalSearchParams<{ team: string; give: string; get: string }>()
  const other = intParam(params.team)
  const give = ids(params.give)
  const get = ids(params.get)
  const d = getData()
  const t = useTheme()
  const league = useGameLeague()
  const proposeTrade = useApp((s) => s.proposeTrade)
  const [note, setNote] = useState('')
  const header = <Stack.Screen options={useTradeHeader('Review Trade', false)} />

  const them = league?.teams[other]
  if (!league || !them || them.isUser) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        {header}
        <EmptyState icon="arrow.left.arrow.right" title="Trade not found" />
      </View>
    )
  }
  // checked again here: a sim since step 1 can lock a player or end trading
  const problem = tradeProblem(d, league, ME, other, give, get)
  const send = () => {
    if (!report(proposeTrade(other, give, get, note.trim()), `Offer sent to ${managerName(them)}`)) return
    nav.chat(dmChannel(ME, other))
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 22 }}
      >
        <TradeSummary me={league.teams[ME]} them={them} give={give} get={get} />
        <Section title={`Message to ${managerName(them)}`}>
          <NoteField value={note} onChange={setNote} placeholder="Optional: make your pitch" />
        </Section>
      </ScrollView>
      <SheetFooter>
        {problem && <Txt size={12.5} tone="loss" style={{ textAlign: 'center' }} numberOfLines={2}>{problem}</Txt>}
        <Button title={`Send Offer to ${managerName(them)}`} icon="paperplane.fill" kind="filled" size="large" disabled={!!problem} onPress={send} />
      </SheetFooter>
    </View>
  )
}

function NoteField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const t = useTheme()
  const s = useStyles(styles)
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.c.dim}
        maxLength={200}
        multiline
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        keyboardAppearance={t.dark ? 'dark' : 'light'}
        selectionColor={t.c.accent}
        style={[s.note, { fontFamily: t.font.body(400) }]}
      />
      {value.length > 150 && <Txt num size={11} tone="dim" style={s.count}>{value.length}/200</Txt>}
    </View>
  )
}

const styles = (t: Theme) => ({
  note: { minHeight: 80, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontSize: 16, color: t.c.text, textAlignVertical: 'top' as const },
  count: { position: 'absolute' as const, right: 12, bottom: 8 },
})
