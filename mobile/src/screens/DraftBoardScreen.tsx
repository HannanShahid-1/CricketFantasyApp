import { memo, useMemo, useState } from 'react'
import { SectionList, View } from 'react-native'
import type { Pick } from '@shared/engine/league'
import { getData, ME, useApp } from '@shared/store'
import { alpha, useStyles, useTheme, type Theme } from '@/theme/theme'
import { EmptyState, GroupCell, GroupHeader, PlayerLine, PlayerLink, roleColor, Segmented, Txt } from '@/ui'

// The draft board. The web's teams × rounds grid doesn't fit a phone, so it reads as a list instead: by round (the
// board row by row, in pick order) or by team (each column: that manager's draft). Role colour on each pick's edge;
// your picks are tinted. ~120–150 rows, so a virtualised SectionList.

type Mode = 'round' | 'team'
const MODES: { key: Mode; label: string }[] = [{ key: 'round', label: 'By round' }, { key: 'team', label: 'By team' }]

/** separators start under the player's name: padding + pick number + gap + avatar + gap */
const INSET = 16 + 40 + 10 + 34 + 12

export function DraftBoardScreen() {
  const t = useTheme()
  const draft = useApp((s) => s.league!.draft)
  const teams = useApp((s) => s.league!.teams)
  const [mode, setMode] = useState<Mode>('round')

  const sections = useMemo(() => {
    const picks = [...draft.picks].sort((a, b) => a.overall - b.overall)
    if (mode === 'round') {
      return Array.from({ length: draft.rounds }, (_, r) => {
        const data = picks.filter((p) => p.round === r + 1)
        const range = data.length ? `Picks ${data[0].overall}–${data[data.length - 1].overall}` : undefined
        return { key: `r${r + 1}`, title: `Round ${r + 1}`, detail: range, data }
      }).filter((x) => x.data.length)
    }
    // your draft first, then the others in draft order
    const order = [ME, ...draft.order.filter((id) => id !== ME)]
    return order.map((id) => ({
      key: `t${id}`,
      title: teams[id].isUser ? `${teams[id].name} (you)` : teams[id].name,
      detail: `Slot ${draft.order.indexOf(id) + 1}`,
      data: picks.filter((p) => p.teamId === id),
    }))
  }, [draft, teams, mode])

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
      sections={sections}
      keyExtractor={(p) => String(p.overall)}
      stickySectionHeadersEnabled={false}
      initialNumToRender={14}
      ListHeaderComponent={
        <View style={{ gap: 8 }}>
          <Segmented options={MODES} value={mode} onChange={setMode} />
          <Txt size={12.5} tone="dim" style={{ paddingHorizontal: 16 }}>
            Snake draft · {draft.rounds} rounds · your picks are highlighted
          </Txt>
        </View>
      }
      ListEmptyComponent={<EmptyState icon="square.grid.3x3" title="No picks yet" message="The board fills in as the draft goes." />}
      renderSectionHeader={({ section }) => <GroupHeader title={section.title} detail={section.detail} style={{ paddingTop: 24 }} />}
      renderItem={({ item, index, section }) => (
        <GroupCell first={index === 0} last={index === section.data.length - 1} inset={INSET}>
          <DraftPickRow pk={item} showTeam={mode === 'round'} />
        </GroupCell>
      )}
    />
  )
}

const DraftPickRow = memo(function DraftPickRow({ pk, showTeam }: { pk: Pick; showTeam: boolean }) {
  const t = useTheme()
  const s = useStyles(styles)
  const team = useApp((st) => st.league!.teams[pk.teamId])
  const p = getData().players[pk.player]
  const mine = team.isUser
  return (
    <PlayerLink pid={p.idx} style={mine ? [s.row, s.mine] : s.row}>
      <View style={[s.role, { backgroundColor: roleColor(t, p.role) }]} />
      <View style={s.no}>
        <Txt num weight={700} size={13.5} tone={mine ? 'accent' : 'text'}>{pk.round}.{String(pk.pick).padStart(2, '0')}</Txt>
        <Txt num size={10.5} tone="dim">#{pk.overall}</Txt>
      </View>
      <PlayerLine
        p={p}
        size={34}
        sub={showTeam ? (
          <Txt size={12} numberOfLines={1} tone={mine ? 'accent' : 'dim'} weight={mine ? 600 : 400} style={{ flexShrink: 1 }}>
            {mine ? 'You' : team.name}
          </Txt>
        ) : undefined}
      />
    </PlayerLink>
  )
})

const styles = (t: Theme) => ({
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 58, paddingLeft: 16, paddingRight: 16, paddingVertical: 8 },
  mine: { backgroundColor: alpha(t.c.accent, 0.1) },
  role: { position: 'absolute' as const, left: 0, top: 10, bottom: 10, width: 3, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  no: { width: 40, alignItems: 'flex-start' as const },
})
