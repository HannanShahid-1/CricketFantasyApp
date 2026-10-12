// Simulated league-mates for the single-player prototype. They read messages, type, reply,
// react, answer trade offers and talk trash after each week. Everything goes through the same
// store actions a real manager would use, so in a multiplayer league this file simply goes away.
import { dmChannel, dmPartner, isDm, LEAGUE_CHANNEL, type ChannelId, type ChatMessage } from './engine/chat'
import { matchupsForWeek, type League } from './engine/league'
import { fmt } from './engine/scoring'
import { ME, useApp } from './store'

let leagueKey = 0
let handled = 0
let lastPlayed = -1
const timers = new Set<ReturnType<typeof setTimeout>>()

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
const app = () => useApp.getState()

/** run fn after ms, unless the league has been reset or replaced in the meantime */
function later(ms: number, fn: () => void) {
  const key = leagueKey
  const t = setTimeout(() => {
    timers.delete(t)
    if (app().league?.createdAt === key) fn()
  }, ms)
  timers.add(t)
}

function clearTimers() {
  for (const t of timers) clearTimeout(t)
  timers.clear()
}

/** show the typing indicator, then post */
function typeThenSay(teamId: number, channel: ChannelId, text: string, delay: number) {
  const typingFor = Math.min(3200, 700 + text.length * 35)
  later(Math.max(0, delay - typingFor), () => app().setTyping(channel, teamId, true))
  later(delay, () => {
    app().setTyping(channel, teamId, false)
    app().botSay(teamId, channel, text)
  })
}

let started = false

export function startBots() {
  if (started) return
  started = true
  useApp.subscribe((s, prev) => {
    if (s.league !== prev.league) sync(s.league)
  })
  sync(app().league)
}

function sync(l: League | null) {
  if (!l || l.phase === 'draft') {
    if (!l) leagueKey = 0
    clearTimers()
    return
  }
  if (l.createdAt !== leagueKey) {
    // a league just loaded: don't replay old messages, but answer offers still waiting on a bot
    clearTimers()
    leagueKey = l.createdAt
    handled = l.chat.seq - 1
    lastPlayed = l.played
    for (const t of l.trades) if (t.status === 'pending' && !l.teams[t.to].isUser) answerTrade(t.id, t.from, t.to)
    return
  }
  const fresh = l.chat.messages.filter((m) => m.id > handled)
  if (fresh.length) handled = fresh[fresh.length - 1].id
  const latestResult = fresh.filter((m) => m.event?.type === 'week-result').pop()
  for (const m of fresh) react(l, m)
  if (latestResult?.event?.type === 'week-result') weekBanter(l, latestResult.event.week)
  if (l.played !== lastPlayed) {
    lastPlayed = l.played
    later(400, () => app().botsReadAll())
  }
}

function react(l: League, m: ChatMessage) {
  const ev = m.event
  if (ev?.type === 'trade' && ev.stage === 'proposed') {
    const t = l.trades.find((x) => x.id === ev.tradeId)
    if (t && t.from === ME && !l.teams[t.to].isUser) answerTrade(t.id, t.from, t.to)
    return
  }
  if (m.author !== ME || !m.text) return

  if (isDm(m.channel)) {
    const bot = dmPartner(m.channel, ME)
    later(rand(700, 2000), () => app().botRead(bot, m.channel))
    typeThenSay(bot, m.channel, dmReply(m.text), rand(2600, 4800))
    return
  }

  const bots = l.teams.filter((t) => !t.isUser)
  for (const b of bots) later(rand(1200, 16000), () => app().botRead(b.id, LEAGUE_CHANNEL))
  if (Math.random() < 0.6) {
    const b = pick(bots)
    later(rand(600, 1500), () => app().botRead(b.id, LEAGUE_CHANNEL))
    typeThenSay(b.id, LEAGUE_CHANNEL, leagueReply(m.text), rand(3000, 6000))
  }
  if (Math.random() < 0.35) {
    const b = pick(bots)
    later(rand(1500, 5000), () => app().botReact(b.id, m.id, pick(['😂', '🔥', '👍', '😬'])))
  }
}

