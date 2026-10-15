import { useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import { restOfSeason } from '@shared/engine/data'
import { addMode, isLocked, overLimit, overLimitMessage, ROSTER_SIZE, type League } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { suggestedBid } from '@shared/ui/transactions'
import { PICK_INSET, PickRow } from '@/components/sheets/PickRow'
import { SHEET_HEADER_HEIGHT, SheetFooter, SheetHeader, useSheetLeague } from '@/components/sheets/SheetChrome'
import { ownersOf } from '@/data/derived'
import { intParam } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { Button, Chip, EmptyState, haptic, Icon, Meter, PlayerLine, report, Row, RowIcon, Section, Txt, type SFSymbol } from '@/ui'

// Add a free agent, or place a blind FAAB claim on a player on waivers, optionally dropping someone to make room.

export function AddScreen() {
  const pid = intParam(useLocalSearchParams<{ id: string }>().id)
  const [league, closeAfter] = useSheetLeague()
  const t = useTheme()
  const p = getData().players[pid]
  if (!league || !p) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: SHEET_HEADER_HEIGHT }}>
        <EmptyState icon="person.fill.questionmark" title="Player not found" />
        <SheetHeader title="Add Player" />
      </View>
    )
  }
  return <AddForm league={league} pid={pid} closeAfter={closeAfter} />
}

function AddForm({ league, pid, closeAfter }: { league: League; pid: number; closeAfter: () => void }) {
  const d = getData()
  const t = useTheme()
  const { faAdd, claim } = useApp(useShallow((s) => ({ faAdd: s.faAdd, claim: s.claim })))
  const p = d.players[pid]
  const me = league.teams[ME]
  const mode = addMode(d, league, pid, ownersOf(league))
  const full = me.roster.length >= ROSTER_SIZE
  // over the limit after an uneven trade: no adds or claims until you drop down
  const over = overLimit(league, ME)
  const existing = league.claims.find((c) => c.teamId === ME && c.add === pid)

  // his value, and your roster as drop candidates: lowest rest-of-season value first
  const ros = useMemo(() => restOfSeason(d, p, league.played), [d, p, league.played])
  const candidates = useMemo(
    () => me.roster
      .map((x) => ({ pid: x, ros: restOfSeason(d, d.players[x], league.played), locked: isLocked(d, league, x) }))
      .sort((a, b) => a.ros - b.ros),
    [d, league, me.roster],
  )
  const suggested = suggestedBid(me.faab, ros)
  // start from your existing claim, if any (its drop only if he's still on your roster)
  const claimedDrop = existing?.drop ?? null
  const [drop, setDrop] = useState(claimedDrop !== null && me.roster.includes(claimedDrop) ? claimedDrop : null)
  const [bid, setBid] = useState(Math.min(existing?.bid ?? suggested, me.faab))

  const submit = () => {
    const err = mode === 'free' ? faAdd(pid, drop) : claim(pid, drop, bid)
    if (report(err, mode === 'free' ? `Added ${p.name}` : `Claim placed: ${p.name} for $${bid}`)) closeAfter()
  }

  const owner = ownersOf(league).get(pid)
  const title = mode === 'free' ? 'Add Player' : mode === 'waiver' ? 'Waiver Claim' : 'Unavailable'
  const cta = mode === 'free' ? `Add ${p.name}` : existing ? `Update Claim to $${bid}` : `Place $${bid} Claim`
  const needsDrop = full && drop === null

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: SHEET_HEADER_HEIGHT + 4, paddingBottom: 24, gap: 24 }}>
        <Section>
          <Row>
            <PlayerLine
              p={p}
              size={48}
              sub={`ROS ${fmt(ros, 0)}`}
              right={mode !== 'none' && <Chip label={mode === 'free' ? 'FREE AGENT' : 'WAIVERS'} tone={mode === 'free' ? 'accent' : 'gold'} />}
            />
          </Row>
        </Section>

        {mode === 'none' ? (
          <Section>
            <Row
              left={<RowIcon name="exclamationmark.triangle.fill" color={t.c.loss} />}
              title="Not available"
              subtitle={owner !== undefined ? `He's on ${owner === ME ? 'your team' : league.teams[owner].name} now.` : 'Adds are closed: the season is over.'}
            />
          </Section>
        ) : (
          <>
            {mode === 'waiver' && (
              <Section
                title="Your bid"
                footer={
                  `${p.name} is on waivers: recently dropped, or his match this week has started. Bids are blind and ` +
                  'processed when the gameweek ends. Highest bid wins; ties go to waiver priority.' +
                  (existing ? ` Your current bid is $${existing.bid}: this replaces it.` : '')
                }
              >
                <BidStepper value={bid} max={me.faab} suggested={suggested} onChange={setBid} />
              </Section>
            )}
            <Section
              title={full ? 'Choose a player to drop' : 'Drop a player (optional)'}
              inset={PICK_INSET.radio}
              footer="Lowest rest-of-season value first. Players whose match has started this week can't be dropped."
            >
              {!full && (
                <Row
                  onPress={() => {
                    haptic.select()
                    setDrop(null)
                  }}
                  left={<View style={{ width: 36, alignItems: 'center' }}><RowIcon name="person.badge.plus" color={t.c.accent} /></View>}
                  title="Keep everyone"
                  subtitle={`Uses an open spot: ${me.roster.length + 1} of ${ROSTER_SIZE} after this`}
                  right={<View style={{ width: 20, alignItems: 'flex-end' }}>{drop === null && <Icon name="checkmark" size={16} weight="bold" color={t.c.accent} />}</View>}
                />
              )}
              {candidates.map((c) => (
                <PickRow key={c.pid} pid={c.pid} ros={c.ros} locked={c.locked} on={drop === c.pid} mark="radio" onPick={setDrop} />
              ))}
            </Section>
          </>
        )}
      </ScrollView>
      <SheetHeader title={title} />
      <SheetFooter>
        {mode !== 'none' && (over > 0 || needsDrop) && (
          <Txt size={13} tone="muted" style={{ textAlign: 'center' }}>
            {over > 0 ? overLimitMessage(over) : 'Your roster is full: choose a player to drop.'}
          </Txt>
        )}
        <Button title={cta} kind="filled" size="large" disabled={mode === 'none' || over > 0 || needsDrop} onPress={submit} />
      </SheetFooter>
    </View>
  )
}

