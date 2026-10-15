import { Fragment, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import type { ChatEvent, ChatMessage, TradeStage } from '@shared/engine/chat'
import { managerName, matchupsForWeek, matchupWinner, REG_WEEKS, type TradeOffer } from '@shared/engine/league'
import { fmt } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { weekLabel } from '@shared/ui/format'
import {
  leagueTradeInfo, offerStatusText, teamLabel, TRADE_STATUS, tradeLine, tradeSides, txnVerb, who,
} from '@shared/ui/chat/chatText'
import { recordOf, standingsOf } from '@/data/derived'
import { nav } from '@/nav'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import {
  Button, Chip, confirm, Icon, PlayerLine, PlayerLink, report, TeamBadge, Txt, type ChipTone, type SFSymbol,
} from '@/ui'
import { useGameLeague } from '@/data/gameLeague'

// League events in the chat (the web's ChatCards): rounded panels with a tinted symbol, or a one-line system note.
// They read the league through useGameLeague, so chat traffic doesn't re-render them.

/** A league event in a conversation. Trade offers get a full card in DMs; other trade steps are one-liners there. */
export function EventMessage({ m, inDm }: { m: ChatMessage; inDm: boolean }) {
  const t = useTheme()
  const league = useGameLeague()!
  const e = m.event
  if (!e) return null
  switch (e.type) {
    case 'league-created':
      return (
        <SystemLine icon="building.columns">
          <B size={12.5}>{league.name}</B> was created. {league.commissionerId === ME ? 'You are' : `${managerName(league.teams[league.commissionerId])} is`} the commissioner.
        </SystemLine>
      )
    case 'draft-complete':
      return (
        <Card icon="square.grid.3x3.fill" color={t.c.accent} title="The draft is complete">
          <Txt size={14} tone="muted" style={{ lineHeight: 19 }}>
            {league.draft.rounds} rounds, {league.numTeams} teams, {league.draft.picks.length} picks. Set your lineup — Week 1 is up next.
          </Txt>
        </Card>
      )
    case 'txn':
      return <TxnCard teamId={e.teamId} adds={e.adds} drops={e.drops} />
    case 'waivers':
      return <WaiversCard e={e} />
    case 'week-result':
      return <WeekResultCard week={e.week} />
    case 'playoffs-set':
      return <PlayoffsCard />
    case 'champion':
      return <ChampionCard teamId={e.teamId} />
    case 'trade': {
      const offer = league.trades.find((x) => x.id === e.tradeId)
      if (!offer) return null
      if (inDm && e.stage === 'proposed') return <TradeOfferCard offer={offer} />
      if (inDm) return <SystemLine icon="arrow.left.arrow.right">{tradeLine(league, offer, e)}</SystemLine>
      return <LeagueTradeCard offer={offer} stage={e.stage} by={e.by ?? null} />
    }
  }
}

// ---------------------------------------------------------------- building blocks

/** Bold run inside a line of text. */
function B({ children, size = 15 }: { children: ReactNode; size?: number }) {
  return <Txt size={size} weight={700}>{children}</Txt>
}

function Card({ icon, color, title, aside, highlight, children }: {
  icon: SFSymbol; color: string; title: ReactNode; aside?: ReactNode; highlight?: boolean; children?: ReactNode
}) {
  const s = useStyles(styles)
  return (
    <View style={[s.card, highlight && { backgroundColor: alpha(color, 0.08), borderColor: alpha(color, 0.3) }]}>
      <View style={s.head}>
        <View style={[s.icon, { backgroundColor: alpha(color, 0.16) }]}>
          <Icon name={icon} size={14} color={color} weight="semibold" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {typeof title === 'string' ? <Txt size={15} weight={700} numberOfLines={2}>{title}</Txt> : title}
        </View>
        {aside}
      </View>
      {children}
    </View>
  )
}

function SystemLine({ icon, children }: { icon: SFSymbol; children: ReactNode }) {
  const t = useTheme()
  const s = useStyles(styles)
  return (
    <View style={s.system}>
      <Icon name={icon} size={12} color={t.c.dim} />
      <Txt size={12.5} tone="muted" style={{ flexShrink: 1, textAlign: 'center', lineHeight: 17 }}>{children}</Txt>
    </View>
  )
}

/** A player in a card: tap for his card, press and hold for actions. */
function CardPlayer({ pid, sign }: { pid: number; sign?: 'add' | 'drop' }) {
  const t = useTheme()
  const s = useStyles(styles)
  return (
    <PlayerLink pid={pid} style={s.player}>
      {sign && <Icon name={sign === 'add' ? 'plus.circle.fill' : 'minus.circle.fill'} size={17} color={sign === 'add' ? t.c.accent : t.c.loss} />}
      <PlayerLine p={getData().players[pid]} size={32} />
    </PlayerLink>
  )
}

const chipTone = (tone: (typeof TRADE_STATUS)[keyof typeof TRADE_STATUS]['tone']): ChipTone => tone || 'neutral'

// ---------------------------------------------------------------- league events

function TxnCard({ teamId, adds, drops }: { teamId: number; adds: number[]; drops: number[] }) {
  const t = useTheme()
  const league = useGameLeague()!
  return (
    <Card
      icon={adds.length ? 'plus' : 'minus'}
      color={adds.length ? t.c.accent : t.c.loss}
      title={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TeamBadge team={league.teams[teamId]} size={22} />
          <Txt size={15} numberOfLines={1} style={{ flexShrink: 1 }}>
            <B>{teamLabel(league, teamId)}</B> <Txt size={15} tone="muted">{txnVerb(adds, drops)}</Txt>
          </Txt>
        </View>
      }
      aside={<Chip label="Free agency" />}
    >
      <View style={{ gap: 10 }}>
        {adds.map((p) => <CardPlayer key={`a${p}`} pid={p} sign="add" />)}
        {drops.map((p) => <CardPlayer key={`d${p}`} pid={p} sign="drop" />)}
      </View>
    </Card>
  )
}

function WaiversCard({ e }: { e: Extract<ChatEvent, { type: 'waivers' }> }) {
  const t = useTheme()
  const s = useStyles(styles)
  const league = useGameLeague()!
  const d = getData()
  return (
    <Card
      icon="dollarsign.circle.fill"
      color={t.c.gold}
      title={<Txt size={15}><B>Waivers processed</B><Txt size={15} tone="muted"> · after {weekLabel(e.week)}</Txt></Txt>}
    >
      <View style={{ gap: 12 }}>
        {e.claims.map((c, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TeamBadge team={league.teams[c.teamId]} size={30} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Txt size={14} weight={600} numberOfLines={1}>{teamLabel(league, c.teamId)}</Txt>
              <View style={s.claim}>
                <PlayerLink pid={c.add} style={s.inline}>
                  <Icon name="plus" size={10} color={t.c.accent} weight="bold" />
                  <Txt size={13.5} weight={600} tone="accent">{d.players[c.add].name}</Txt>
                </PlayerLink>
                {c.drop !== null && (
                  <PlayerLink pid={c.drop} style={s.inline}>
                    <Icon name="minus" size={10} color={t.c.loss} weight="bold" />
                    <Txt size={13.5} tone="muted">{d.players[c.drop].name}</Txt>
                  </PlayerLink>
                )}
              </View>
            </View>
            <Chip label={`$${c.bid}`} tone="gold" />
          </View>
        ))}
      </View>
    </Card>
  )
}

function WeekResultCard({ week }: { week: number }) {
  const t = useTheme()
  const s = useStyles(styles)
  const league = useGameLeague()!
  const r = league.results[week]
  if (!r) return null
  // your matchup first
  const ms = matchupsForWeek(league, week).sort((a, b) => Number(b.a === ME || b.b === ME) - Number(a.a === ME || a.b === ME))
  return (
    <Card
      icon="trophy.fill"
      color={t.c.sky}
      title={`${weekLabel(week)} final`}
      aside={<Button title="View" kind="tinted" size="small" onPress={() => nav.week(week)} />}
    >
      <View style={{ gap: 6 }}>
        {ms.map((m, i) => {
          const w = matchupWinner(league, m)
          return (
            <View key={i} style={[s.matchup, (m.a === ME || m.b === ME) && s.mine]}>
              {m.label && <Txt up size={10} weight={700} tone="gold">{m.label}</Txt>}
              {[m.a, m.b].map((id) => (
                <View key={id} style={s.scoreRow}>
                  <TeamBadge team={league.teams[id]} size={22} />
                  <Txt size={14} weight={w === id ? 700 : 500} tone={w === id ? 'text' : 'muted'} numberOfLines={1} style={{ flex: 1 }}>
                    {league.teams[id].name}
                    {id === ME && <Txt size={14} tone="dim"> (you)</Txt>}
                  </Txt>
                  <Txt num size={15} weight={w === id ? 700 : 500} tone={w === id ? 'text' : 'muted'}>{fmt(r.scores[id], 1)}</Txt>
                </View>
              ))}
            </View>
          )
        })}
        {r.median !== null && week <= REG_WEEKS && (
          <Txt size={12.5} tone="dim" style={{ marginTop: 4 }}>League median {fmt(r.median, 1)} · beat it for an extra win</Txt>
        )}
      </View>
    </Card>
  )
}

function PlayoffsCard() {
  const t = useTheme()
  const league = useGameLeague()!
  return (
    <Card
      icon="flag.checkered"
      color={t.c.gold}
      title="The playoff bracket is set"
      aside={<Button title="Bracket" kind="tinted" size="small" onPress={() => nav.league('playoffs')} />}
    >
      <View style={{ gap: 8 }}>
        {standingsOf(league).slice(0, 4).map((row, i) => (
          <View key={row.teamId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Txt num size={14} tone="dim" style={{ width: 14 }}>{i + 1}</Txt>
            <TeamBadge team={league.teams[row.teamId]} size={24} />
            <Txt size={14} weight={500} numberOfLines={1} style={{ flex: 1 }}>{league.teams[row.teamId].name}</Txt>
            <Txt num size={13} tone="muted">{recordOf(league, row.teamId)}</Txt>
          </View>
        ))}
      </View>
    </Card>
  )
}

function ChampionCard({ teamId }: { teamId: number }) {
  const t = useTheme()
  const league = useGameLeague()!
  const team = league.teams[teamId]
  return (
    <Card
      icon="trophy.fill"
      color={t.c.gold}
      highlight
      title={<Txt size={15}><B>{team.name}</B> are the champions</Txt>}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TeamBadge team={team} size={44} />
        <Txt size={14} tone="muted" style={{ flex: 1, lineHeight: 19 }}>
          {managerName(team)} {teamId === ME ? 'win' : 'wins'} the {league.name}. 🏆
        </Txt>
      </View>
    </Card>
  )
}

// ---------------------------------------------------------------- trades

/** Both sides of a trade. */
function TradeSides({ offer, perspective }: { offer: TradeOffer; perspective: 'me' | 'league' }) {
  const s = useStyles(styles)
  const league = useGameLeague()!
  return (
    <View style={{ gap: 12 }}>
      {tradeSides(league, offer, perspective).map((side, i) => (
        <Fragment key={side.label}>
          {i > 0 && <View style={s.rule} />}
          <View style={{ gap: 9 }}>
            <Txt up size={11} weight={700} tone="muted">{side.label}</Txt>
            {side.ps.map((p) => <CardPlayer key={p} pid={p} />)}
          </View>
        </Fragment>
      ))}
    </View>
  )
}

/** Approve/Veto for a trade in review, when you're the commissioner. */
function CommishActions({ offer }: { offer: TradeOffer }) {
  const t = useTheme()
  const league = useGameLeague()!
  const reviewTrade = useApp((st) => st.reviewTrade)
  if (offer.status !== 'review' || league.commissionerId !== ME) return null
  const veto = async () => {
    if (await confirm({ title: 'Veto this trade?', message: 'The players stay where they are.', ok: 'Veto', destructive: true })) {
      report(reviewTrade(offer.id, false), 'Trade vetoed')
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        <Icon name="building.columns.fill" size={12} color={t.c.gold} style={{ marginTop: 2 }} />
        <Txt size={12.5} tone="muted" style={{ flex: 1, lineHeight: 17 }}>
          You're the commissioner. If you do nothing, it goes through when the next match starts.
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Veto" icon="xmark" kind="destructive" onPress={veto} style={{ flex: 1 }} />
        <Button title="Approve" icon="checkmark" kind="filled" onPress={() => report(reviewTrade(offer.id, true), 'Trade approved and processed')} style={{ flex: 1 }} />
      </View>
    </View>
  )
}

const STAGE_ICON: Partial<Record<TradeStage, SFSymbol>> = {
  review: 'hourglass',
  approved: 'arrow.left.arrow.right',
  vetoed: 'hand.raised.fill',
  failed: 'xmark.octagon.fill',
}

/** A trade as the league sees it: in review (with commissioner actions), processed, vetoed or failed. */
function LeagueTradeCard({ offer, stage, by }: { offer: TradeOffer; stage: TradeStage; by: number | null }) {
  const t = useTheme()
  const league = useGameLeague()!
  const info = leagueTradeInfo(league, offer, stage, by)
  const st = TRADE_STATUS[offer.status]
  return (
    <Card
      icon={STAGE_ICON[stage] ?? 'arrow.left.arrow.right'}
      color={t.c[info.tone]}
      title={info.title}
      aside={stage === 'review' && <Chip label={st.label} tone={chipTone(st.tone)} />}
    >
      <TradeSides offer={offer} perspective="league" />
      {info.foot && <Txt size={12.5} tone="dim">{info.foot}</Txt>}
      {stage === 'review' && <CommishActions offer={offer} />}
    </Card>
  )
}

/** A trade offer in a DM: both sides, the note, its status, and what you can do about it. */
function TradeOfferCard({ offer }: { offer: TradeOffer }) {
  const t = useTheme()
  const s = useStyles(styles)
  const league = useGameLeague()!
  const { respondTrade, withdrawTrade } = useApp(useShallow((st) => ({ respondTrade: st.respondTrade, withdrawTrade: st.withdrawTrade })))
  const st = TRADE_STATUS[offer.status]
  const incoming = offer.to === ME
  // as commissioner you approve or veto right on this card (CommishActions), so skip the web's "in the league chat" line
  const status = offer.status === 'review' && league.commissionerId === ME ? '' : offerStatusText(league, offer)
  const accept = async () => {
    const d = getData()
    const message = tradeSides(league, offer, 'me').map((x) => `${x.label}: ${x.ps.map((p) => d.players[p].name).join(', ')}`).join('\n')
    if (await confirm({ title: 'Accept this trade?', message, ok: 'Accept' })) {
      report(respondTrade(offer.id, true), league.settings.tradeReview === 'commissioner' ? 'Trade accepted · sent for review' : 'Trade accepted')
    }
  }
  return (
    <Card
      icon="arrow.left.arrow.right"
      color={t.c.sky}
      title={
        <Txt size={15} numberOfLines={2}>
          <B>Trade offer</B>
          <Txt size={15} tone="muted"> · {incoming ? `from ${who(league, offer.from)}` : `to ${who(league, offer.to)}`}</Txt>
        </Txt>
      }
      aside={<Chip label={st.label} tone={chipTone(st.tone)} />}
    >
      {!!offer.note && (
        <View style={s.note}>
          <Txt size={14.5} style={{ lineHeight: 20 }}>“{offer.note}”</Txt>
        </View>
      )}
      <TradeSides offer={offer} perspective="me" />
      {!!status && <Txt size={12.5} tone="dim">{status}</Txt>}
      {offer.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {incoming ? (
            <>
              <Button title="Decline" icon="xmark" onPress={() => report(respondTrade(offer.id, false), 'Trade declined')} style={{ flex: 1 }} />
              <Button title="Accept" icon="checkmark" kind="filled" onPress={accept} style={{ flex: 1 }} />
            </>
          ) : (
            <Button
              title="Withdraw offer"
              onPress={() => {
                withdrawTrade(offer.id)
                report(null, 'Offer withdrawn')
              }}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
      <CommishActions offer={offer} />
    </Card>
  )
}

const styles = (t: Theme) => ({
  card: { gap: 14, padding: 14, borderRadius: t.r.lg, backgroundColor: t.c.panel, borderWidth: 1, borderColor: 'transparent' },
  head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 28 },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  system: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingHorizontal: 20, paddingVertical: 4 },
  player: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  inline: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingVertical: 2 },
  claim: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignItems: 'center' as const, columnGap: 12 },
  matchup: { gap: 6, paddingVertical: 8, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: t.r.md },
  mine: { backgroundColor: alpha(t.c.accent, 0.08) },
  scoreRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: t.c.line2 },
  note: { paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: alpha(t.c.sky, 0.5) },
})
