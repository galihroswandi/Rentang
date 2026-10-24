import { getContext, setContext } from 'svelte'
import { readable, type Readable } from 'svelte/store'
import type { AppState, AppStore, AppActions } from '../../app/store/app-store.ts'
import type { IsoDate } from '../../core/dates.ts'

type AppContext = {
  readonly store: AppStore
  /** The Zustand store as a Svelte store, so components can read it with `$app`. */
  readonly app: Readable<AppState & AppActions>
  readonly today: () => IsoDate
}

const KEY = Symbol('rentang-app')

export function provideApp(store: AppStore, today: () => IsoDate): AppContext {
  const app = readable(store.getState(), (set) =>
    store.subscribe((state) => {
      set(state)
    }),
  )
  return setContext(KEY, { store, app, today })
}

export function useApp(): AppContext {
  return getContext<AppContext>(KEY)
}
