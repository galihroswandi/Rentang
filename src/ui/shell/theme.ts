/** Theme choice is a per-browser preference, so localStorage is the right place for it. */
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
