import { memo, useMemo, useState } from 'react'
import { View } from 'react-native'
import { currentWeek } from '@shared/engine/league'
import { oversStr } from '@shared/engine/scoring'
import { getData, ME, useApp } from '@shared/store'
import { fmtDate } from '@shared/ui/format'
import { useGameLeague } from '@/data/gameLeague'
import { WeekPills } from '@/components/WeekPills'
import { nav } from '@/nav'
import { alpha, useTheme } from '@/theme/theme'
import { Button, Chip, EmptyState, Icon, Row, Screen, Section, TeamTag, Txt } from '@/ui'

// IPL fixtures one gameweek at a time (≤ 14 matches, so a plain scroll view), grouped by day. Played matches open
// their scorecard and can be replayed ball by ball; the next match can be watched live.

export function FixturesScreen() {
  const d = getData()
  const league = useGameLeague()!
  const [week, setWeek] = useState(() => currentWeek(d, league))
  const gw = d.gameweeks[week - 1]

  // matches by day, with how many of your players are involved: those who played once it's done; before that,
  // those whose IPL team is playing (the XI isn't known until the toss)
  const days = useMemo(() => {
    const roster = league.teams[ME].roster
    const byDay = new Map<string, { mi: number; mine: number }[]>()
    for (const mi of gw.mis) {
      const m = d.matches[mi]
      const mine = mi < league.played
        ? roster.filter((p) => m.xi.has(p)).length
        : roster.filter((p) => m.teams.includes(d.players[p].team)).length
      const day = byDay.get(m.raw.date) ?? []
      day.push({ mi, mine })
      byDay.set(m.raw.date, day)
    }
    return [...byDay]
  }, [d, league, gw])

  return (
    <Screen gap={20}>
      <View style={{ gap: 12 }}>
        <Txt tone="muted" size={14}>
          {fmtDate(gw.start, false)} – {fmtDate(gw.end, false)} · {gw.mis.length} matches
        </Txt>
        <WeekPills league={league} week={week} onChange={setWeek} />
      </View>
      {days.length === 0 ? (
        <EmptyState icon="calendar" title="No IPL matches this week" />
      ) : (
        days.map(([date, ms]) => (
          <Section key={date} title={fmtDate(date)}>
            {ms.map((x) => <Fixture key={x.mi} mi={x.mi} mine={x.mine} />)}
          </Section>
        ))
      )}
      <Txt tone="dim" size={12} style={{ textAlign: 'center' }}>
        IPL {d.raw.simSeason} league stage, replayed from Cricsheet ball-by-ball data
      </Txt>
    </Screen>
  )
}

const Fixture = memo(function Fixture({ mi, mine }: { mi: number; mine: number }) {
  const t = useTheme()
  const d = getData()
  const played = useApp((s) => s.league!.played)
  const inSeason = useApp((s) => s.league!.phase === 'season')
  const m = d.matches[mi]
  const done = mi < played
  const next = mi === played && inSeason
  return (
    <Row
      onPress={done ? () => nav.match(mi) : next ? () => nav.live(mi) : undefined}
      style={next ? { backgroundColor: alpha(t.c.live, 0.06) } : undefined}
    >
      <View style={{ gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt tone="dim" size={12} style={{ flex: 1 }}>{m.raw.num ? `Match ${m.raw.num} · ` : ''}{m.raw.time} IST</Txt>
          {done ? <Chip label="FINAL" /> : next ? <Chip label="UP NEXT" tone="accent" /> : null}
        </View>
        {m.teams.map((code) => {
          const inn = m.totals.find((x) => x.team === code)
          const won = done && m.raw.winner === code
          return (
            <View key={code} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TeamTag code={code} />
              <Txt size={15} weight={won ? 700 : 500} tone={done && !won ? 'muted' : 'text'} numberOfLines={1} style={{ flex: 1 }}>
                {d.teams[code].name}
              </Txt>
              {done && inn && (
                <Txt num weight={700} size={15} tone={won ? 'text' : 'muted'}>
                  {inn.runs}/{inn.wkts} <Txt num size={12} tone="dim">({oversStr(inn.balls)})</Txt>
                </Txt>
              )}
              {done && <Icon name="arrowtriangle.left.fill" size={8} color={won ? t.c.accent : 'transparent'} />}
            </View>
          )
        })}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Txt tone="muted" size={12.5} numberOfLines={2}>{done ? m.raw.result : m.raw.venue}</Txt>
            {mine > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Icon name="person.2.fill" size={11} color={t.c.accent} />
                <Txt tone="accent" size={12.5} weight={600}>
                  {mine} of your players {done ? 'played' : 'in these squads'}
                </Txt>
              </View>
            )}
          </View>
          {done && <Button title="Replay" icon="play.fill" size="small" onPress={() => nav.live(mi)} accessibilityLabel="Replay ball by ball" />}
          {next && <Button title="Watch live" icon="play.fill" kind="live" size="small" onPress={() => nav.live(mi)} />}
        </View>
      </View>
    </Row>
  )
})
