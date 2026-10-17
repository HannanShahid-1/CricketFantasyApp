import { Stack, useIsFocused, type NativeStackHeaderItem } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import { teamOnClock, type League } from '@shared/engine/league'
import { ME, useApp } from '@shared/store'
import { aiPickDelay, currentSlot, DRAFT_SPEEDS, picksUntil } from '@shared/ui/draft'
import { deleteActiveLeague } from '@/data/leagues'
import { nav } from '@/nav'
import { useGameLeague } from '@/data/gameLeague'
import { DraftBoardGrid } from '@/components/draft/DraftBoardGrid'
import { DraftQueue } from '@/components/draft/DraftQueue'
import { DraftRoster } from '@/components/draft/DraftRoster'
import { DraftTicker } from '@/components/draft/DraftTicker'
import { PickClock } from '@/components/draft/PickClock'
import { PlayerPool } from '@/components/draft/PlayerPool'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, confirm, haptic, Icon, report, Segmented, TeamBadge, Txt, type SFSymbol } from '@/ui'

// The live snake draft. The on-the-clock card, the pick ticker and the tabs stay put; the player pool, your queue,
// your team and the board scroll beneath them. AI managers pick on a timer set by the draft speed; when you're up, your
// pick timer (if the league has one) counts down and the AI picks for you at zero. Pause stops both. When the last pick
// is made the league moves to the season and the root layout takes you to the tabs.

type Pane = 'players' | 'queue' | 'team' | 'board'

/** Let the AI make your pick (your queue first), if you're still on the clock. */
function autopick() {
  const { league, draftAuto } = useApp.getState()
  if (league && teamOnClock(league) === ME) draftAuto()
}

export function DraftScreen() {
  const league = useGameLeague()
  useEffect(() => { if (league && league.phase !== 'draft') nav.enterLeague() }, [league?.phase])
  return league?.phase === 'draft' ? <DraftRoom key={league.createdAt} league={league} /> : null
}

function DraftRoom({ league }: { league: League }) {
  const t = useTheme()
  const s = useStyles(styles)
  const { draftAuto, setDraftSpeed } = useApp(useShallow((st) => ({ draftAuto: st.draftAuto, setDraftSpeed: st.setDraftSpeed })))
  const focused = useIsFocused()
  const [paused, setPaused] = useState(false)
  const [autoMe, setAutoMe] = useState(false)
  const [pane, setPane] = useState<Pane>('players')

  const cur = currentSlot(league)
  const onClock = cur?.teamId ?? null
  const mine = onClock === ME
  const made = league.draft.picks.length
  const speed = league.draft.speed
  const queued = league.draft.queue.length

  // AI managers (and auto-draft, for you) pick after a pause that depends on the draft speed
  useEffect(() => {
    if (!focused || paused || onClock === null || (mine && !autoMe)) return
    const id = setTimeout(draftAuto, aiPickDelay(speed))
    return () => clearTimeout(id)
  }, [focused, paused, onClock, mine, autoMe, made, speed, draftAuto])

  // your turn: a notification tap, every time you come on the clock
  useEffect(() => {
    if (mine && !autoMe) haptic.success()
  }, [mine, made, autoMe])

  useEffect(() => {
    if (onClock === null) report(null, 'Draft complete. Good luck this season!')
  }, [onClock])

  const options = useMemo(() => {
    const sf = (name: SFSymbol) => ({ type: 'sfSymbol' as const, name })
    const items: NativeStackHeaderItem[] = [
      {
        type: 'button', label: paused ? 'Resume' : 'Pause', icon: sf(paused ? 'play.fill' : 'pause.fill'), tintColor: t.c.text,
        accessibilityLabel: paused ? 'Resume the draft' : 'Pause the draft',
        onPress: () => {
          haptic.select()
          setPaused((p) => !p)
        },
      },
      {
        type: 'menu', label: 'Draft options', icon: sf('ellipsis'), tintColor: t.c.text,
        menu: {
          title: league.name,
          items: [
            { type: 'action', label: 'Autopick this pick', description: 'Takes from your queue first', icon: sf('bolt.fill'), disabled: !mine, onPress: autopick },
            {
              type: 'action', label: 'Auto-draft for me', description: 'The AI makes the rest of your picks', icon: sf('cpu'),
              state: autoMe ? 'on' : 'off', onPress: () => setAutoMe((a) => !a),
            },
            {
              type: 'submenu', label: 'AI pick speed', inline: true,
              items: DRAFT_SPEEDS.map((x) => ({
                type: 'action' as const, label: `${x.label} (${x.short})`, state: x.value === speed ? 'on' as const : 'off' as const,
                onPress: () => setDraftSpeed(x.value),
              })),
            },
            {
              type: 'action', label: 'Start over', description: 'Deletes this league', icon: sf('arrow.counterclockwise'), destructive: true,
              onPress: async () => {
                if (await confirm({ title: 'Start over?', message: 'This deletes the league and its draft.', ok: 'Delete league', destructive: true })) {
                  if (await deleteActiveLeague()) nav.home()
                }
              },
            },
          ],
        },
      },
    ]
    return {
      headerShown: true,
      title: 'Draft',
      headerBackVisible: false,
      gestureEnabled: false,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: t.c.bg },
      headerTintColor: t.c.accent,
      headerTitleStyle: { fontFamily: t.font.display(700), color: t.c.text },
      unstable_headerLeftItems: (): NativeStackHeaderItem[] => [{ type: 'button', label: 'All leagues', icon: sf('house'), onPress: nav.home }],
      unstable_headerRightItems: () => items,
    }
  }, [t, league.name, paused, autoMe, mine, speed, setDraftSpeed])

  const panes = useMemo(() => [
    { key: 'players' as const, label: 'Players' },
    { key: 'queue' as const, label: queued ? `Queue (${queued})` : 'Queue' },
    { key: 'team' as const, label: 'My Team' },
    { key: 'board' as const, label: 'Board' },
  ], [queued])

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen options={options} />
      <OnTheClock league={league} paused={paused || !focused} autoMe={autoMe} onResume={() => setPaused(false)} />
      <DraftTicker league={league} />
      <Segmented options={panes} value={pane} onChange={setPane} style={s.tabs} />
      {/* the pool stays mounted so its filters and scroll position survive a look at the other tabs */}
      <PlayerPool league={league} canPick={mine} hidden={pane !== 'players'} />
      {pane === 'queue' && <DraftQueue league={league} canPick={mine} />}
      {pane === 'team' && <DraftRoster league={league} />}
      {pane === 'board' && <DraftBoardGrid league={league} />}
    </View>
  )
}

