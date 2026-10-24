import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import { mount } from 'svelte'
import { createBrowserStorage } from '../app/persistence/browser.ts'
import { createMemoryStorage } from '../app/persistence/memory.ts'
import { createAppStore, type WorkspaceMemory } from '../app/store/app-store.ts'
import App from './shell/App.svelte'
import './shell/global.css'
import { applyTheme, readTheme } from './shell/theme.ts'
import { localToday } from './today.ts'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemen #root tidak ditemukan di index.html')
}

applyTheme(readTheme())

const WORKSPACE_KEY = 'rentang.workspace'

// Open tabs survive a reload (per browser tab); project data itself stays in IndexedDB.
const workspace: WorkspaceMemory = {
  read() {
    try {
      const raw: unknown = JSON.parse(sessionStorage.getItem(WORKSPACE_KEY) ?? 'null')
      if (typeof raw !== 'object' || raw === null || !('tabs' in raw)) return null
      const { tabs, active } = raw as { tabs: unknown; active?: unknown }
      if (!Array.isArray(tabs) || !tabs.every((id) => typeof id === 'string')) return null
      return { tabs, active: typeof active === 'string' ? active : null }
    } catch {
      return null
    }
  },
  write(value) {
    try {
      sessionStorage.setItem(WORKSPACE_KEY, JSON.stringify(value))
    } catch {
      // Remembering tabs is a convenience; ignore blocked storage.
    }
  },
}

const store = createAppStore({
  workspace,
  // Without IndexedDB (some private windows) projects last only for this visit.
  storage: typeof indexedDB === 'undefined' ? createMemoryStorage() : createBrowserStorage(),
  today: localToday,
  newId: () => crypto.randomUUID(),
})

mount(App, { target: rootElement, props: { store, today: localToday } })
void store.getState().start()
