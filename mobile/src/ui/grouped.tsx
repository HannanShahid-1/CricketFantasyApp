import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useStyles, type Theme } from '@/theme/theme'
import { Txt } from './text'

// The inset-grouped look of `Section` in pieces: for virtualised lists (SectionList renders headers and cells one at a
// time, so each cell draws its own slice of the rounded group) and for blocks that aren't a `Section` (cards, forms).

/** Small uppercase label above a group, matching `Section`'s title, with optional detail text on the right.
 *  In a SectionList, give it `style={{ paddingTop: 24 }}` for the gap between groups. */
export function GroupHeader({ title, detail, style }: { title: string; detail?: string; style?: StyleProp<ViewStyle> }) {
  const s = useStyles(styles)
  return (
    <View style={[s.header, style]}>
      <Txt up size={12} weight={600} tone="muted" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
      {detail && <Txt size={12} tone="dim">{detail}</Txt>}
    </View>
  )
}

/** One cell of a group: the first rounds the top, the last the bottom, with a hairline between cells. */
export function GroupCell({ first, last, inset = 16, style, children }: {
  first: boolean; last: boolean; inset?: number; style?: StyleProp<ViewStyle>; children: ReactNode
}) {
  const s = useStyles(styles)
  return (
    <View style={[s.cell, first && s.first, last && s.last, style]}>
      {children}
      {!first && <View style={[s.sep, { left: inset }]} />}
    </View>
  )
}

const styles = (t: Theme) => ({
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 16, paddingBottom: 7 },
  cell: { backgroundColor: t.c.panel, overflow: 'hidden' as const },
  first: { borderTopLeftRadius: t.r.lg, borderTopRightRadius: t.r.lg },
  last: { borderBottomLeftRadius: t.r.lg, borderBottomRightRadius: t.r.lg },
  sep: { position: 'absolute' as const, top: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: t.c.line2 },
})
