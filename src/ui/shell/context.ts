import { getContext, setContext } from 'svelte'
import { readable, type Readable } from 'svelte/store'
import type { AppActions, AppState, AppStore } from '../../app/store/app-store.ts'
import type { IsoDate } from '../../core/dates.ts'
import { UiState } from './ui-state.svelte.ts'

type AppContext = {
  readonly store: AppStore
  /** The Zustand store as a Svelte store, so components can read it with `$app`. */
  readonly app: Readable<AppState & AppActions>
  readonly today: () => IsoDate
  readonly ui: UiState
}

const KEY = Symbol('rentang-app')

export function provideApp(store: AppStore, today: () => IsoDate): AppContext {
  const app = readable(store.getState(), (set) =>
    store.subscribe((state) => {
      set(state)
    }),
  )
  return setContext(KEY, { store, app, today, ui: new UiState() })
}

export function useApp(): AppContext {
  return getContext<AppContext>(KEY)
}
