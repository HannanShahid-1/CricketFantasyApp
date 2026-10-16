import { GlassContainer, GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect'
import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react'
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { slotColor } from './badges'
import { Txt } from './text'

// Experiment: Liquid Glass on the Matchup tab (Settings → Experiments → Glass matchup). Everything glass lives in
// this file, so the switch brings back the plain look, and deleting the file plus its few uses removes it.

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
 * A glass card: a clear pane with no frosting, so whatever is under it (`wash`, `under`: colour washes) shows
 * straight through, and only its edges catch the light. A drop-in for a rounded panel.
 */
export function Glass({ radius, wash, under, children, style }: {
  radius: number; wash?: string; under?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const fill = StyleSheet.absoluteFill
  const light = sheen(t)
  return (
    <View style={[{ borderRadius: radius }, style]}>
      <View pointerEvents="none" style={[fill, { borderRadius: radius, overflow: 'hidden' }]}>
        {wash && <View style={[fill, { experimental_backgroundImage: wash }]} />}
        {under}
        {/* the pane itself: barely there, so the page and colours under it show straight through */}
        <View style={[fill, { backgroundColor: alpha(light, t.dark ? 0.035 : 0.25) }]} />
      </View>
      {children}
      <View
        pointerEvents="none"
        style={[fill, {
          borderRadius: radius,
          // glass shows at its edges: light along the top lip and down the sides, a darker line where it meets the page
          boxShadow: [
            `inset 0 1px 0 ${alpha(light, t.dark ? 0.28 : 0.9)}`,
            `inset 0 0 0 1px ${alpha(light, t.dark ? 0.1 : 0.55)}`,
            `0 0 0 0.5px ${alpha(t.c.shade, t.dark ? 0.6 : 0.12)}`,
          ].join(', '),
        }]}
      />
    </View>
  )
}

/**
 * `Section` on glass: the same rows and separators, with the title followed by a hairline. `washes` (one per row,
 * e.g. from `sideWash`) are laid under the glass behind their rows, so the glass bends each row's colour.
 */
export function GlassSection({ title, inset = 16, washes, children, style }: {
  title?: string; inset?: number; washes?: (string | null)[]; children: ReactNode; style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const rows = Children.toArray(children).filter(isValidElement)
  // where each row sits, so its wash can go under the glass behind it
  const [boxes, setBoxes] = useState<{ y: number; h: number }[]>([])
  const measure = (i: number) => (e: LayoutChangeEvent) => {
    const { y, height: h } = e.nativeEvent.layout
    setBoxes((b) => (b[i]?.y === y && b[i]?.h === h ? b : Object.assign([...b], { [i]: { y, h } })))
  }
  const under = washes && rows.map((_, i) => washes[i] && boxes[i] && (
    <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: boxes[i].y, height: boxes[i].h, experimental_backgroundImage: washes[i] }} />
  ))
  return (
    <View style={style}>
      {title && (
        <View style={s.header}>
          <Txt up size={12} weight={600} tone="muted" style={{ letterSpacing: 1.6 }}>{title}</Txt>
          <View style={s.headerLine} />
        </View>
      )}
      <Glass radius={t.r.lg + 2} under={under}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 && <View style={[s.sep, { marginLeft: inset }]} />}
            <View onLayout={washes ? measure(i) : undefined}>{row}</View>
          </Fragment>
        ))}
      </Glass>
    </View>
  )
}

/** iOS 26+: the system's Liquid Glass, which `LiquidPager` needs to melt cards together. */
export const canLiquid = isGlassEffectAPIAvailable()

const AnimatedGlass = Animated.createAnimatedComponent(GlassView)

/** System glass cards closer than this (points) start to melt together. */
const MERGE = 26
/** How fast a swipe pulls the cards together: joined from about 1/8 of the way until the last 1/8. */
const PULL = 3

/**
 * A full-width pager of system glass cards that melt into one while you swipe and stretch apart as the next one
 * settles. In a plain pager the cards move together and never meet, so each card is also slid towards its
 * neighbour by the swipe itself (tied to the finger): the 32pt gap closes as soon as a swipe starts, stays shut for
most of it, and opens again (stretching, then snapping) as the next page settles.
 * `children(i, width)` is card i's content.
 */
export function LiquidPager({ count, index, radius, onIndex, children }: {
  count: number; index: number; radius: number; onIndex: (i: number) => void; children: (i: number, width: number) => ReactNode
}) {
  const page = useWindowDimensions().width
  const width = page - 32
  const x = useSharedValue(index * page)
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x
  })
  return (
    <Animated.ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      contentOffset={{ x: index * page, y: 0 }}
      onMomentumScrollEnd={(e) => onIndex(Math.round(e.nativeEvent.contentOffset.x / page))}
      style={{ marginHorizontal: -16 }}
    >
      <GlassContainer spacing={MERGE} style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 32 }}>
        {Array.from({ length: count }, (_, i) => (
          <LiquidCard key={i} i={i} x={x} page={page} width={width} radius={radius}>{children(i, width)}</LiquidCard>
        ))}
      </GlassContainer>
    </Animated.ScrollView>
  )
}

function LiquidCard({ i, x, page, width, radius, children }: {
  i: number; x: SharedValue<number>; page: number; width: number; radius: number; children: ReactNode
}) {
  const t = useTheme()
  const slide = useAnimatedStyle(() => {
    // how far the pager is from this card, in pages: within one page, lean towards the card it's moving to, all the
    // way (plus a little overlap so they fully fuse) for most of the swipe
    const d = x.value / page - i
    if (Math.abs(d) >= 1) return { transform: [{ translateX: 0 }] }
    const pull = Math.min(1, PULL * Math.sin(Math.PI * Math.abs(d)))
    return { transform: [{ translateX: Math.sign(d) * 18 * pull }] }
  })
  return (
    <AnimatedGlass glassEffectStyle="clear" colorScheme={t.dark ? 'dark' : 'light'} style={[{ width, borderRadius: radius }, slide]}>
      {children}
    </AnimatedGlass>
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
