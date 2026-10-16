import { Image } from 'expo-image'
import { memo, type ReactNode } from 'react'
import { View } from 'react-native'
import { ROLE_LABEL, type Data, type Player } from '@shared/engine/data'
import type { FTeam } from '@shared/engine/league'
import { getData } from '@shared/store'
import { initials } from '@shared/ui/format'
import { THUMBS } from '@/generated/photos'
import { alpha, useTheme, type Theme } from '@/theme/theme'
import { Txt } from './text'

// Cricket-specific building blocks shared by every screen: slots, roles, teams, players.

export const slotColor = (t: Theme, slot: string) =>
  slot === 'WK' ? t.c.wk : slot === 'BAT' ? t.c.bat : slot === 'BOWL' ? t.c.bowl : slot === 'FLEX' ? t.c.flex : t.c.dim

/** A playing role's colour: AR-BAT and AR-BOWL share the all-rounder colour. */
export const roleColor = (t: Theme, role: Player['role']) =>
  role === 'WK' ? t.c.wk : role === 'BAT' ? t.c.bat : role === 'BOWL' ? t.c.bowl : t.c.ar

/** Lineup slot: WK, BAT, BOWL, FLEX or BN. */
export function SlotBadge({ slot, small }: { slot: string; small?: boolean }) {
  const t = useTheme()
  const color = slotColor(t, slot)
  return (
    <View style={{ minWidth: small ? 0 : 44, height: small ? 18 : 22, paddingHorizontal: small ? 5 : 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(color, t.badgeOutline), backgroundColor: alpha(color, 0.12) }}>
      <Txt display size={small ? 10 : 11} weight={700} style={{ color, letterSpacing: 0.4 }}>{slot}</Txt>
    </View>
  )
}

/** Playing role, e.g. BAT or AR-BOWL, in its role colour. */
export function RoleTag({ p }: { p: Player }) {
  const t = useTheme()
  return <Txt size={10.5} weight={800} style={{ color: roleColor(t, p.role), letterSpacing: 0.4 }}>{ROLE_LABEL[p.role]}</Txt>
}

/** IPL franchise code with its colour swatch, e.g. ▮ CSK. */
export function TeamTag({ code }: { code: string }) {
  const t = useTheme()
  const team = getData().teams[code]
  if (!team) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 17, paddingHorizontal: 5, borderRadius: 5, backgroundColor: alpha(t.c.tint, 0.07) }}>
      <View style={{ width: 6, height: 7, borderRadius: 1.5, backgroundColor: t.team(team.color) }} />
      <Txt size={10} weight={800} tone="muted">{code}</Txt>
    </View>
  )
}

/** A fantasy team's profile picture: its emoji on the team colour (muted by the theme). */
export function TeamBadge({ team, size = 40 }: { team: FTeam; size?: number }) {
  const t = useTheme()
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: t.team(team.color), alignItems: 'center', justifyContent: 'center' }}>
      <Txt size={size * 0.52} accessibilityLabel={team.name}>{team.avatar}</Txt>
    </View>
  )
}

/** Player photo in a circle with his IPL team's colours (initials when there's no photo). */
export const PlayerAvatar = memo(function PlayerAvatar({ p, size = 36 }: { p: Player; size?: number }) {
  const t = useTheme()
  const team = getData().teams[p.team || p.profileTeam || '']
  const src = THUMBS[p.id]
  const ring = Math.max(1.5, size * 0.045)
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, padding: ring, backgroundColor: t.team(team?.accent ?? '#556') }}>
      <View style={{ flex: 1, borderRadius: size, overflow: 'hidden', backgroundColor: t.team(team?.color ?? '#334'), alignItems: 'center', justifyContent: 'center' }}>
        {src ? (
          <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="cover" contentPosition="top" recyclingKey={p.id} transition={120} />
        ) : (
          <Txt display weight={700} size={size * 0.34} tone="hi">{initials(p.name)}</Txt>
        )}
      </View>
    </View>
  )
})

/** One dot per IPL match this week: filled when played (a ball with its seam in Stitch), ringed when it is the one
 *  that counts, faded otherwise. */
export function MatchBalls({ d, p, week, played, counted }: { d: Data; p: Player; week: number; played: number; counted?: number | null }) {
  const t = useTheme()
  const mis = d.teamGw[p.team]?.[week] ?? []
  if (!mis.length) return <Txt size={10.5} tone="dim">No match</Txt>
  const marks = counted !== undefined && mis.length > 1
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {mis.map((mi) => {
        const done = mi < played
        const dnp = done && !p.games.has(mi)
        const counts = marks && mi === counted
        return (
          <View
            key={mi}
            style={{
              width: 10, height: 10, borderRadius: 5, overflow: 'hidden',
              backgroundColor: dnp ? 'transparent' : done ? t.c.hi : alpha(t.c.tint, 0.14),
              borderWidth: counts ? 1.5 : 1, borderStyle: dnp ? 'dashed' : 'solid',
              borderColor: counts ? t.c.accent : dnp ? t.c.loss : done ? 'transparent' : alpha(t.c.tint, 0.22),
              opacity: marks && !counts ? 0.4 : 1,
            }}
          >
            {/* the seam: the edge of a larger circle, clipped by the ball */}
            {t.stitched && done && !dnp && <View style={{ position: 'absolute', left: -9, top: -3, width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: t.c.accent }} />}
          </View>
        )
      })}
    </View>
  )
}

/** Avatar + name + team/role line: the standard way a player appears in a row. */
export function PlayerLine({ p, size = 36, sub, right }: { p: Player; size?: number; sub?: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
      <PlayerAvatar p={p} size={size} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Txt size={15.5} weight={600} numberOfLines={1}>{p.name}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TeamTag code={p.team} />
          <RoleTag p={p} />
          {typeof sub === 'string' ? <Txt size={12} tone="dim" numberOfLines={1} style={{ flexShrink: 1 }}>{sub}</Txt> : sub}
        </View>
      </View>
      {right}
    </View>
  )
}
