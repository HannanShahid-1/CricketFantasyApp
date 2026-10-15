import { Stack, type NativeStackHeaderItem } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import { restOfSeason, seasonToDate } from '@shared/engine/data'
import {
  canFillLineup, currentWeek, isLocked, isOffRoster, overLimit, overLimitMessage, playerWeek, ROSTER_SIZE, slotLocked,
  SLOTS, weekMatches, type League,
} from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import { applyMove, canMove, ordinal, sameSpot, spotPlayer, type LineupSpot } from '@shared/ui/lineup'
import { useGameLeague } from '@/data/gameLeague'
import { MatchPicker } from '@/components/MatchPicker'
import { ownersOf, recordOf, standingsOf } from '@/data/derived'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import {
  Button, chooseOption, confirm, haptic, Icon, PlayerAvatar, PlayerLine, PlayerLink, report, RoleTag, Row, Screen,
  Section, SlotBadge, TeamBadge, TeamTag, Tiles, Txt, useSettingsButton,
} from '@/ui'

// My Team tab: your lineup for this week. Tap a player's row to pick him up, tap a highlighted row to put him there
// (the move rules are shared with the web in `ui/lineup`). Press and hold a player for his card or to drop him.
// Tap a player's name for his card. Lineup tools (optimise, auto-sub, auto-set) and Propose trade are header buttons,
// so the XI starts at the top.

/** How a lineup row looks while you move someone: the one you picked, a place he can go, or neither. */
type Mode = 'idle' | 'selected' | 'target' | 'muted'

interface Item {
  key: string
  slot: string
  spot: LineupSpot
  pid: number | null
  mode: Mode
}

