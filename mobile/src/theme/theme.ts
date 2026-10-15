import AsyncStorage from '@react-native-async-storage/async-storage'
import { Appearance, StyleSheet } from 'react-native'
import { create } from 'zustand'
import { DEFAULT_THEME, LIGHT_TOKENS, THEME_ORDER, THEME_TOKENS } from '@/generated/themes'

// The web themes (app/src/themes/*.css) are the source of truth; scripts/sync-shared.mjs turns them into
// THEME_TOKENS (and LIGHT_TOKENS for themes with a light version). This file maps those tokens onto React Native:
// colours, radii, font families and the theme's signature shapes.

export type ThemeId = keyof typeof THEME_TOKENS
type Tokens = { [K in keyof (typeof THEME_TOKENS)[ThemeId]]: string }

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

/** Font files (loaded in the root layout); the web's CSS font stacks map onto these by family + weight. */
const FONT_FILES = {
  inter: { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold', 800: 'Inter_800ExtraBold' },
  chakra: { 500: 'ChakraPetch_500Medium', 600: 'ChakraPetch_600SemiBold', 700: 'ChakraPetch_700Bold' },
  bricolage: { 500: 'BricolageGrotesque_500Medium', 600: 'BricolageGrotesque_600SemiBold', 700: 'BricolageGrotesque_700Bold' },
} as const

type Weight = 400 | 500 | 600 | 700 | 800

function family(stack: string): (w: Weight) => string {
  const files: Partial<Record<Weight, string>> =
    stack.includes('Chakra Petch') ? FONT_FILES.chakra : stack.includes('Bricolage Grotesque') ? FONT_FILES.bricolage : FONT_FILES.inter
  const weights = Object.keys(files).map(Number) as Weight[]
  return (w) => files[weights.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best))]!
}

// ---------- theme object ----------

const pct = (v: string) => parseFloat(v) / 100
const px = (v: string) => parseFloat(v)

function build(id: ThemeId, t: Tokens) {
  const c = {
    bg: t.bg, panel: t.panel, panel2: t.panel2, panel3: t.panel3, feature: t.feature, tint: t.tint, shade: t.shade,
    line: t.line, line2: t.line2, scrim: t.scrim,
    text: t.text, muted: t.muted, dim: t.dim, hi: t.hi, ink: t.ink, teamInk: t.teamInk,
    accent: t.accent, accentInk: t.accentInk, live: t.live, live2: t.live2, liveInk: t.liveInk,
    gold: t.gold, sky: t.sky, win: t.win, loss: t.loss, seam: t.seam,
    wk: t.wk, bat: t.bat, bowl: t.bowl, flex: t.flex, ar: t.ar,
  }
  return {
    id,
    /** one per look: a theme with a light version has two */
    key: `${id}-${t.colorScheme}`,
    name: THEME_ORDER.find((x) => x.id === id)!.name,
    dark: t.colorScheme !== 'light',
    /** Stitch's signature: seams and stitched meters (the `Seam` and `Meter` components) */
    stitched: t.motif === 'stitch',
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

/** Each theme's look; `light` only for themes with a light version (their base look is then the dark one). */
const THEMES = Object.fromEntries(THEME_ORDER.map((x) => {
  const light = (LIGHT_TOKENS as Partial<Record<ThemeId, Tokens>>)[x.id]
  return [x.id, { base: build(x.id, THEME_TOKENS[x.id]), light: light && build(x.id, light) }]
})) as Record<ThemeId, { base: Theme; light?: Theme }>

export const hasLightMode = (id: ThemeId) => THEMES[id].light !== undefined
/** A theme's looks: the base one, then its light version if it has one (for previews). */
export const themeLooks = (id: ThemeId): Theme[] => [THEMES[id].base, ...(THEMES[id].light ? [THEMES[id].light] : [])]

// ---------- current theme (remembered on the phone) ----------

/** For a theme with a light version: follow the phone's light/dark setting, or always use one. */
export type ColorMode = 'system' | 'light' | 'dark'

interface ThemeState {
  id: ThemeId
  mode: ColorMode
  /** the phone's own light/dark setting (only read while following it) */
  os: 'light' | 'dark'
  set: (id: ThemeId) => void
  setMode: (mode: ColorMode) => void
}

const KEY = 'seam-theme'
const MODE_KEY = 'seam-color-mode'
const isTheme = (v: unknown): v is ThemeId => typeof v === 'string' && v in THEMES
const isMode = (v: unknown): v is ColorMode => v === 'system' || v === 'light' || v === 'dark'
const osScheme = () => (Appearance.getColorScheme() === 'light' ? 'light' : 'dark')

const follows = (s: ThemeState) => hasLightMode(s.id) && s.mode === 'system'
const current = (s: ThemeState): Theme => {
  const { base, light } = THEMES[s.id]
  return light && (s.mode === 'light' || (follows(s) && s.os === 'light')) ? light : base
}

export const useThemeStore = create<ThemeState>((set) => ({
  id: DEFAULT_THEME as ThemeId,
  mode: 'system',
  os: osScheme(),
  set: (id) => {
    set({ id })
    AsyncStorage.setItem(KEY, id).catch(() => {})
  },
  setMode: (mode) => {
    set({ mode })
    AsyncStorage.setItem(MODE_KEY, mode).catch(() => {})
  },
}))

// The native tab bar (Liquid Glass), headers, sheets, alerts and keyboard follow iOS's light/dark mode, so make it
// match the theme; while following the phone, leave iOS's own setting in charge.
const applyNative = (s: ThemeState) => Appearance.setColorScheme(follows(s) ? 'unspecified' : current(s).dark ? 'dark' : 'light')
applyNative(useThemeStore.getState())
useThemeStore.subscribe((s, prev) => {
  if (s.id !== prev.id || s.mode !== prev.mode) applyNative(s)
})
// reports our own override too, but `os` is only read while there is none
Appearance.addChangeListener(({ colorScheme }) => useThemeStore.setState({ os: colorScheme === 'light' ? 'light' : 'dark' }))

export async function loadThemeChoice() {
  const [id, mode] = await Promise.all([KEY, MODE_KEY].map((k) => AsyncStorage.getItem(k).catch(() => null)))
  useThemeStore.setState({ ...(isTheme(id) && { id }), ...(isMode(mode) && { mode }) })
}

export const useTheme = (): Theme => useThemeStore(current)

/** Styles that depend on the theme, built once per look: `const s = useStyles(makeStyles)`. */
const cache = new WeakMap<object, Map<string, unknown>>()
export function useStyles<T extends StyleSheet.NamedStyles<T>>(make: (t: Theme) => T): T {
  const t = useTheme()
  let byTheme = cache.get(make)
  if (!byTheme) cache.set(make, (byTheme = new Map()))
  if (!byTheme.has(t.key)) byTheme.set(t.key, StyleSheet.create(make(t)))
  return byTheme.get(t.key) as T
}
