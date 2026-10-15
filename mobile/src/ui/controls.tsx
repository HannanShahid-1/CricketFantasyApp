import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { haptic } from './feedback'
import { Icon, type SFSymbol } from './Icon'
import { Txt } from './text'

type ButtonKind = 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive' | 'live'
type ButtonSize = 'large' | 'medium' | 'small'

const SIZE: Record<ButtonSize, { h: number; px: number; font: number; icon: number }> = {
  large: { h: 50, px: 20, font: 17, icon: 18 },
  medium: { h: 38, px: 16, font: 15, icon: 15 },
  small: { h: 30, px: 12, font: 13, icon: 13 },
}

function buttonColors(t: Theme, kind: ButtonKind) {
  switch (kind) {
    case 'filled': return { bg: t.c.accent, fg: t.c.accentInk }
    case 'tinted': return { bg: alpha(t.c.accent, 0.16), fg: t.c.accent }
    case 'gray': return { bg: alpha(t.c.tint, 0.08), fg: t.c.text }
    case 'plain': return { bg: 'transparent', fg: t.c.accent }
    case 'destructive': return { bg: alpha(t.c.loss, 0.14), fg: t.c.loss }
    case 'live': return { bg: t.c.live, fg: t.c.liveInk }
  }
}

/**
 * iOS-style button: `filled` for the main action, `tinted`/`gray` for secondary ones, `plain` for text links.
 * `large` buttons stretch to full width (sheet and screen CTAs); medium and small are capsules.
 */
export function Button({ title, onPress, kind = 'gray', size = 'medium', icon, disabled, style, accessibilityLabel }: {
  title?: string; onPress: () => void; kind?: ButtonKind; size?: ButtonSize; icon?: SFSymbol; disabled?: boolean
  style?: StyleProp<ViewStyle>; accessibilityLabel?: string
}) {
  const t = useTheme()
  const { bg, fg } = buttonColors(t, kind)
  const z = SIZE[size]
  return (
    <Pressable
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          height: z.h, paddingHorizontal: title ? z.px : 0, width: title ? undefined : z.h,
          borderRadius: size === 'large' ? t.r.lg : 999, backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        size === 'large' && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={z.icon} color={fg} weight="semibold" />}
      {title && <Txt size={z.font} weight={600} style={{ color: fg }}>{title}</Txt>}
    </Pressable>
  )
}

export type ChipTone = 'neutral' | 'accent' | 'live' | 'gold' | 'sky' | 'ok' | 'bad'

/** Small status capsule, e.g. LIVE, FINAL, Waivers. */
export function Chip({ label, tone = 'neutral', icon }: { label: string; tone?: ChipTone; icon?: SFSymbol }) {
  const t = useTheme()
  const color = { neutral: t.c.muted, accent: t.c.accent, live: t.c.live2, gold: t.c.gold, sky: t.c.sky, ok: t.c.win, bad: t.c.loss }[tone]
  const bg = tone === 'neutral' ? alpha(t.c.tint, 0.08) : alpha(tone === 'live' ? t.c.live : color, 0.15)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: 999, backgroundColor: bg, alignSelf: 'flex-start' }}>
      {tone === 'live' && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.c.live }} />}
      {icon && <Icon name={icon} size={11} color={color} weight="semibold" />}
      <Txt size={11} weight={700} style={{ color, letterSpacing: 0.3 }}>{label}</Txt>
    </View>
  )
}

/** shared by Segmented and Pill so stacked filter rows line up */
const CONTROL_H = 32
const SEG_PAD = 3

/**
 * iOS-style segmented control: a capsule track with a thumb that slides to the selected segment. Drawn in JS (not
 * UISegmentedControl) so labels use the theme's fonts and colours; iOS 26 ignores custom selected-label colours.
 */
export function Segmented<K extends string>({ options, value, onChange, style }: {
  options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const s = useStyles(segStyles)
  const index = Math.max(0, options.findIndex((o) => o.key === value))
  const [width, setWidth] = useState(0)
  const seg = width ? (width - 2 * SEG_PAD) / options.length : 0
  const x = useRef(new Animated.Value(0)).current
  const placed = useRef(false)
  useEffect(() => {
    if (!seg) return
    // jump into place on first layout, slide afterwards
    if (!placed.current) {
      placed.current = true
      x.setValue(index * seg)
    } else {
      Animated.spring(x, { toValue: index * seg, useNativeDriver: true, speed: 22, bounciness: 3 }).start()
    }
  }, [index, seg, x])
  return (
    <View style={[s.track, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {seg > 0 && <Animated.View style={[s.thumb, { width: seg, transform: [{ translateX: x }] }]} />}
      {options.map((o, i) => {
        const on = i === index
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              if (on) return
              haptic.select()
              onChange(o.key)
            }}
            style={s.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Txt display weight={600} size={13.5} numberOfLines={1} style={{ color: on ? t.c.text : t.c.muted }}>{o.label}</Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

const segStyles = (t: Theme) => ({
  track: {
    flexDirection: 'row' as const, height: CONTROL_H, padding: SEG_PAD, borderRadius: CONTROL_H / 2,
    backgroundColor: alpha(t.c.tint, 0.08),
  },
  thumb: {
    position: 'absolute' as const, top: SEG_PAD, left: SEG_PAD, bottom: SEG_PAD, borderRadius: (CONTROL_H - 2 * SEG_PAD) / 2,
    // a raised surface: lighter grey on dark themes, white with a soft shadow on light ones
    backgroundColor: t.dark ? alpha(t.c.tint, 0.17) : t.c.panel3,
    shadowColor: t.c.shade, shadowOpacity: t.dark ? 0 : 0.14, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  segment: { flex: 1, minWidth: 0, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 6 },
})

/**
 * Selectable capsule for filter rows (weeks, roles). `color` tints it when on (a role's colour, say); without it the
 * selected pill is the theme's bright highlight.
 */
export function Pill({ label, on, onPress, accent, color, badge, style }: {
  label: string; on: boolean; onPress: () => void; accent?: boolean; color?: string; badge?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const bg = on ? (color ? alpha(color, 0.18) : t.c.hi) : alpha(t.c.tint, 0.07)
  const fg = on ? (color ?? t.c.ink) : accent ? t.c.accent : t.c.muted
  return (
    <Pressable
      onPress={() => {
        haptic.select()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: CONTROL_H, paddingHorizontal: 13,
          borderRadius: 999, backgroundColor: bg, borderWidth: 1, borderColor: !on && accent ? t.c.accent : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Txt display weight={600} size={13} style={{ color: fg }}>{label}</Txt>
      {badge}
    </Pressable>
  )
}
