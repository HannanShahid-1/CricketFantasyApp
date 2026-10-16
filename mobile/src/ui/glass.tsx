import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect'
import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { slotColor } from './badges'
import { Txt } from './text'

// Experiment: Liquid Glass on the Matchup tab (Settings → Experiments → Glass matchup). Everything glass lives in
// this file, so the switch brings back the plain look, and deleting the file plus its few uses removes it.

/** iOS 26+ draws the system's glass; older systems get a translucent panel with the same rim. */
const NATIVE = isGlassEffectAPIAvailable()

/** The colour of light on glass: cream on the dark look, white on the light one. */
const sheen = (t: Theme) => (t.dark ? t.c.tint : t.c.panel3)

/**
 * A colour coming in from each side and fading out by `reach` (% of the width): a matchup's two teams, or the two
 * players of a lineup row.
 */
export const sideWash = (left: string | null, right: string | null, strength: number, reach = 42) => {
  const at = (c: string | null, a: number) => (c ? alpha(c, a) : 'transparent')
  return `linear-gradient(90deg, ${at(left, strength)} 0%, ${at(left, 0)} ${reach}%, ${at(right, 0)} ${100 - reach}%, ${at(right, strength)} 100%)`
}

/**
 * A glass card: the system glass over an optional colour `wash` (a CSS gradient the glass picks up). Light sits on
 * the surface, above the children: a sheen from the top-left and a bright top edge fading round the corners. A
 * drop-in for a rounded panel.
 */
export function Glass({ radius, wash, children, style }: { radius: number; wash?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  const fill = StyleSheet.absoluteFill
  const light = sheen(t)
  const k = t.dark ? 1 : 2.5
  return (
    <View style={[{ borderRadius: radius }, style]}>
      <View pointerEvents="none" style={[fill, { borderRadius: radius, overflow: 'hidden' }]}>
        {wash && <View style={[fill, { experimental_backgroundImage: wash }]} />}
        {NATIVE ? (
          <GlassView glassEffectStyle="regular" tintColor={alpha(t.c.bg, t.dark ? 0.35 : 0.2)} colorScheme={t.dark ? 'dark' : 'light'} style={[fill, { borderRadius: radius }]} />
        ) : (
          <View style={[fill, { backgroundColor: alpha(t.c.panel, 0.75) }]} />
        )}
      </View>
      {children}
      <View
        pointerEvents="none"
        style={[fill, {
          borderRadius: radius,
          experimental_backgroundImage: `linear-gradient(155deg, ${alpha(light, 0.13 * k)} 0%, ${alpha(light, 0.03 * k)} 32%, ${alpha(light, 0)} 55%)`,
          // thick-glass edges: a bright top lip, a fainter bottom one, a hairline ring and a soft glow just inside
          boxShadow: [
            `inset 0 1px 0.5px ${alpha(light, Math.min(1, 0.5 * k))}`,
            `inset 0 -1px 0.5px ${alpha(light, 0.14 * k)}`,
            `inset 0 0 0 1px ${alpha(light, 0.07 * k)}`,
            `inset 0 0 14px ${alpha(light, 0.06 * k)}`,
          ].join(', '),
        }]}
      />
    </View>
  )
}

/** `Section` on glass: the same rows and separators, with the title followed by a hairline. */
export function GlassSection({ title, inset = 16, children, style }: { title?: string; inset?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  const s = useStyles(styles)
  const rows = Children.toArray(children).filter(isValidElement)
  return (
    <View style={style}>
      {title && (
        <View style={s.header}>
          <Txt up size={12} weight={600} tone="muted" style={{ letterSpacing: 1.6 }}>{title}</Txt>
          <View style={s.headerLine} />
        </View>
      )}
      <Glass radius={t.r.lg + 2}>
        {/* rows may tint themselves (sideWash): keep that inside the rounded card */}
        <View style={{ borderRadius: t.r.lg + 2, overflow: 'hidden' }}>
          {rows.map((row, i) => (
            <Fragment key={row.key ?? i}>
              {i > 0 && <View style={[s.sep, { marginLeft: inset }]} />}
              {row}
            </Fragment>
          ))}
        </View>
      </Glass>
    </View>
  )
}

/** `SlotBadge` as a lit glass capsule in the slot's colour. */
export function GlassSlotBadge({ slot }: { slot: string }) {
  const t = useTheme()
  const color = slotColor(t, slot)
  return (
    <View
      style={{
        minWidth: 46, height: 26, paddingHorizontal: 6, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: alpha(color, 0.5), backgroundColor: alpha(color, 0.14),
        experimental_backgroundImage: `linear-gradient(180deg, ${alpha(sheen(t), t.dark ? 0.16 : 0.5)} 0%, transparent 60%)`,
        boxShadow: `0 0 10px ${alpha(color, 0.28)}`,
      }}
    >
      <Txt display size={11} weight={700} numberOfLines={1} style={{ color, letterSpacing: 0.4 }}>{slot}</Txt>
    </View>
  )
}

const styles = (t: Theme) => ({
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 16, paddingBottom: 9 },
  headerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.c.line2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: t.c.line2 },
})
