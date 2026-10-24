import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import { mount } from 'svelte'
import { createBrowserStorage } from '../app/persistence/browser.ts'
import { createMemoryStorage } from '../app/persistence/memory.ts'
import { createAppStore } from '../app/store/app-store.ts'
import App from './shell/App.svelte'
import './shell/global.css'
import { applyTheme, readTheme } from './shell/theme.ts'
import { localToday } from './today.ts'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemen #root tidak ditemukan di index.html')
}

applyTheme(readTheme())

const store = createAppStore({
  // Without IndexedDB (some private windows) projects last only for this visit.
  storage: typeof indexedDB === 'undefined' ? createMemoryStorage() : createBrowserStorage(),
  today: localToday,
  newId: () => crypto.randomUUID(),
})

mount(App, { target: rootElement, props: { store, today: localToday } })
void store.getState().start()
