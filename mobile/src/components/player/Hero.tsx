import { Image } from 'expo-image'
import { Pressable, View } from 'react-native'
import { ROLE_LABEL, type Player } from '@shared/engine/data'
import { addMode, isLocked, managerName, type League } from '@shared/engine/league'
import { playerAge } from '@shared/engine/playerAge'
import { getData, ME, useApp } from '@shared/store'
import { initials } from '@shared/ui/format'
import { ownersOf, recordOf } from '@/data/derived'
import { LOGOS, PHOTOS } from '@/generated/photos'
import { nav } from '@/nav'
import { alpha, mix, useStyles, useTheme, type Theme } from '@/theme/theme'
import { confirm, haptic, Icon, report, roleColor, type SFSymbol, SlotBadge, Txt } from '@/ui'

// The player card's header and what you can do about him (owner, add, drop, trade).

// The header is the one team-branded block in the app: the IPL team's colours (darkened so white type always
// reads, even on CSK yellow) behind a small photo and a faded team logo (its code when there's no logo), with white
// type in every theme.
const HERO = {
  ink: '#fff',
  soft: 'rgba(255, 255, 255, 0.78)',
  faint: 'rgba(255, 255, 255, 0.6)',
  plate: 'rgba(0, 0, 0, 0.15)',
  button: 'rgba(255, 255, 255, 0.2)',
  base: '#0b1017',
  fallback: { color: '#33404d' },
}
const PHOTO_W = 136

const BATS: Record<string, string> = { 'Right-handed': 'RHB', 'Left-handed': 'LHB' }
const BOWLS: Record<string, string> = {
  'Off break': 'OB', 'Off Spin': 'OB', 'Leg break': 'LB', 'Leg spin': 'LB', 'Leg break googly': 'LBG',
  'Slow left-arm orthodox': 'SLA', 'Left-arm wrist spin': 'SLC',
  'Right-arm fast': 'RF', 'Right-arm fast medium': 'RFM', 'Right-arm medium fast': 'RMF', 'Right-arm medium': 'RM',
  'Left-arm fast': 'LF', 'Left-arm fast medium': 'LFM', 'Left-arm medium fast': 'LMF', 'Left-arm medium': 'LM',
}
const COUNTRY: Record<string, string> = {
  India: 'IND', 'South Africa': 'SA', Australia: 'AUS', England: 'ENG', 'New Zealand': 'NZ', 'Sri Lanka': 'SL',
  'West Indies': 'WI', Afghanistan: 'AFG', Bangladesh: 'BAN', Zimbabwe: 'ZIM',
}
const initialsOf = (s: string) => s.split(/[\s-]+/).map((w) => w[0]).join('').toUpperCase()

