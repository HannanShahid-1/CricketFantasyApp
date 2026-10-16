import { memo, useMemo, useState, type ReactNode } from 'react'
import { LayoutAnimation, Pressable, View } from 'react-native'
import type { Player } from '@shared/engine/data'
import { fantasyAdvice, type FantasyAdvice } from '@shared/engine/fantasyAdvice'
import type { League } from '@shared/engine/league'
import { playerReports, type PlayerReport } from '@shared/engine/playerInsights'
import { scoutingProfile } from '@shared/engine/playerProfile'
import { getData } from '@shared/store'
import { fmtDate } from '@shared/ui/format'
import { nav } from '@/nav'
import { useStyles, useTheme, type Theme } from '@/theme/theme'
import { Chip, type ChipTone, haptic, Icon, Row, RowIcon, Section, Txt } from '@/ui'
import { InfoButton } from './InfoButton'

// The player card's fantasy outlook, with his match previews and recaps folded away under Player updates.

const REC_TONE: Record<FantasyAdvice['recommendation'], ChipTone> = {
  'Strong start': 'accent',
  'Start consideration': 'ok',
  'Matchup-dependent': 'sky',
  'Bench / watchlist': 'neutral',
  'Wait for XI': 'gold',
  Unproven: 'neutral',
}

const USAGE_NOTE =
  "Usage comes from the deliveries he faced and bowled, not an official position: the over of his first ball faced doesn't " +
  'fix his exact batting order, and bowling phases mean overs 1–6 and 17–20. Nothing about upcoming XIs, injuries or ' +
  'selection is assumed.'

export function Outlook({ p, league, played }: { p: Player; league: League | null; played: number }) {
  const t = useTheme()
  const s = useStyles(styles)
  const d = getData()
  const size = league?.teams.length ?? 8
  const { profile, advice, reports } = useMemo(
    () => ({ profile: scoutingProfile(d, p, played), advice: fantasyAdvice(d, p, played, size), reports: playerReports(d, p, played, size) }),
    [d, p, played, size],
  )
  const identity = profile.identity.charAt(0).toUpperCase() + profile.identity.slice(1)
  return (
    <>
      <Section
        title="Fantasy outlook"
        action={<InfoButton title="About these opinions" message={advice.explanation} />}
      >
        <View style={s.outlook}>
          <View style={s.tags}>
            <Chip label={advice.recommendation} tone={REC_TONE[advice.recommendation]} />
            {advice.tier && <Chip label={advice.tier} />}
          </View>
          <View style={{ gap: 2 }}>
            <Txt display weight={700} size={17}>{identity}</Txt>
          </View>
          <Txt size={15} style={{ lineHeight: 21 }}>{advice.opinion}</Txt>
        </View>
        <Disclosure title="What this is based on">
          {(profile.evidence.length ? profile.evidence : ['No earlier appearances on record.']).map((fact) => (
            <View key={fact} style={s.bullet}>
              <View style={[s.dot, { backgroundColor: t.c.dim }]} />
              <Txt size={13.5} tone="muted" style={{ flex: 1, lineHeight: 19 }}>{fact}</Txt>
            </View>
          ))}
          <Txt size={12} tone="dim" style={{ lineHeight: 16, marginTop: 4 }}>{USAGE_NOTE}</Txt>
        </Disclosure>
      </Section>
      <PlayerUpdates p={p} reports={reports} />
    </>
  )
}

/** His match previews and recaps, folded away under one row until you open it. */
function PlayerUpdates({ p, reports }: { p: Player; reports: PlayerReport[] }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const n = reports.length
  return (
    <Section>
      <Row
        left={<RowIcon name="newspaper" color={t.c.accent} />}
        title="Player updates"
        subtitle={n ? `${n} match ${n === 1 ? 'preview or recap' : 'previews and recaps'}` : "He isn't in an IPL squad this season."}
        right={n ? <Icon name={open ? 'chevron.up' : 'chevron.down'} size={12} color={t.c.dim} weight="semibold" /> : undefined}
        onPress={n ? () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          haptic.select()
          setOpen((o) => !o)
        } : undefined}
      />
      {open && reports.map((r) => <ReportRow key={r.key} r={r} name={p.fullName} />)}
    </Section>
  )
}

/** A row that expands to show more (inside a Section). */
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  return (
    <View>
      <Row
        title={<Txt size={15} weight={500} tone="accent">{title}</Txt>}
        right={<Icon name={open ? 'chevron.up' : 'chevron.down'} size={12} color={t.c.dim} weight="semibold" />}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          haptic.select()
          setOpen((o) => !o)
        }}
      />
      {open && <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>{children}</View>}
    </View>
  )
}

/** A preview of his next match or a recap of a recent one. Previews skip the fantasy take: it's the outlook above. */
const ReportRow = memo(function ReportRow({ r, name }: { r: PlayerReport; name: string }) {
  const t = useTheme()
  const s = useStyles(styles)
  const [open, setOpen] = useState(false)
  const preview = r.kind === 'Preview'
  const prefix = `${name} · `
  const headline = r.title.startsWith(prefix) ? r.title.slice(prefix.length) : r.title
  return (
    <View style={s.report}>
      <View style={s.inline}>
        <Txt up size={11} weight={700} tone={preview ? 'accent' : 'muted'}>{r.kind}</Txt>
        <Txt size={12} tone="dim">· {fmtDate(r.date)}</Txt>
      </View>
      <Txt display weight={700} size={16.5} style={{ lineHeight: 21 }}>{headline}</Txt>
      <Txt size={14} tone="muted" style={{ lineHeight: 20 }}>{r.summary}</Txt>
      {!preview && (
        <>
          <View style={s.reportActions}>
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                haptic.select()
                setOpen((o) => !o)
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [s.inline, pressed && { opacity: 0.5 }]}
            >
              <Txt size={14} weight={600} tone="accent">Fantasy take</Txt>
              <Icon name={open ? 'chevron.up' : 'chevron.down'} size={11} color={t.c.accent} weight="semibold" />
            </Pressable>
            <Pressable onPress={() => nav.match(r.mi)} hitSlop={8} accessibilityRole="link" style={({ pressed }) => [s.inline, pressed && { opacity: 0.5 }]}>
              <Txt size={14} weight={600} tone="accent">Scorecard</Txt>
              <Icon name="chevron.right" size={11} color={t.c.accent} weight="semibold" />
            </Pressable>
          </View>
          {open && <Txt size={14} style={s.take}>{r.analysis}</Txt>}
        </>
      )}
    </View>
  )
})

const styles = (t: Theme) => ({
  outlook: { gap: 12, padding: 16 },
  tags: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  bullet: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 9 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 8 },
  report: { gap: 6, paddingHorizontal: 16, paddingVertical: 14 },
  reportActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 20, marginTop: 4 },
  take: { lineHeight: 20, marginTop: 4, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: t.c.accent },
  inline: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
})