export function TeamScreen() {
  const t = useTheme()
  const d = getData()
  const league = useGameLeague()!
  const { setStarters, optimize, toggleAutoSub, toggleAutoLineup, cancelClaim, notify } = useApp(useShallow((s) => ({
    setStarters: s.setStarters, optimize: s.optimize, toggleAutoSub: s.toggleAutoSub, toggleAutoLineup: s.toggleAutoLineup,
    cancelClaim: s.cancelClaim, notify: s.notify,
  })))
  const over = overLimit(league, ME)
  const [picked, setPicked] = useState<LineupSpot | null>(null)
  const me = league.teams[ME]
  const { autoSub } = me
  const autoLineup = !!me.autoLineup
  const firstRival = league.teams[1].id
  const week = currentWeek(d, league)
  const done = league.phase === 'complete'
  const st = me.starters
  const bench = me.roster.filter((p) => !st.includes(p))
  const locked = (p: number) => done || slotLocked(d, league, ME, p, week)

  // A pick goes stale if the league moves on under it (a sim locks him, an auto-sub benches him): drop it then.
  const pickedPid = picked && spotPlayer(st, picked)
  const sel = picked && !done && (picked.kind === 'slot' || bench.includes(picked.p)) && (pickedPid === null || !locked(pickedPid)) ? picked : null

  const item = (key: string, slot: string, spot: LineupSpot, pid: number | null): Item => ({
    key, slot, spot, pid,
    mode: !sel ? 'idle' : sameSpot(sel, spot) ? 'selected' : canMove(d, st, sel, spot, locked) ? 'target' : 'muted',
  })
  const xi = SLOTS.map((slot, i) => item(`s${i}`, slot, { kind: 'slot', i }, st[i]))
  const bn = bench.map((p) => item(`b${p}`, 'BN', { kind: 'bench', p }, p))
  const anyTarget = sel !== null && [...xi, ...bn].some((x) => x.mode === 'target')

  const tap = (spot: LineupSpot, pid: number | null) => {
    // over the roster limit after a trade: the lineup is frozen until you drop someone
    if (over) return notify(overLimitMessage(over), 'info')
    if (sel && canMove(d, st, sel, spot, locked)) {
      setPicked(null)
      report(setStarters(applyMove(st, sel, spot)))
      return
    }
    haptic.select()
    if (sel && sameSpot(sel, spot)) return setPicked(null)
    if (pid !== null && locked(pid)) return notify(`${d.players[pid].name} is locked: the match that counts for him has started`, 'info')
    setPicked(spot)
  }

  /** What tapping a highlighted row does, from that row's point of view. */
  const cta = (to: LineupSpot) =>
    sel?.kind === 'slot' && st[sel.i] === null ? `Move to ${SLOTS[sel.i]}` : to.kind === 'slot' && st[to.i] === null ? 'Move here' : 'Swap'

  const row = (x: Item) => (
    <LineupRow
      key={x.key}
      league={league}
      week={week}
      slot={x.slot}
      pid={x.pid}
      mode={x.mode}
      cta={x.mode === 'target' ? cta(x.spot) : undefined}
      locked={x.pid !== null && locked(x.pid)}
      onPress={done ? undefined : () => tap(x.spot, x.pid)}
    />
  )

  const settings = useSettingsButton()
  const headerItems = useMemo(() => {
    const lineup: NativeStackHeaderItem = {
      type: 'menu',
      label: 'Lineup',
      icon: { type: 'sfSymbol', name: 'wand.and.stars' },
      tintColor: t.c.accent,
      menu: {
        title: 'Lineup',
        items: [
          {
            type: 'action', label: 'Optimise lineup', description: 'Best XI by projection, around locked players',
            icon: { type: 'sfSymbol', name: 'wand.and.stars' }, disabled: done,
            onPress: () => {
              setPicked(null)
              report(optimize(), 'Lineup optimised by projection')
            },
          },
          {
            type: 'submenu', label: 'Automatic', inline: true, items: [
              {
                type: 'action', label: 'Auto-sub', description: 'Bring in a bench player when a starter misses the XI',
                icon: { type: 'sfSymbol', name: 'arrow.triangle.2.circlepath' }, state: autoSub ? 'on' : 'off',
                onPress: () => {
                  toggleAutoSub()
                  report(null, autoSub ? 'Auto-sub off' : 'Auto-sub on')
                },
              },
              {
                type: 'action', label: 'Auto-set weekly', description: 'Re-optimise your lineup at the start of every week',
                icon: { type: 'sfSymbol', name: 'calendar.badge.clock' }, state: autoLineup ? 'on' : 'off',
                onPress: () => {
                  toggleAutoLineup()
                  report(null, autoLineup ? 'Auto-set weekly off' : 'Auto-set weekly on')
                },
              },
            ],
          },
        ],
      },
    }
    const trade: NativeStackHeaderItem = {
      type: 'button',
      label: 'Propose a trade',
      icon: { type: 'sfSymbol', name: 'arrow.left.arrow.right' },
      tintColor: t.c.text,
      disabled: done,
      onPress: () => nav.trade(firstRival),
    }
    return () => [trade, lineup, ...settings()]
  }, [t, settings, done, autoSub, autoLineup, firstRival, optimize, toggleAutoSub, toggleAutoLineup])

  // while moving, the Starting XI header says who (or why nothing lights up) and offers Cancel
  const moving = !sel
    ? null
    : pickedPid !== null
      ? anyTarget ? `Moving ${d.players[pickedPid].name}` : `Nowhere for ${d.players[pickedPid].name} to go`
      : sel.kind === 'slot'
        ? anyTarget ? `Filling a ${SLOTS[sel.i]} slot` : 'Nobody can fill this slot'
        : null

  return (
    <Screen gap={18}>
      <Stack.Screen options={{ unstable_headerRightItems: headerItems }} />
      <TeamHeader league={league} week={week} />
      {over > 0 && !done && <OverLimit league={league} over={over} />}

      <Section
        title={moving ?? 'Starting XI'}
        inset={ROW_INSET}
        action={moving && (
          // text-sized, so the rows don't shift when you pick someone up
          <Pressable hitSlop={12} onPress={() => setPicked(null)} accessibilityRole="button">
            {({ pressed }) => <Txt size={13} weight={600} tone="accent" style={{ opacity: pressed ? 0.5 : 1 }}>Cancel</Txt>}
          </Pressable>
        )}
      >
        {xi.map(row)}
      </Section>

      <Section
        title={me.roster.length < ROSTER_SIZE ? `Bench · ${ROSTER_SIZE - me.roster.length} open spot${ROSTER_SIZE - me.roster.length > 1 ? 's' : ''}` : 'Bench'}
        inset={ROW_INSET}
        footer={
          <Txt size={12.5} tone="dim" style={{ lineHeight: 17 }}>
            <Txt size={12.5} weight={700} tone="muted">One match counts. </Txt>
            Only one match per player counts each week: his first, unless you lock in another before his first match
            starts. After that the choice is closed, and he is fixed in your lineup once the match that counts for him
            begins.
          </Txt>
        }
      >
        {bn.length ? bn.map(row) : <Row title={<Txt size={15} tone="muted">No bench players</Txt>} />}
      </Section>

      <Claims
        league={league}
        onCancel={(id, name) => {
          cancelClaim(id)
          report(null, `Claim for ${name} cancelled`)
        }}
      />
    </Screen>
  )
}

