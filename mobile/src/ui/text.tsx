import { Text, type TextProps, type TextStyle } from 'react-native'
import { useTheme, type Theme } from '@/theme/theme'

export type Tone = 'text' | 'muted' | 'dim' | 'hi' | 'accent' | 'gold' | 'sky' | 'win' | 'loss' | 'live'
export type Weight = 400 | 500 | 600 | 700 | 800

const toneColor = (t: Theme, tone: Tone) => (tone === 'live' ? t.c.live2 : t.c[tone])

/**
 * Themed text. Body text is Inter; `display` uses the theme's display face (titles, names), `num` its number face
 * (scores, stats, with tabular figures); `up` is a small-caps style label.
 */
export function Txt({ tone = 'text', size = 15, weight = 400, display, num, up, style, ...rest }: TextProps & {
  tone?: Tone; size?: number; weight?: Weight; display?: boolean; num?: boolean; up?: boolean
}) {
  const t = useTheme()
  const font = num ? t.font.num : display ? t.font.display : t.font.body
  const s: TextStyle = {
    color: toneColor(t, tone),
    fontSize: size,
    fontFamily: font(weight),
    ...(num && { fontVariant: ['tabular-nums'] }),
    ...(up && { textTransform: 'uppercase', letterSpacing: size * 0.08 }),
  }
  return <Text {...rest} style={[s, style]} />
}