/** Who is picking, where the draft is, and your countdown or how long until you're up. */
function OnTheClock({ league, paused, autoMe, onResume }: { league: League; paused: boolean; autoMe: boolean; onResume: () => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const cur = currentSlot(league)
  if (!cur) {
    return (
      <View style={s.card}>
        <Icon name="checkmark.seal.fill" size={40} color={t.c.accent} />
        <View style={s.cardText}>
          <Txt display weight={700} size={19}>Draft complete</Txt>
          <Txt size={13} tone="muted">Setting up your season…</Txt>
        </View>
      </View>
    )
  }
  const team = league.teams[cur.teamId]
  const mine = cur.teamId === ME
  const yours = mine && !autoMe
  const timed = yours && league.draft.timer > 0
  const until = mine ? 0 : picksUntil(league, ME)
  const eyebrow = paused ? 'Draft paused' : mine ? (autoMe ? 'Auto-drafting for you' : 'You’re on the clock') : 'On the clock'

  return (
    <View style={[s.card, mine && s.cardMine]}>
      <TeamBadge team={team} size={46} />
      <View style={s.cardText}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt up size={11} weight={700} tone={paused ? 'gold' : mine ? 'accent' : 'muted'} numberOfLines={1}>{eyebrow}</Txt>
          {!paused && !yours && <ActivityIndicator size="small" color={t.c.dim} style={{ transform: [{ scale: 0.7 }], marginVertical: -6 }} />}
        </View>
        <Txt display weight={700} size={19} numberOfLines={1}>{team.name}</Txt>
        <Txt size={12.5} tone="muted" numberOfLines={1}>
          Round {cur.round}/{league.draft.rounds} · Pick {cur.pick} · #{cur.overall}
        </Txt>
      </View>
      {/* kept mounted while paused so the countdown resumes where it stopped; a new pick (key) restarts it */}
      {timed && <PickClock key={cur.overall} total={league.draft.timer} paused={paused} onExpire={autopick} />}
      {paused ? (
        <Button title={timed ? undefined : 'Resume'} icon="play.fill" kind="tinted" size="small" onPress={onResume} accessibilityLabel="Resume the draft" />
      ) : yours ? (
        <Button title={timed ? undefined : 'Autopick'} icon="bolt.fill" kind="tinted" size="small" onPress={autopick} accessibilityLabel="Autopick: the AI picks for you, from your queue first" />
      ) : !mine && until !== null ? (
        <View style={s.until} accessibilityLabel={`Your pick in ${until}`}>
          <Txt num weight={700} size={22} tone="accent">{until}</Txt>
          <Txt size={10} tone="dim" weight={600}>{until === 1 ? 'PICK AWAY' : 'PICKS AWAY'}</Txt>
        </View>
      ) : null}
    </View>
  )
}

const styles = (t: Theme) => ({
  card: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 78, marginHorizontal: 16, marginTop: 8, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: t.r.lg, backgroundColor: t.c.panel, borderWidth: 1, borderColor: 'transparent',
  },
  cardMine: { backgroundColor: alpha(t.c.accent, 0.12), borderColor: alpha(t.c.accent, 0.45) },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  until: { alignItems: 'center' as const, minWidth: 54 },
  tabs: { marginHorizontal: 16, marginTop: 14, marginBottom: 12 },
})
