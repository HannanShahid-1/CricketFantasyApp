import AsyncStorage from '@react-native-async-storage/async-storage'
import { StyleSheet } from 'react-native'
import { create } from 'zustand'
import { DEFAULT_THEME, THEME_ORDER, THEME_TOKENS } from '@/generated/themes'

// The web themes (app/src/themes/*.css) are the source of truth; scripts/sync-shared.mjs turns them into
// THEME_TOKENS. This file maps those tokens onto React Native: colours, radii and font families.

export type ThemeId = keyof typeof THEME_TOKENS

// ---------- colour helpers (React Native has no color-mix) ----------

type RGBA = [number, number, number, number]

function parse(c: string): RGBA {
  const s = c.trim()
  if (s.startsWith('#')) {
    let h = s.slice(1)
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('')
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim())
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  if (s === 'white') return [255, 255, 255, 1]
  return [0, 0, 0, 1]
}

const css = ([r, g, b, a]: RGBA) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`

/** `color-mix(in srgb, c pct, transparent)`: c at pct (0–1) of its opacity */
export const alpha = (c: string, pct: number): string => {
  const [r, g, b, a] = parse(c)
  return css([r, g, b, a * pct])
}

/** `color-mix(in srgb, a pct, b)` */
export const mix = (a: string, b: string, pct: number): string => {
  const x = parse(a)
  const y = parse(b)
  return css(x.map((v, i) => v * pct + y[i] * (1 - pct)) as RGBA)
}

// ---------- fonts ----------

/** Font files loaded in the root layout; the web's CSS font stacks map onto these by family + weight. */
export const FONT_FILES = {
  inter: { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold', 800: 'Inter_800ExtraBold' },
  chakra: { 500: 'ChakraPetch_500Medium', 600: 'ChakraPetch_600SemiBold', 700: 'ChakraPetch_700Bold' },
} as const

type Weight = 400 | 500 | 600 | 700 | 800

function family(stack: string): (w: Weight) => string {
  const files: Partial<Record<Weight, string>> = stack.includes('Chakra Petch') ? FONT_FILES.chakra : FONT_FILES.inter
  const weights = Object.keys(files).map(Number) as Weight[]
  return (w) => files[weights.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best))]!
}

// ---------- theme object ----------

const pct = (v: string) => parseFloat(v) / 100
const px = (v: string) => parseFloat(v)

function build(id: ThemeId) {
  const t = THEME_TOKENS[id]
  const c = {
    bg: t.bg, panel: t.panel, panel2: t.panel2, panel3: t.panel3, tint: t.tint, shade: t.shade,
    line: t.line, line2: t.line2, scrim: t.scrim,
    text: t.text, muted: t.muted, dim: t.dim, hi: t.hi, ink: t.ink, teamInk: t.teamInk,
    accent: t.accent, accentInk: t.accentInk, live: t.live, live2: t.live2, liveInk: t.liveInk,
    gold: t.gold, sky: t.sky, win: t.win, loss: t.loss,
    wk: t.wk, bat: t.bat, bowl: t.bowl, flex: t.flex, ar: t.ar,
  }
  return {
    id,
    name: THEME_ORDER.find((x) => x.id === id)!.name,
    dark: t.colorScheme !== 'light',
    c,
    teamSat: pct(t.teamSat),
    badgeOutline: pct(t.badgeOutline),
    r: { sm: px(t.rSm), md: px(t.r), lg: px(t.rLg) },
    font: { body: family(t.font), display: family(t.display), num: family(t.num) },
    /** a team's own colour, muted by the theme the same way the web does */
    team: (color: string) => mix(color, c.panel, pct(t.teamSat)),
  }
}

export type Theme = ReturnType<typeof build>
const THEMES = Object.fromEntries(THEME_ORDER.map((x) => [x.id, build(x.id)])) as Record<ThemeId, Theme>

// ---------- current theme (remembered on the phone) ----------

const KEY = 'seam-theme'
const isTheme = (v: unknown): v is ThemeId => typeof v === 'string' && v in THEMES

export const useThemeStore = create<{ id: ThemeId; set: (id: ThemeId) => void; cycle: () => void }>((set, get) => ({
  id: DEFAULT_THEME as ThemeId,
  set: (id) => {
    set({ id })
    AsyncStorage.setItem(KEY, id).catch(() => {})
  },
  cycle: () => {
    const i = THEME_ORDER.findIndex((x) => x.id === get().id)
    get().set(THEME_ORDER[(i + 1) % THEME_ORDER.length].id)
  },
}))

export async function loadThemeChoice() {
  const saved = await AsyncStorage.getItem(KEY).catch(() => null)
  if (isTheme(saved)) useThemeStore.setState({ id: saved })
}

export const useTheme = (): Theme => THEMES[useThemeStore((s) => s.id)]

/** Styles that depend on the theme, built once per theme: `const s = useStyles(makeStyles)`. */
const cache = new WeakMap<object, Map<ThemeId, unknown>>()
export function useStyles<T extends StyleSheet.NamedStyles<T>>(make: (t: Theme) => T): T {
  const t = useTheme()
  let byTheme = cache.get(make)
  if (!byTheme) cache.set(make, (byTheme = new Map()))
  if (!byTheme.has(t.id)) byTheme.set(t.id, StyleSheet.create(make(t)))
  return byTheme.get(t.id) as T
}
