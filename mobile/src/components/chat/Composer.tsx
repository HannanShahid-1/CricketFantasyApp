import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import type { ChannelId } from '@shared/engine/chat'
import { useApp } from '@shared/store'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { haptic, Icon } from '@/ui'

const MAX_LENGTH = 1000

/** Unsent text per conversation, so leaving a conversation keeps what you were typing (as Messages does). */
const drafts = new Map<ChannelId, string>()

/**
 * The message field: grows to a few lines, then scrolls; the round send button lights up once there's something to
 * send. `bottom` is the space below it (tab bar, or the keyboard while it's up).
 */
export function Composer({ channel, placeholder, bottom, onSent }: {
  channel: ChannelId; placeholder: string; bottom: number; onSent: () => void
}) {
  const t = useTheme()
  const s = useStyles(styles)
  const [text, setText] = useState(() => drafts.get(channel) ?? '')
  const ready = text.trim().length > 0
  const change = (v: string) => {
    setText(v)
    drafts.set(channel, v)
  }
  const send = () => {
    if (!ready) return
    haptic.tap()
    useApp.getState().sendMessage(channel, text)
    change('')
    onSent()
  }
  return (
    <View style={[s.bar, { paddingBottom: bottom + 8 }]}>
      <View style={s.field}>
        <TextInput
          value={text}
          onChangeText={change}
          placeholder={placeholder}
          placeholderTextColor={t.c.dim}
          multiline
          maxLength={MAX_LENGTH}
          style={s.input}
          selectionColor={t.c.accent}
          keyboardAppearance={t.dark ? 'dark' : 'light'}
          accessibilityLabel={placeholder}
        />
        <Pressable
          onPress={send}
          disabled={!ready}
          hitSlop={8}
          style={[s.send, { backgroundColor: ready ? t.c.accent : alpha(t.c.tint, 0.1) }]}
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !ready }}
        >
          <Icon name="arrow.up" size={16} weight="bold" color={ready ? t.c.accentInk : t.c.dim} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = (t: Theme) => ({
  bar: { paddingTop: 8, paddingHorizontal: 12, backgroundColor: t.c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.line },
  field: {
    flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 6, minHeight: 40, paddingLeft: 14, paddingRight: 4,
    paddingVertical: 4, borderRadius: 20, backgroundColor: t.c.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: t.c.line2,
  },
  input: { flex: 1, maxHeight: 132, paddingTop: 7, paddingBottom: 7, fontFamily: t.font.body(400), fontSize: 16, lineHeight: 21, color: t.c.text },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
})