function answerTrade(id: number, from: number, to: number) {
  const ch = dmChannel(from, to)
  later(rand(500, 1200), () => app().botRead(to, ch))
  later(rand(1300, 1800), () => app().setTyping(ch, to, true))
  later(rand(3200, 4400), () => {
    app().setTyping(ch, to, false)
    app().botAnswerTrade(id)
  })
}

function weekBanter(l: League, week: number) {
  const r = l.results[week]
  if (!r) return
  const ms = matchupsForWeek(l, week)
  const mine = ms.find((m) => m.a === ME || m.b === ME)
  const lines: { teamId: number; text: string }[] = []
  if (mine && r.scores[mine.a] !== r.scores[mine.b]) {
    const opp = mine.a === ME ? mine.b : mine.a
    const iWon = r.scores[ME] > r.scores[opp]
    const s = `${fmt(Math.max(r.scores[ME], r.scores[opp]), 1)}–${fmt(Math.min(r.scores[ME], r.scores[opp]), 1)}`
    lines.push({
      teamId: opp,
      text: iWon
        ? pick([`Fine. ${s}. Enjoy it while it lasts.`, 'My bowlers forgot the ball was red this week.', 'Rematch in the playoffs. Mark it.', 'Lost by that much? Unreal.'])
        : pick([`${s}. Nothing personal 🏏`, 'Another W. Same time next week?', 'Told you my bowlers would show up.', `That's a ${s} beating. Screenshot taken 📸`]),
    })
  }
  const others = ms.filter((m) => m !== mine && r.scores[m.a] !== r.scores[m.b])
  if (others.length && Math.random() < 0.7) {
    const m = pick(others)
    const w = r.scores[m.a] > r.scores[m.b] ? m.a : m.b
    lines.push({ teamId: w, text: pick(['Quietly building something here 👀', 'Top of the table energy.', 'Too easy this week.', "Don't look now but I'm on a heater 🔥"]) })
  }
  let t = rand(2500, 4500)
  for (const x of lines) {
    typeThenSay(x.teamId, LEAGUE_CHANNEL, x.text, t)
    t += rand(3500, 6500)
  }
}

/** whole-word match for words, substring match for emoji */
const has = (text: string, ...words: string[]) =>
  words.some((w) => (/^[a-z ]+$/i.test(w) ? new RegExp(`\\b${w}\\b`, 'i').test(text) : text.includes(w)))

function leagueReply(text: string) {
  if (has(text, 'trade', 'deal', 'offer')) return pick(['My DMs are open 👀', "Send me something fair and we'll talk.", 'Everyone wants to trade until they see my asking price.'])
  if (has(text, 'gg', 'congrats', 'well played', 'nice')) return pick(['Appreciate it 🤝', 'gg', 'Respect.'])
  if (has(text, 'lol', 'haha', '😂')) return pick(['😂', 'Not wrong though', 'lmao'])
  if (text.includes('?')) return pick(['Depends who\'s asking', 'Ask me after the next match.', 'Honestly? No idea.', 'Yes. Next question.'])
  return pick(['Bold words.', 'Screenshotting this for later 📸', 'Talk is cheap. See you Sunday.', 'Respectfully, no.', 'Big if true.', 'This chat needs more cricket and fewer excuses.', 'Not the worst take I\'ve seen in here.'])
}

function dmReply(text: string) {
  if (has(text, 'trade', 'deal', 'offer', 'swap')) return pick(["Open to it. Send me an offer and I'll take a look.", 'Depends who you want. Put something together.', "Always listening. Make it worth my while."])
  if (has(text, 'hi', 'hey', 'hello', 'yo')) return pick(["Hey! What's up?", 'Yo 👋', 'Hey hey'])
  if (text.includes('?')) return pick(['Good question. Let me think on it.', "Honestly, I'm not sure yet.", 'Probably? Ask me after this week.'])
  return pick(['Ha, fair.', 'Noted 👍', "We'll see about that.", 'Haha', '100%', 'Let me think on it'])
}
