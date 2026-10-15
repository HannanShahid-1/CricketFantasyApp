import { View } from 'react-native'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Txt } from '@/ui'

/** Where a bubble sits in its author's run of messages: sets which corners tuck in. */
export type BubblePos = 'single' | 'first' | 'middle' | 'last'

const ROUND = 18
const TUCK = 5

export const bubblePos = (i: number, n: number): BubblePos =>
  n === 1 ? 'single' : i === 0 ? 'first' : i === n - 1 ? 'last' : 'middle'

/** Corners between grouped bubbles tighten on the author's side, like Messages. */
function corners(mine: boolean, pos: BubblePos) {
  const top = pos === 'middle' || pos === 'last' ? TUCK : ROUND
  const bottom = pos === 'first' || pos === 'middle' ? TUCK : ROUND
  return mine
    ? { borderTopRightRadius: top, borderBottomRightRadius: bottom }
    : { borderTopLeftRadius: top, borderBottomLeftRadius: bottom }
}

/** A message bubble: yours in the accent colour, everyone else's in a raised panel. */
export function BubbleBody({ text, mine, pos }: { text: string; mine: boolean; pos: BubblePos }) {
  const t = useTheme()
  const s = useStyles(styles)
  return (
    <View style={[s.bubble, mine ? s.mine : s.theirs, corners(mine, pos)]}>
      <Txt size={16} style={{ color: mine ? t.c.accentInk : t.c.text, lineHeight: 21 }}>{text}</Txt>
    </View>
  )
}

const styles = (t: Theme) => ({
  bubble: { borderRadius: ROUND, paddingHorizontal: 13, paddingVertical: 8 },
  mine: { backgroundColor: t.c.accent },
  theirs: { backgroundColor: t.c.panel3 },
})