/** Badge, name and record, then this week's projection, FAAB and waiver priority. */
function TeamHeader({ league, week }: { league: League; week: number }) {
  const d = getData()
  const me = league.teams[ME]
  const table = standingsOf(league)
  const rank = table.findIndex((r) => r.teamId === ME)
  const proj = me.starters.reduce<number>((a, p) => a + (p === null ? 0 : playerWeek(d, league, ME, p, week).total), 0)
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TeamBadge team={me} size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt display weight={700} size={19} numberOfLines={1}>{me.name}</Txt>
          <Txt tone="muted" size={14} numberOfLines={1}>
            {recordOf(league, ME)} · {ordinal(rank + 1)} in league · {fmt(table[rank].pf, 1)} PF
          </Txt>
        </View>
      </View>
      <Tiles
        items={[
          { label: `${weekLabel(week)} proj`, value: fmt(proj, 1), tone: 'accent' },
          { label: 'FAAB left', value: `$${me.faab}` },
          { label: 'Waiver order', value: `#${league.waiverOrder.indexOf(ME) + 1}` },
        ]}
      />
    </View>
  )
}

/**
 * One lineup row: slot, player, his team and role, points banked this week (with the projection while his match is
 * still to come) and his season total, then the "which match counts" picker when he plays this week.
 */
