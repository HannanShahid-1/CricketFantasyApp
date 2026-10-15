import { useSyncExternalStore } from 'react'
import './floodlit.css'
import './dusk.css'
import './scorebook.css'
import './stitch.css'

/**
 * Themes are token sets in ./<id>.css, scoped to <html data-theme="id">. To add one: copy floodlit.css (it lists
 * every token), change the id and values, import it above and list it here. A theme can also restyle itself for
 * light mode in a `@media (prefers-color-scheme: light)` block (see stitch.css); the iPhone app reads both.
 */
export const THEMES = [
  { id: 'stitch', name: 'Stitch' },
  { id: 'dusk', name: 'Dusk' },
  { id: 'scorebook', name: 'Scorebook' },
  { id: 'floodlit', name: 'Floodlit' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/**
 * Used until the viewer picks one. Set to 'floodlit' to bring back the original look (also update data-theme in
 * index.html, which only paints the first frame).
 */
export const DEFAULT_THEME: ThemeId = 'stitch'

const KEY = 'seam-theme'
const listeners = new Set<() => void>()
const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v)

export const getTheme = (): ThemeId => {
  const v = document.documentElement.dataset.theme
  return isTheme(v) ? v : DEFAULT_THEME
}

function apply(id: ThemeId) {
  document.documentElement.dataset.theme = id
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  listeners.forEach((l) => l())
}

/** Switch and remember the choice (per browser). */
export function setTheme(id: ThemeId) {
  apply(id)
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

export function cycleTheme() {
  const i = THEMES.findIndex((t) => t.id === getTheme())
  setTheme(THEMES[(i + 1) % THEMES.length].id)
}

/**
 * Call once before rendering. `?theme=floodlit` previews a theme without saving it, so two tabs can show
 * two themes side by side. Option/Alt+T cycles themes anywhere in the app.
 */
export function initTheme() {
  const fromUrl = new URLSearchParams(location.search).get('theme')
  let saved: string | null = null
  try {
    saved = localStorage.getItem(KEY)
  } catch {
    // storage blocked
  }
  apply(isTheme(fromUrl) ? fromUrl : isTheme(saved) ? saved : DEFAULT_THEME)
  window.addEventListener('keydown', (e) => {
    if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyT') {
      e.preventDefault()
      cycleTheme()
    }
  })
}

export function useTheme(): ThemeId {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, getTheme)
}
