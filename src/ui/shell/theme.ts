/** Theme choice is a per-browser preference, so localStorage is the right place for it. */
import { prefersReducedMotion } from '../motion.ts'

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'rentang.theme'

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/** The theme actually showing: the stored choice, or the system's when there is none. */
export function effectiveTheme(choice: ThemeChoice = readTheme()): 'light' | 'dark' {
  if (choice !== 'system') return choice
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset['theme']
  else root.dataset['theme'] = choice
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Private windows may refuse storage; the theme still applies for this visit.
  }
}

/**
 * Switches theme. Where the browser supports view transitions, the new theme grows out of
 * `origin` as a circle; otherwise, or with reduced motion, it simply switches.
 */
export function switchTheme(choice: ThemeChoice, origin?: { x: number; y: number }): void {
  const root = document.documentElement
  const canAnimate =
    'startViewTransition' in document && typeof document.startViewTransition === 'function'
  if (!canAnimate || prefersReducedMotion() || !origin) {
    applyTheme(choice)
    return
  }
  const radius = Math.hypot(
    Math.max(origin.x, innerWidth - origin.x),
    Math.max(origin.y, innerHeight - origin.y),
  )
  root.style.setProperty('--reveal-x', `${String(origin.x)}px`)
  root.style.setProperty('--reveal-y', `${String(origin.y)}px`)
  root.style.setProperty('--reveal-r', `${String(radius)}px`)
  document.startViewTransition(() => {
    applyTheme(choice)
  })
}
