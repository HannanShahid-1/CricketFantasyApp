import { useRef } from 'react'
import type { League } from '@shared/engine/league'
import { useApp } from '@shared/store'

/** The store's chat-only updates copy just `chat`, so every other field keeps its identity. */
function sameExceptChat(a: League, b: League) {
  for (const k in b) if (k !== 'chat' && a[k as keyof League] !== b[k as keyof League]) return false
  return true
}

/**
 * The league for views that show game state but no chat: it only changes when something other than the chat changes,
 * so messages, reactions and read receipts (several a second while the AI managers reply) don't re-render them.
 * Use it everywhere except the chat screens.
 */
export function useGameLeague(): League | null {
  const prev = useRef<League | null>(null)
  return useApp((s) => {
    const l = s.league
    if (l && prev.current && sameExceptChat(prev.current, l)) return prev.current
    return (prev.current = l)
  })
}
