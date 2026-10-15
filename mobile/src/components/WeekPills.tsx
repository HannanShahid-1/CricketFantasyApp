import { ScrollView } from 'react-native'
import { currentWeek, LAST_WEEK, REG_WEEKS, type League } from '@shared/engine/league'
import { getData } from '@shared/store'
import { useTheme } from '@/theme/theme'
import { Pill, Txt } from '@/ui'

/** Gameweek picker (W1…W6, SEMIS, FINAL): ✓ on finished weeks, LIVE on the current one. Bleeds to the screen edges. */
export function WeekPills({ league, week, onChange }: { league: League; week: number; onChange: (w: number) => void }) {
  const t = useTheme()
  const cur = currentWeek(getData(), league)
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
      {Array.from({ length: LAST_WEEK }, (_, i) => i + 1).map((w) => {
        const isCur = w === cur && league.phase === 'season'
        const tag = league.results[w] ? '✓' : isCur ? 'LIVE' : null
        return (
          <Pill
            key={w}
            label={w <= REG_WEEKS ? `W${w}` : w === REG_WEEKS + 1 ? 'SEMIS' : 'FINAL'}
            on={w === week}
            accent={isCur}
            onPress={() => onChange(w)}
            badge={tag && <Txt size={9.5} weight={700} style={{ color: w === week ? t.c.ink : t.c.muted }}>{tag}</Txt>}
          />
        )
      })}
    </ScrollView>
  )
}
