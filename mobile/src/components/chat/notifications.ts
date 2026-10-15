import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import type { ChannelId } from '@shared/engine/chat'
import { useApp } from '@shared/store'
import { incomingNotice } from '@shared/ui/chat/chatText'

/** The conversation on screen: set by ConversationScreen while it's focused, null otherwise. */
export const useOpenChannel = create<{ channel: ChannelId | null }>(() => ({ channel: null }))

export const setOpenChannel = (channel: ChannelId) => useOpenChannel.setState({ channel })

/** Clear the open conversation, unless another one has opened since. */
export function clearOpenChannel(channel: ChannelId) {
  if (useOpenChannel.getState().channel === channel) useOpenChannel.setState({ channel: null })
}

/**
 * Toasts new direct messages and trade offers sent to you, unless that conversation is open (the web's
 * useIncomingNotifications). Mount once, in the tabs layout.
 */
export function useChatNotifications() {
  const seq = useApp((s) => s.league?.chat.seq ?? 0)
  const last = useRef(seq)
  useEffect(() => {
    const from = last.current
    last.current = seq
    const { league, notify } = useApp.getState()
    // nothing new, or a new league whose message ids started again
    if (!league || seq <= from) return
    const open = useOpenChannel.getState().channel
    const msgs = league.chat.messages
    // newest first: one toast is visible at a time, so show the latest worth showing
    for (let i = msgs.length - 1; i >= 0 && msgs[i].id >= from; i--) {
      if (msgs[i].channel === open) continue
      const text = incomingNotice(league, msgs[i])
      if (text) {
        notify(text, 'info')
        return
      }
    }
  }, [seq])
}