function LineupRow({ league, week, slot, pid, mode, cta, locked, onPress }: {
  league: League; week: number; slot: string; pid: number | null; mode: Mode; cta?: string; locked: boolean; onPress?: () => void
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const p = pid === null ? null : d.players[pid]
  const wp = pid === null ? null : playerWeek(d, league, ME, pid, week)
  const plays = pid !== null && weekMatches(d, pid, week).length > 0
  // traded away after his counting match started: his points still count here this week
  const offRoster = pid !== null && isOffRoster(league, ME, pid)
  const newTeam = offRoster && pid !== null ? league.teams[ownersOf(league).get(pid) ?? ME].name : ''

  const meta =
    mode === 'selected' ? (
      <Txt size={12} weight={600} tone="accent">Tap again to cancel</Txt>
    ) : mode === 'target' ? (
      <View style={s.cta}>
        <Icon name="arrow.up.arrow.down" size={10} color={t.c.sky} weight="bold" />
        <Txt size={11} weight={700} tone="sky">{cta}</Txt>
      </View>
    ) : p && offRoster ? (
      <>
        <Txt up size={10.5} weight={800} tone="gold">Off roster</Txt>
        <Txt size={11.5} tone="dim" numberOfLines={1} style={{ flexShrink: 1 }}>Traded to {newTeam}</Txt>
      </>
    ) : p ? (
      <>
        <TeamTag code={p.team} />
        <RoleTag p={p} />
        {!plays && <Txt size={11.5} tone="dim">No match</Txt>}
        {locked && <Icon name="lock.fill" size={10} color={t.c.dim} />}
        {/* on the bench with his counting match started (e.g. just arrived by trade): he can start from next week */}
        {locked && slot === 'BN' && <Txt size={11.5} tone="dim">Next week</Txt>}
      </>
    ) : (
      <Txt size={12} tone="dim">{onPress ? 'Tap to fill' : 'Unfilled'}</Txt>
    )

  const body = (
    <View style={[s.row, mode === 'selected' && s.selected, mode === 'target' && s.target, mode === 'muted' && s.muted]}>
      {mode === 'selected' && <View style={s.edge} />}
      <View style={s.top}>
        <SlotBadge slot={slot} />
        {p ? <PlayerAvatar p={p} size={AVATAR} /> : (
          <View style={s.empty}><Icon name="plus" size={15} color={t.c.dim} weight="semibold" /></View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          {p && pid !== null && mode === 'idle' ? (
            // the name opens his card; the rest of the row picks him up to move
            <Pressable onPress={() => nav.player(pid)} hitSlop={{ top: 8, bottom: 4 }} style={s.name} accessibilityRole="link" accessibilityHint="Opens his player card">
              {({ pressed }) => <Txt size={15} weight={600} numberOfLines={1} style={{ opacity: pressed ? 0.5 : 1 }}>{p.name}</Txt>}
            </Pressable>
          ) : (
            <Txt size={15} weight={600} tone={p ? 'text' : 'muted'} numberOfLines={1}>{p ? p.name : 'Empty'}</Txt>
          )}
          <View style={s.meta}>{meta}</View>
        </View>
        {p && wp && (
          <View style={s.pts}>
            <Txt num weight={700} size={16}>{fmt(wp.banked)}</Txt>
            {/* the projection while his match is to come, his season total once it's done */}
            <Txt num size={10.5} tone="dim">
              {wp.remaining > 0 ? `${fmt(wp.total, 1)} proj` : `${fmt(seasonToDate(p, league.played).pts, 1)} season`}
            </Txt>
          </View>
        )}
      </View>
      {plays && <View style={s.picker}><MatchPicker pid={pid} compact /></View>}
    </View>
  )

  if (pid === null) {
    return <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={`Empty ${slot} slot`}>{body}</Pressable>
  }
  // tap picks him up (or opens his card once the season is over); press and hold: Player card / Drop
  return <PlayerLink pid={pid} onPress={onPress}>{body}</PlayerLink>
}

/** Over the roster limit after an uneven trade: how many to drop, what's frozen until then, and who can go. */
function OverLimit({ league, over }: { league: League; over: number }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const drop = useApp((st) => st.drop)
  const me = league.teams[ME]
  const choose = () => {
    // anyone whose week hasn't started, as long as you can still field a legal XI: bench first, least valuable first
    const ros = (p: number) => restOfSeason(d, d.players[p], league.played)
    const starts = (p: number) => Number(me.starters.includes(p))
    const options = me.roster
      .filter((p) => !isLocked(d, league, p) && canFillLineup(d, me.roster.filter((x) => x !== p)))
      .sort((a, b) => starts(a) - starts(b) || ros(a) - ros(b))
    if (!options.length) return report('Everyone you could drop has already played this week: it has to wait until the week ends.')
    chooseOption({
      title: `Drop ${over === 1 ? 'a player' : `${over} players`}`,
      message: `You have ${me.roster.length}. The limit is ${ROSTER_SIZE}.`,
      options: options.map((p) => ({ value: p, label: `${d.players[p].name} · ${d.players[p].team}${starts(p) ? ' · in your XI' : ''}` })),
      value: -1,
      tint: t.c.loss,
      onChoose: async (p) => {
        const name = d.players[p].name
        if (await confirm({ title: `Drop ${name}?`, message: 'He goes on waivers.', ok: 'Drop', destructive: true })) {
          report(drop(p), `Dropped ${name}`)
        }
      },
    })
  }
  return (
    <View style={s.over}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Icon name="person.badge.minus" size={18} color={t.c.gold} />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt size={15} weight={700}>{me.roster.length} players: drop {over}</Txt>
          <Txt size={12.5} tone="muted" style={{ lineHeight: 17 }}>
            Until you're back to {ROSTER_SIZE}, your lineup is frozen and you can't add players. Still over when the week
            ends? Your lowest-projected bench {over === 1 ? 'player is' : 'players are'} dropped.
          </Txt>
        </View>
      </View>
      <Button title={over === 1 ? 'Choose who to drop' : `Choose ${over} to drop`} kind="tinted" onPress={choose} />
    </View>
  )
}

/** Your pending waiver claims, each with Cancel. */
function Claims({ league, onCancel }: { league: League; onCancel: (id: number, name: string) => void }) {
  const d = getData()
  const s = useStyles(styles)
  const claims = league.claims.filter((c) => c.teamId === ME)
  if (!claims.length) return null
  return (
    <Section title="Waiver claims" inset={64} footer="Claims are processed when the gameweek ends.">
      {claims.map((c) => {
        const p = d.players[c.add]
        return (
          <PlayerLink key={c.id} pid={c.add}>
            <View style={s.claim}>
              <PlayerLine
                p={p}
                sub={`$${c.bid} bid${c.drop !== null ? ` · drop ${d.players[c.drop].name}` : ''}`}
                right={<Button title="Cancel" size="small" onPress={() => onCancel(c.id, p.name)} />}
              />
            </View>
          </PlayerLink>
        )
      })}
    </Section>
  )
}

const AVATAR = 32
/** where the avatar column starts in a row: after the slot badge (44) and its gap */
const PICKER_X = 44 + 8
/** separator inset: lines up with the avatar */
const ROW_INSET = 12 + 44 + 8

const styles = (t: Theme) => ({
  over: {
    padding: 14, gap: 12, borderRadius: t.r.lg, backgroundColor: alpha(t.c.gold, 0.1),
    borderWidth: 1, borderColor: alpha(t.c.gold, 0.35),
  },
  row: { paddingHorizontal: 12, paddingVertical: 7, gap: 6 },
  selected: { backgroundColor: alpha(t.c.accent, 0.14) },
  target: { backgroundColor: alpha(t.c.sky, 0.08) },
  muted: { opacity: 0.45 },
  edge: { position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: 3, backgroundColor: t.c.accent },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: AVATAR },
  empty: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: t.c.line2,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  meta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, height: 17 },
  cta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, height: 18, paddingHorizontal: 7, borderRadius: 999, backgroundColor: alpha(t.c.sky, 0.16) },
  name: { alignSelf: 'flex-start' as const, maxWidth: '100%' as const },
  pts: { alignItems: 'flex-end' as const, minWidth: 50 },
  // from the avatar column: room for two one-line capsules side by side
  picker: { marginLeft: PICKER_X },
  claim: { flexDirection: 'row' as const, alignItems: 'center' as const, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10 },
})
