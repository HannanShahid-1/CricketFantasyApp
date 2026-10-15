import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { restOfSeason } from '@shared/engine/data'
import {
  currentWeek, isLocked, managerName, slotLocked, TRADE_DEADLINE_WEEK, tradeProblem, type League,
} from '@shared/engine/league'
import { getData, ME } from '@shared/store'
import { pendingOffers } from '@shared/ui/transactions'
import { PICK_INSET, PickRow } from '@/components/sheets/PickRow'
import { SheetFooter } from '@/components/sheets/SheetChrome'
import { TradeBoard, useTradeHeader, type TradeSide } from '@/components/trade/parts'
import { useGameLeague } from '@/data/gameLeague'
import { intParam, nav } from '@/nav'
import { useTheme } from '@/theme/theme'
import { Button, chooseOption, EmptyState, Section, Segmented, Txt } from '@/ui'

// Propose a trade, step 1: build it. The board at the top always shows the deal so far (what you give, what you
// get); below it, one roster at a time to pick from. Review Trade (step 2) shows the whole deal, takes a message and
// sends it to your DM with that manager.

export function TradeScreen() {
  const param = intParam(useLocalSearchParams<{ team: string }>().team)
  const d = getData()
  const t = useTheme()
  const league = useGameLeague()
  const [other, setOther] = useState(() => {
    const ids = league?.teams.filter((x) => !x.isUser).map((x) => x.id) ?? []
    return ids.includes(param) ? param : (ids[0] ?? 1)
  })
  // start on their roster: you usually know who you want first
  const [side, setSide] = useState<TradeSide>('get')
  const [give, setGive] = useState<number[]>([])
  const [get, setGet] = useState<number[]>([])
  const toggleGive = useCallback((p: number) => setGive(flip(p)), [])
  const toggleGet = useCallback((p: number) => setGet(flip(p)), [])
  const mine = useRoster(league, ME)
  const theirs = useRoster(league, other)
  const header = <Stack.Screen options={useTradeHeader('Propose Trade', true)} />

  if (!league) return header
  const them = league.teams[other]
  if (league.phase !== 'season' || currentWeek(d, league) >= TRADE_DEADLINE_WEEK) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        {header}
        <EmptyState
          icon="clock.badge.xmark"
          title={league.phase !== 'season' ? 'Trades are closed' : 'The trade deadline has passed'}
          message={league.phase !== 'season' ? 'The season is over.' : `Trades closed at the start of Week ${TRADE_DEADLINE_WEEK}.`}
        />
      </View>
    )
  }

  const picked = give.length + get.length > 0
  const complete = give.length > 0 && get.length > 0
  const problem = complete ? tradeProblem(d, league, ME, other, give, get) : null
  const pending = pendingOffers(league, ME, other)
  // an empty side is a step, not an error: say what's left to pick
  const status = !picked
    ? pending
      ? `You already have ${pending} offer${pending > 1 ? 's' : ''} waiting on ${managerName(them)}.`
      : 'Pick who you give and who you get, any number each way.'
    : !give.length
      ? 'Now pick who you give.'
      : !get.length
        ? `Now pick who you get from ${managerName(them)}.`
        : problem

  const chooseTeam = () =>
    chooseOption({
      title: 'Trade with',
      options: league.teams.filter((x) => !x.isUser).map((x) => ({ value: x.id, label: `${x.name} (${managerName(x)})` })),
      value: other,
      tint: t.c.accent,
      onChoose: (id) => {
        setOther(id)
        setGet([])
        setSide('get')
      },
    })

  const list = side === 'give' ? mine : theirs
  const on = side === 'give' ? give : get
  const toggle = side === 'give' ? toggleGive : toggleGet
  const rows = (pids: { pid: number; note?: string }[]) =>
    pids.map((r) => <PickRow key={r.pid} pid={r.pid} locked={false} note={r.note} on={on.includes(r.pid)} mark="check" onPick={toggle} />)

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {header}
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 12 }}>
        <TradeBoard
          me={league.teams[ME]}
          them={them}
          give={give}
          get={get}
          side={side}
          onSide={setSide}
          onRemove={(s, p) => (s === 'give' ? toggleGive(p) : toggleGet(p))}
          onChangeTeam={chooseTeam}
        />
        <Segmented
          options={[
            { key: 'give', label: 'Your roster' },
            { key: 'get', label: `${managerName(them)}'s roster` },
          ]}
          value={side}
          onChange={setSide}
        />
      </View>
      {/* a fresh list per side, so switching starts at the top */}
      <ScrollView key={side} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 20 }}>
        <Section title="Starting XI" inset={PICK_INSET.check}>{rows(list.xi)}</Section>
        {list.bench.length > 0 && <Section title="Bench" inset={PICK_INSET.check}>{rows(list.bench)}</Section>}
        <Txt size={12.5} tone="dim" style={{ paddingHorizontal: 16, lineHeight: 17 }}>
          Players who have already played this week can be traded: their points this week stay with the team they played
          for. Trade deadline: start of Week {TRADE_DEADLINE_WEEK}.
        </Txt>
      </ScrollView>
      <SheetFooter>
        {status && <Txt size={12.5} tone={problem ? 'loss' : 'dim'} style={{ textAlign: 'center' }} numberOfLines={2}>{status}</Txt>}
        <Button
          title="Review Trade"
          kind="filled"
          size="large"
          disabled={!complete || !!problem}
          onPress={() => nav.tradeReview(other, give, get)}
        />
      </SheetFooter>
    </View>
  )
}

/** Add `p` to a selection, or take him out. */
const flip = (p: number) => (xs: number[]) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p])

/**
 * A roster to pick from: the starting XI in lineup order, then the bench (best rest-of-season value first). Players
 * who have already played this week carry a note on what that means for this trade.
 */
function useRoster(league: League | null, teamId: number) {
  return useMemo(() => {
    if (!league) return { xi: [], bench: [] }
    const d = getData()
    const team = league.teams[teamId]
    const note = (pid: number) =>
      !isLocked(d, league, pid)
        ? undefined
        : teamId !== ME
          ? 'Played · next week'
          : team.starters.includes(pid) && slotLocked(d, league, ME, pid)
            ? 'Played · points stay'
            : 'Played this week'
    const row = (pid: number) => ({ pid, note: note(pid) })
    const xi = team.starters.filter((p): p is number => p !== null).map(row)
    const bench = team.roster
      .filter((p) => !team.starters.includes(p))
      .sort((a, b) => restOfSeason(d, d.players[b], league.played) - restOfSeason(d, d.players[a], league.played))
      .map(row)
    return { xi, bench }
  }, [league, teamId])
}