// ---------------------------------------------------------------- FAAB bid

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v))

/** The bid in big type with −/+ (tap for $1, hold to keep going, faster in $5 steps) and quick picks. */
function BidStepper({ value, max, suggested, onChange }: { value: number; max: number; suggested: number; onChange: (v: number) => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  /** move to `v` (clamped); false when it can't move any further */
  const set = (v: number) => {
    const next = clamp(v, max)
    if (next === value) return false
    haptic.select()
    onChange(next)
    return true
  }
  // fast steps snap to multiples of $5
  const step = (dir: 1 | -1) => (fast: boolean) =>
    set(!fast ? value + dir : dir > 0 ? Math.floor(value / 5) * 5 + 5 : Math.ceil(value / 5) * 5 - 5)
  const quick = [
    { label: 'Suggested', v: suggested },
    { label: '¼ budget', v: Math.round(max / 4) },
    { label: '½ budget', v: Math.round(max / 2) },
    { label: 'Max', v: max },
  ]
  return (
    <View style={s.bid}>
      <View style={s.amountRow}>
        <StepButton icon="minus" label="Lower bid" disabled={value <= 0} onStep={step(-1)} />
        <View
          style={s.amount}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Bid"
          accessibilityValue={{ text: `$${value} of $${max}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
        >
          <Txt num weight={700} size={54} style={{ lineHeight: 60 }}>${value}</Txt>
          <Txt size={13} tone="muted">of ${max} left</Txt>
        </View>
        <StepButton icon="plus" label="Raise bid" disabled={value >= max} onStep={step(1)} />
      </View>
      <Meter value={max ? value / max : 0} color={t.c.accent} height={4} />
      <View style={s.quickRow}>
        {quick.map((q) => {
          const on = value === q.v
          return (
            <Pressable
              key={q.label}
              onPress={() => set(q.v)}
              accessibilityRole="button"
              accessibilityLabel={`${q.label}: $${q.v}`}
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [s.quick, on && s.quickOn, pressed && { opacity: 0.6 }]}
            >
              <Txt up size={9.5} weight={700} numberOfLines={1} style={{ color: on ? t.c.accent : t.c.muted }}>{q.label}</Txt>
              <Txt num weight={700} size={16} style={{ color: on ? t.c.accent : t.c.text }}>${q.v}</Txt>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function StepButton({ icon, label, disabled, onStep }: { icon: SFSymbol; label: string; disabled: boolean; onStep: (fast: boolean) => boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const { start, stop } = useRepeat(onStep)
  return (
    <Pressable
      onPress={() => onStep(false)}
      onLongPress={start}
      delayLongPress={350}
      onPressOut={stop}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.step, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={20} weight="semibold" color={t.c.accent} />
    </Pressable>
  )
}

/** Press-and-hold repeat: calls `fn` until it returns false or the press ends, speeding up after a dozen steps. */
function useRepeat(fn: (fast: boolean) => boolean) {
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stop = useCallback(() => clearTimeout(timer.current), [])
  useEffect(() => stop, [stop])
  const start = useCallback(() => {
    let n = 0
    const tick = () => {
      const fast = n++ >= 12
      if (latest.current(fast)) timer.current = setTimeout(tick, fast ? 90 : 110)
    }
    tick()
  }, [])
  return { start, stop }
}

const styles = (t: Theme) => ({
  bid: { padding: 16, gap: 16 },
  amountRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  amount: { flex: 1, alignItems: 'center' as const },
  step: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: alpha(t.c.accent, 0.14),
  },
  quickRow: { flexDirection: 'row' as const, gap: 8 },
  quick: {
    flex: 1, alignItems: 'center' as const, gap: 3, paddingVertical: 9, borderRadius: t.r.md,
    backgroundColor: alpha(t.c.tint, 0.06), borderWidth: 1, borderColor: 'transparent',
  },
  quickOn: { backgroundColor: alpha(t.c.accent, 0.14), borderColor: alpha(t.c.accent, 0.5) },
})