export function Hero({ p, league, closeAfter }: { p: Player; league: League | null; closeAfter: () => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const code = p.team || p.profileTeam || ''
  const team = getData().teams[code]
  const { color } = team ?? HERO.fallback
  const photo = PHOTOS[p.id]
  const bio = p.bio
  const age = bio ? playerAge(bio.birthDate) : null
  // short values in the header; VoiceOver reads the full ones
  const facts = [
    { label: 'Age', value: age !== null ? String(age) : '–', full: age !== null ? `${age} years` : 'not listed' },
    { label: 'Bats', value: bio ? (BATS[bio.battingStyle] ?? initialsOf(bio.battingStyle)) : '–', full: bio?.battingStyle ?? 'not listed' },
    {
      label: 'Bowls',
      value: bio?.bowlingStyle ? (BOWLS[bio.bowlingStyle] ?? initialsOf(bio.bowlingStyle)) : '–',
      full: bio?.bowlingStyle ?? "doesn't bowl",
    },
    { label: 'From', value: bio ? (COUNTRY[bio.nationality] ?? bio.nationality.slice(0, 3).toUpperCase()) : '–', full: bio?.nationality ?? 'not listed' },
  ]
  // the surname keeps its lowercase particles: Quinton / de Kock
  const words = p.fullName.trim().split(/\s+/)
  let split = words.length - 1
  while (split > 1 && /^[a-z]/.test(words[split - 1])) split--
  const first = words.slice(0, split).join(' ')
  const last = words.slice(split).join(' ')
  const own = useOwnership(p, league, closeAfter)
  return (
    <View
      style={[s.hero, {
        backgroundColor: mix(color, HERO.base, 0.45),
        experimental_backgroundImage:
          `radial-gradient(circle at 12% 40%, ${alpha(color, 0.55)} 0%, transparent 60%), ` +
          `linear-gradient(150deg, ${mix(color, HERO.base, 0.62)} 0%, ${mix(color, HERO.base, 0.26)} 100%)`,
      }]}
    >
      <HeroBackdrop color={color} />
      <View style={s.side}>
        <View style={s.photoBox}>
          {LOGOS[code] ? (
            <Image source={LOGOS[code]} style={s.logo} contentFit="contain" accessible={false} />
          ) : !!code && (
            <Txt display weight={700} size={70} numberOfLines={1} style={s.watermark}>{code}</Txt>
          )}
          {photo ? (
            <Image source={photo} style={s.photo} contentFit="contain" contentPosition="bottom" transition={160} accessibilityLabel={p.fullName} />
          ) : (
            <View style={s.noPhoto}><Txt display weight={700} size={40} style={{ color: HERO.soft }}>{initials(p.name)}</Txt></View>
          )}
        </View>
        <View style={s.plate}>
          <Txt display up weight={700} size={12} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: HERO.ink, textAlign: 'center' }}>
            {team?.name ?? 'No IPL team'}
          </Txt>
          <Txt size={12} weight={800} style={{ color: mix(roleColor(t, p.role), HERO.ink, 0.7), letterSpacing: 0.4 }}>
            {ROLE_LABEL[p.role]}
            {!!code && <Txt size={12} weight={600} style={{ color: HERO.faint }}>{`  ·  ${code}`}</Txt>}
          </Txt>
          <View style={s.slots} accessible accessibilityLabel={`Eligible for ${p.elig.join(', ')}`}>
            {p.elig.map((e) => <SlotBadge key={e} slot={e} small />)}
          </View>
        </View>
      </View>
      <View style={s.main}>
        {own && (
          <View style={s.owner}>
            <Icon name="arrow.right" size={11} weight="bold" color={HERO.soft} />
            <Txt size={13} numberOfLines={1} style={{ color: HERO.soft, flexShrink: 1 }}>
              <Txt size={13} weight={600} style={{ color: HERO.ink }}>{own.owner}</Txt>
              {own.detail ? ` · ${own.detail}` : ''}
            </Txt>
          </View>
        )}
        <View accessible accessibilityRole="header" accessibilityLabel={p.fullName}>
          {!!first && <Txt display up weight={700} size={20} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: HERO.ink }}>{first}</Txt>}
          <Txt display up weight={800} size={31} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: HERO.ink, lineHeight: 36 }}>{last}</Txt>
        </View>
        <View style={s.facts}>
          {facts.map((f) => (
            <View key={f.label} style={s.fact} accessible accessibilityLabel={`${f.label}: ${f.full}`}>
              <Txt up size={11} weight={600} numberOfLines={1} style={{ color: HERO.faint }}>{f.label}</Txt>
              <Txt num weight={700} size={19} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: HERO.ink }}>
                {f.value}
              </Txt>
            </View>
          ))}
        </View>
        {own?.action && (
          <Pressable
            disabled={own.action.disabled}
            onPress={() => {
              if (own.action?.disabled) return
              haptic.tap()
              own.action?.onPress()
            }}
            accessibilityRole="button"
            accessibilityLabel={`${own.action.title} ${p.name}`}
            accessibilityState={{ disabled: !!own.action.disabled }}
            accessibilityHint={own.action.disabled ? 'Locked until this gameweek ends.' : undefined}
            style={({ pressed }) => [s.pill, own.action?.disabled && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}
          >
            <Icon name={own.action.icon} size={13} weight="semibold" color={HERO.ink} />
            <Txt up size={14} weight={700} style={{ color: HERO.ink }}>{own.action.title}</Txt>
          </Pressable>
        )}
      </View>
      <Pressable onPress={nav.close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [s.close, pressed && { opacity: 0.6 }]}>
        <Icon name="xmark" size={12} weight="bold" color={HERO.ink} />
      </Pressable>
    </View>
  )
}

/**
 * The abstract layer behind the header, all in shades of the team's own colour: a light glow in the top corner,
 * a deep shade pooling at the bottom, three diagonal bands sweeping across and a faint ring.
 */
function HeroBackdrop({ color }: { color: string }) {
  const s = useStyles(styles)
  const light = mix(color, HERO.ink, 0.55)
  const deep = mix(color, HERO.base, 0.15)
  return (
    <View style={s.backdrop} pointerEvents="none">
      <View
        style={[s.backdrop, {
          experimental_backgroundImage:
            `radial-gradient(circle at 96% 0%, ${alpha(light, 0.45)} 0%, transparent 45%), ` +
            `radial-gradient(circle at 40% 120%, ${alpha(deep, 0.8)} 0%, transparent 55%)`,
        }]}
      />
      <View style={[s.band, { left: 170, width: 110, experimental_backgroundImage: `linear-gradient(180deg, ${alpha(light, 0.14)} 0%, transparent 85%)` }]} />
      <View style={[s.band, { left: 292, width: 36, experimental_backgroundImage: `linear-gradient(180deg, ${alpha(light, 0.22)} 0%, transparent 90%)` }]} />
      <View style={[s.band, { left: 340, width: 7, backgroundColor: alpha(light, 0.12) }]} />
      <View style={[s.ring, { borderColor: alpha(light, 0.08) }]} />
    </View>
  )
}

