import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, TextInput, View } from 'react-native'
import { dmChannel } from '@shared/engine/chat'
import { managerName, ROSTER_SIZE, tradeProblem, type FTeam } from '@shared/engine/league'
import { getData, ME, useApp } from '@shared/store'
import { tradeBalance, tradeImpact } from '@shared/ui/transactions'
import { SheetFooter } from '@/components/sheets/SheetChrome'
import { TradeSummary, tradeVerdict, useTradeHeader } from '@/components/trade/parts'
import { useGameLeague } from '@/data/gameLeague'
import { intParam, nav } from '@/nav'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, EmptyState, report, Row, RowIcon, Section, Txt, type SFSymbol } from '@/ui'

// Propose a trade, step 2: the whole deal at a glance, how it compares on projections, an optional message, Send.

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
  const balance = tradeBalance(d, league, ME, give, get)
  const verdict = tradeVerdict(balance.give, balance.get)
  const notes = whatHappens(them, tradeImpact(d, league, ME, other, give, get))
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
        <Section title="What happens" footer="Trades go through when the commissioner approves them, or when the next match starts.">
          {notes.map((n) => (
            <Row
              key={n.title}
              left={<RowIcon name={n.icon} color={t.c[n.tone]} />}
              title={n.title}
              subtitle={<Txt size={13} tone="muted" style={{ lineHeight: 18 }}>{n.detail}</Txt>}
            />
          ))}
        </Section>
        <Section footer="Compares each side's projected points for the rest of the season, counting anyone you'd have to drop.">
          <Row left={<RowIcon name={verdict.icon} color={t.c[verdict.tone]} />} title={verdict.title} subtitle={verdict.detail} />
        </Section>
        <Section
          title={`Message to ${managerName(them)}`}
          footer={`The offer lands in your chat with ${managerName(them)}. Once accepted, the commissioner can approve or veto it until the next match starts.`}
        >
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

type Note = { title: string; detail: string; icon: SFSymbol; tone: 'sky' | 'gold' | 'accent' | 'muted' }

/** "A, B and C" */
const names = (ps: number[]) => {
  const n = ps.map((p) => getData().players[p].name)
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n[0]
}

/** The consequences of the deal, in plain words: who finishes the week where, and who has to drop players. */
function whatHappens(them: FTeam, impact: ReturnType<typeof tradeImpact>): Note[] {
  const { staying, nextWeek, mine, theirs } = impact
  const out: Note[] = []
  const who = managerName(them)
  if (staying.length) {
    const one = staying.length === 1
    out.push({
      title: `${names(staying)} ${one ? 'has' : 'have'} already played for you`,
      detail: `${one ? 'His' : 'Their'} points this week stay yours. ${one ? "He's" : "They're"} Off Roster in your lineup until the week ends, then ${one ? 'joins' : 'join'} ${who}.`,
      icon: 'lock.fill', tone: 'sky',
    })
  }
  if (nextWeek.length) {
    const one = nextWeek.length === 1
    out.push({
      title: `${names(nextWeek)} ${one ? 'has' : 'have'} already played this week`,
      detail: `${one ? 'He joins' : 'They join'} your bench now and can start for you from next week.`,
      icon: 'calendar', tone: 'sky',
    })
  }
  if (mine > ROSTER_SIZE) {
    const n = mine - ROSTER_SIZE
    out.push({
      title: `You'll have ${mine} players: drop ${n}`,
      detail: `Until you're back to ${ROSTER_SIZE}, your lineup is frozen and you can't add players. Still over at the end of the week? Your lowest-projected bench ${n === 1 ? 'player is' : 'players are'} dropped for you.`,
      icon: 'person.badge.minus', tone: 'gold',
    })
  } else if (mine < ROSTER_SIZE) {
    out.push({
      title: `You'll have ${mine} players`,
      detail: `That opens ${ROSTER_SIZE - mine === 1 ? 'a roster spot' : `${ROSTER_SIZE - mine} roster spots`} for free agents or waiver claims.`,
      icon: 'person.badge.plus', tone: 'accent',
    })
  }
  if (theirs > ROSTER_SIZE) {
    out.push({
      title: `${them.name} will have ${theirs} players`,
      detail: `${who} will drop ${theirs - ROSTER_SIZE} to make room.`,
      icon: 'person.2', tone: 'muted',
    })
  }
  if (!out.length) {
    out.push({ title: 'A straight swap', detail: 'Everyone can play for their new team right away.', icon: 'checkmark.circle.fill', tone: 'accent' })
  }
  return out
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
