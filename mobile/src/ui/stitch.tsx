import { useState } from 'react'
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { alpha, useTheme } from '@/theme/theme'

// The Stitch theme's signature, the cricket ball's seam: `Seam` divides the two sides of a scorecard, and `Meter`
// draws shares as a row of stitches. Other themes keep plain bars and no seam, so screens use these unconditionally.

const STITCH = { gap: 6.5, long: 4.5, thick: 1.5, angle: 32, height: 11 }

/** Width of a view, measured on layout. */
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0)
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))]
}

/**
 * A ball's seam across the view's width: two rows of slanted stitches in a herringbone. Draws only in themes with
 * the stitch motif.
 */
export function Seam({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  const [width, onLayout] = useWidth()
  if (!t.stitched) return null
  const n = Math.max(0, Math.floor(width / STITCH.gap))
  const row = (side: 1 | -1) => (
    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
      {Array.from({ length: n }, (_, i) => (
        <View
          key={i}
          style={{
            width: STITCH.thick, height: STITCH.long, borderRadius: STITCH.thick / 2, backgroundColor: t.c.seam,
            transform: [{ rotate: `${side * STITCH.angle}deg` }],
          }}
        />
      ))}
    </View>
  )
  return (
    <View onLayout={onLayout} pointerEvents="none" accessible={false} style={[{ height: STITCH.height, gap: 3 }, style]}>
      {n > 0 && row(1)}
      {n > 0 && row(-1)}
    </View>
  )
}

const TICK = { width: 3, gap: 2.5 }

/**
 * A share as a bar: `value` (0–1) in `color`, the rest in `rest` (two sides, e.g. win chances) or the empty track.
 * Stitched themes draw it as a row of slanted stitches, a little taller than the bar.
 */
export function Meter({ value, color, rest, height = 6, style }: {
  value: number; color: string; rest?: string; height?: number; style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const [width, onLayout] = useWidth()
  const v = Math.min(1, Math.max(0, value))
  const empty = alpha(t.c.tint, t.stitched ? 0.12 : 0.1)
  if (!t.stitched) {
    return (
      <View style={[{ height, borderRadius: height / 2, overflow: 'hidden', flexDirection: 'row', backgroundColor: empty }, style]}>
        <View style={{ width: `${v * 100}%`, backgroundColor: color, borderRadius: rest ? 0 : height / 2 }} />
        {rest && <View style={{ flex: 1, backgroundColor: rest }} />}
      </View>
    )
  }
  const n = Math.max(0, Math.floor((width + TICK.gap) / (TICK.width + TICK.gap)))
  const filled = Math.round(v * n)
  return (
    <View onLayout={onLayout} style={[{ height: height + 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, style]}>
      {Array.from({ length: n }, (_, i) => (
        <View
          key={i}
          style={{
            width: TICK.width, height: height + 4, borderRadius: TICK.width / 2,
            backgroundColor: i < filled ? color : rest ?? empty,
            transform: [{ skewX: '-18deg' }],
          }}
        />
      ))}
    </View>
  )
}
