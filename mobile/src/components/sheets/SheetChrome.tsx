import { useCallback, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { League } from '@shared/engine/league'
import { useGameLeague } from '@/data/gameLeague'
import { nav } from '@/nav'
import { useStyles, type Theme } from '@/theme/theme'
import { Txt } from '@/ui'

// Building blocks for the sheets that change the league (player card, add, trade).

/**
 * The league a sheet renders. Once the sheet's action succeeds, `closeAfter()` freezes it at the state the user
 * confirmed and closes the sheet, so it doesn't flash the new state (e.g. "Not available") while it slides away.
 */
export function useSheetLeague(): [League | null, () => void] {
  const live = useGameLeague()
  const [frozen, setFrozen] = useState<League | null>(null)
  // `live` here is still the league from before the action: the store has changed, this component hasn't re-rendered
  const closeAfter = useCallback(() => {
    setFrozen(live)
    nav.close()
  }, [live])
  return [frozen ?? live, closeAfter]
}

/** Height of SheetHeader: pad the sheet's scrolling content by this much. */
export const SHEET_HEADER_HEIGHT = 62

/**
 * Title row for a sheet without a native header (the add sheet): Cancel on the left, the title centred. Render it
 * after the ScrollView: it pins itself over the top, and the content scrolls under it (pad it by SHEET_HEADER_HEIGHT).
 */
export function SheetHeader({ title, cancelLabel = 'Cancel' }: { title: string; cancelLabel?: string }) {
  const s = useStyles(styles)
  return (
    <View style={s.header}>
      <Pressable onPress={nav.close} hitSlop={12} accessibilityRole="button" style={s.side}>
        {({ pressed }) => <Txt size={17} tone="accent" style={{ opacity: pressed ? 0.45 : 1 }}>{cancelLabel}</Txt>}
      </Pressable>
      <Txt size={17} weight={600} numberOfLines={1} style={s.title} accessibilityRole="header">{title}</Txt>
      <View style={s.side} />
    </View>
  )
}

/** Bar pinned under a sheet's scrolling content for its primary action (and a short status line above it). */
export function SheetFooter({ children }: { children: ReactNode }) {
  const s = useStyles(styles)
  const bottom = useSafeAreaInsets().bottom
  return <View style={[s.footer, { paddingBottom: Math.max(bottom, 16) }]}>{children}</View>
}


const styles = (t: Theme) => ({
  header: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, height: SHEET_HEADER_HEIGHT, paddingTop: 6,
    flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, backgroundColor: t.c.bg,
  },
  side: { width: 76 },
  title: { flex: 1, textAlign: 'center' as const },
  footer: {
    gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: t.c.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line2,
  },
})