// ---------------------------------------------------------------- ownership and actions

interface Ownership { owner: string; detail: string | null; action: { title: string; icon: SFSymbol; disabled?: boolean; onPress: () => void } | null }

/** Who has him, what that means this week, and the one thing you can do about it (null outside a league). */
function useOwnership(p: Player, league: League | null, closeAfter: () => void): Ownership | null {
  const drop = useApp((s) => s.drop)
  if (!league) return null
  const d = getData()
  const owners = ownersOf(league)
  const owner = owners.get(p.idx)
  const team = owner !== undefined ? league.teams[owner] : null
  const season = league.phase === 'season'

  if (team) {
    const mine = team.isUser
    if (league.phase === 'draft') return { owner: mine ? 'Your team' : team.name, detail: mine ? 'You drafted him' : `Drafted by ${managerName(team)}`, action: null }
    if (!mine) {
      return {
        owner: team.name,
        detail: `${managerName(team)} · ${recordOf(league, team.id)}`,
        // the trade sheet replaces the card, so sending the offer can go straight to the chat
        action: season ? { title: 'Trade', icon: 'arrow.left.arrow.right', onPress: () => { nav.close(); nav.trade(team.id) } } : null,
      }
    }
    const locked = season && isLocked(d, league, p.idx)
    const onDrop = async () => {
      if (!(await confirm({ title: `Drop ${p.name}?`, message: 'He goes on waivers.', ok: 'Drop', destructive: true }))) return
      if (report(drop(p.idx), `Dropped ${p.name}`)) closeAfter()
    }
    return {
      owner: 'Your team',
      detail: !season ? null : locked ? 'Locked: his match has started' : team.starters.includes(p.idx) ? 'Starting XI' : 'Bench',
      action: season ? { title: 'Drop', icon: locked ? 'lock.fill' : 'trash', disabled: locked, onPress: onDrop } : null,
    }
  }
  if (league.phase === 'draft') return { owner: 'Available', detail: 'Not drafted yet', action: null }
  const mode = addMode(d, league, p.idx, owners)
  const claim = league.claims.find((c) => c.teamId === ME && c.add === p.idx)
  const waiver = mode === 'waiver'
  return {
    owner: waiver ? 'On waivers' : 'Free agent',
    detail: claim ? `Your $${claim.bid} claim is in` : waiver ? 'Claims run when the week ends' : null,
    action: mode !== 'none' ? { title: waiver ? 'Claim' : 'Add', icon: 'plus', onPress: () => nav.add(p.idx) } : null,
  }
}

const styles = (t: Theme) => ({
  hero: { flexDirection: 'row' as const, overflow: 'hidden' as const },
  side: { width: PHOTO_W },
  backdrop: { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 },
  band: { position: 'absolute' as const, top: -140, height: 560, transform: [{ rotate: '26deg' }] },
  ring: {
    position: 'absolute' as const, right: -110, top: -150, width: 300, height: 300, borderRadius: 150,
    borderWidth: 22,
  },
  photoBox: { flex: 1, minHeight: 168, justifyContent: 'flex-end' as const, overflow: 'hidden' as const },
  logo: { position: 'absolute' as const, left: 10, top: 10, width: PHOTO_W - 20, height: PHOTO_W - 20, opacity: 0.32 },
  watermark: { position: 'absolute' as const, left: 8, top: 10, color: 'rgba(255, 255, 255, 0.1)', letterSpacing: -2 },
  photo: { width: PHOTO_W, height: 160 },
  noPhoto: {
    alignSelf: 'center' as const, marginBottom: 24, width: 88, height: 88, borderRadius: 44,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  plate: {
    alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingTop: 9, paddingBottom: 11,
    backgroundColor: HERO.plate, borderTopRightRadius: t.r.lg,
  },
  main: { flex: 1, minWidth: 0, gap: 10, paddingLeft: 14, paddingRight: 16, paddingTop: 28, paddingBottom: 11 },
  owner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingRight: 34 },
  facts: { flexDirection: 'row' as const, gap: 22 }, // left-aligned under his name
  fact: { gap: 2 },
  slots: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 4, marginTop: 3 },
  pill: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 7,
    height: 38, borderRadius: 999, backgroundColor: HERO.button, marginTop: 'auto' as const, // bottom of the card, level with the slot badges
  },
  close: {
    position: 'absolute' as const, top: 12, right: 12, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
})
