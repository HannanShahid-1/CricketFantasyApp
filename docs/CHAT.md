# Chat, trades and the commissioner

How league chat, direct messages and the trade flow work in the prototype, and what changes when the league goes multiplayer.

## What's in the prototype

**League chat** (one per league): docked on the right of the Matchup (home) screen, and also in the Chat tab
- Text messages, emoji reactions, typing indicators and read receipts (small coloured dots show how far each manager has read; hover for names)
- League events posted automatically: free-agent adds and drops, waiver results, trades pending review and their outcome, weekly results, the playoff bracket, and the champion
- Commissioner approve/veto buttons on pending trades

**Direct messages** (one per pair of managers), in the Chat tab
- Text, reactions, "Seen" receipts and typing
- Trade offers as cards: Accept/Decline for the receiver, Withdraw for the sender, live status, and an optional note
- Every step of a trade is posted in the DM: accepted, declined, withdrawn, expired, approved, vetoed, failed

**Notifications:** unread badges on the Chat tab and on each conversation, a "New messages" divider, and a toast for new DMs and trade offers.

## Trade lifecycle

```
proposed ──► declined | withdrawn | expired (end of week)
   │
   ▼ accepted
review ──► approved (commissioner, or automatically when the next match starts)
       └─► vetoed (commissioner)
any step ─► failed (deal is no longer legal, e.g. a player was dropped or traded elsewhere)
```

- The league setting `tradeReview` is `'commissioner'` by default. With `'none'`, accepted trades process immediately.
- The league creator is the commissioner (`league.commissionerId`). Only the commissioner can approve or veto.
- AI managers send you offers and make trades with each other at the end of some weeks, so commissioner review gets used in a single-player league.

## Where the code lives

| File | Role | Multiplayer |
|---|---|---|
| `app/src/engine/chat.ts` | Data model: channels, messages, events, read cursors, reactions | Becomes the database tables and shared types |
| `app/src/engine/league.ts` (trades section) | Trade lifecycle, review, expiry, posting events to chat | Runs on the server, so trades can't be faked from a client |
| `app/src/store.ts` | Actions the UI calls (`sendMessage`, `proposeTrade`, `reviewTrade`, `markRead`…) | Same names, but they call the API instead of changing local state |
| `app/src/bots.ts` | Simulated managers: reading, typing, replies, banter, answering offers | **Deleted.** Real people do these things |
| `app/src/ui/views/ChatView.tsx`, `app/src/ui/chat/*` | Screens and cards | Rebuilt for iPhone in React Native, using the same data and actions |

## Moving to multiplayer (e.g. Supabase)

The data model already matches how a chat backend stores things:

| Prototype | Backend |
|---|---|
| `chat.messages[]` (`id, channel, author, at, text, event, reactions`) | `messages` table; `event` as JSON |
| `chat.reads[channel][member] = { id, at }` | `read_cursors` table (one row per member per channel). This is how "Seen" works in most chat apps |
| `league.trades[]` | `trades` table; status changes only through server functions |
| `typing` (store state, not saved) | Realtime presence/broadcast, never stored |
| Team ids as members (`ME = 0`) | User accounts mapped to teams; `ME` becomes the signed-in user's team |

What has to be added:

1. **Accounts and league membership:** who is in which league, and which team is theirs.
2. **Realtime subscription:** listen for new messages, read-cursor updates and typing in the league and your DMs.
3. **Server-side rules:** proposing, accepting and reviewing trades, plus posting system events, move to server functions. That way a client can't approve its own trade or fake a league event.
4. **Push notifications** (iPhone): new DM, trade offer, "trade needs review" for the commissioner.
5. **Commissioner tools:** settings screen (review on/off, review period length, trade deadline), veto by league vote, transferring the commissioner role, and manual roster fixes.

The UI shouldn't need to change, because it already reads from the same shapes and calls the same actions.
