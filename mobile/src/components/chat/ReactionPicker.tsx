import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Keyboard, Modal, Pressable, useWindowDimensions, View } from 'react-native'
import { REACTIONS, type ChatMessage } from '@shared/engine/chat'
import { managerName } from '@shared/engine/league'
import { ME, useApp } from '@shared/store'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { haptic, Txt } from '@/ui'
import { BubbleBody, type BubblePos } from './Bubble'

// Press and hold a message to react, like Tapback in Messages: the screen dims, the bubble stays lit where it was,
// and a strip of emoji springs out above it (below it near the top of the screen). Who reacted is listed under it.
// Built on a transparent Modal so it covers the header and tab bar; positions come from measureInWindow.

export interface ReactTarget {
  m: ChatMessage
  mine: boolean
  pos: BubblePos
  /** the bubble's frame in window coordinates */
  rect: { x: number; y: number; width: number; height: number }
}

const OpenContext = createContext<(target: ReactTarget) => void>(() => {})

/** Opens the reaction picker for a message (from inside a ReactionPicker). */
export const useReactionPicker = () => useContext(OpenContext)

const STRIP_H = 52
const GAP = 10
const MARGIN = 12

/** Provides the picker to the messages inside it. `top` is the lowest y the strip may use (below the header). */
export function ReactionPicker({ top, children }: { top: number; children: ReactNode }) {
  const [target, setTarget] = useState<ReactTarget | null>(null)
  const [open, setOpen] = useState(false)
  const show = useCallback((x: ReactTarget) => {
    haptic.tap()
    setTarget(x)
    setOpen(true)
  }, [])
  return (
    <OpenContext.Provider value={show}>
      {children}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} onDismiss={() => setTarget(null)}>
        {target && <Overlay target={target} top={top} onClose={() => setOpen(false)} />}
      </Modal>
    </OpenContext.Provider>
  )
}

function Overlay({ target, top, onClose }: { target: ReactTarget; top: number; onClose: () => void }) {
  const t = useTheme()
  const s = useStyles(styles)
  const { width: W, height: H } = useWindowDimensions()
  const react = useApp((st) => st.react)
  const teams = useApp((st) => st.league?.teams)
  const { m, mine, pos, rect } = target
  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 9 }).start()
  }, [pop])

  // the strip goes above the bubble, or below it when there's no room under the header
  const minTop = top + 8
  const maxTop = H - STRIP_H - 40
  const above = rect.y - STRIP_H - GAP
  const stripTop = above >= minTop ? above : Math.min(Math.max(rect.y + rect.height + GAP, minTop), maxTop)
  const below = stripTop > rect.y
  // line it up with the bubble's outer edge, on screen
  const side = mine ? { right: Math.max(MARGIN, W - rect.x - rect.width) } : { left: Math.max(MARGIN, rect.x) }
  // who reacted: under the bubble and strip, or above them if that would run under the keyboard or off screen
  const reactions = Object.entries(m.reactions ?? {})
  const kb = Keyboard.metrics()
  const floor = (kb ? kb.screenY : H) - 12
  const whoH = reactions.length * 26 + 22
  const under = below ? stripTop + STRIP_H + GAP : rect.y + rect.height + GAP
  const whoTop = under + whoH <= floor ? under : Math.max(minTop, Math.min(stripTop, rect.y) - GAP - whoH)
  const name = (id: number) => (id === ME ? 'You' : teams ? managerName(teams[id]) : '')

  const choose = (emoji: string) => {
    haptic.select()
    react(m.id, emoji)
    onClose()
  }

  return (
    <View style={{ flex: 1 }} accessibilityViewIsModal>
      <Pressable style={[s.fill, { backgroundColor: t.c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View pointerEvents="none" style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width }}>
        <BubbleBody text={m.text ?? ''} mine={mine} pos={pos} />
      </View>
      <Animated.View
        style={[
          s.strip,
          side,
          { top: stripTop, opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
        ]}
      >
        {REACTIONS.map((e) => {
          const on = !!m.reactions?.[e]?.includes(ME)
          return (
            <Pressable
              key={e}
              onPress={() => choose(e)}
              style={({ pressed }) => [s.emoji, on && s.emojiOn, pressed && { transform: [{ scale: 1.2 }] }]}
              accessibilityRole="button"
              accessibilityLabel={on ? `Remove ${e}` : `React ${e}`}
            >
              <Txt size={25}>{e}</Txt>
            </Pressable>
          )
        })}
      </Animated.View>
      {reactions.length > 0 && (
        <Animated.View style={[s.who, side, { top: whoTop, opacity: pop }]}>
          {reactions.map(([e, ids]) => (
            <View key={e} style={s.whoRow}>
              <Txt size={15}>{e}</Txt>
              <Txt size={13.5} tone="muted" numberOfLines={2} style={{ flexShrink: 1 }}>{ids.map(name).join(', ')}</Txt>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  )
}

const styles = (t: Theme) => ({
  fill: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  strip: {
    position: 'absolute' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, height: STRIP_H,
    paddingHorizontal: 5, borderRadius: STRIP_H / 2, backgroundColor: t.c.panel3, borderWidth: 1, borderColor: t.c.line2,
    shadowColor: t.c.shade, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
  },
  emoji: { width: 42, height: 42, borderRadius: 21, alignItems: 'center' as const, justifyContent: 'center' as const },
  emojiOn: { backgroundColor: alpha(t.c.accent, 0.24) },
  who: {
    position: 'absolute' as const, maxWidth: 280, gap: 6, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: t.r.lg, backgroundColor: t.c.panel3, borderWidth: 1, borderColor: t.c.line2,
  },
  whoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
})
