/**
 * Application state: which screen is open, the open project and its computed schedule,
 * and the import waiting for confirmation. Framework-free (zustand/vanilla), so it runs
 * and is tested without Svelte.
 */
import { createStore, type StoreApi } from 'zustand/vanilla'
import { analyzeCriticalPath, type CriticalPath } from '../../core/critical-path.ts'
import type { IsoDate } from '../../core/dates.ts'
import { importGan, type GanImportError } from '../../core/gan/map.ts'
import type { ImportReport } from '../../core/gan/report.ts'
import type { CycleError } from '../../core/graph.ts'
import { loadProjectFile } from '../../core/migrations.ts'
import { CURRENT_SCHEMA_VERSION, type Project } from '../../core/model.ts'
import type { Result } from '../../core/result.ts'
import { rollUpProgress, summarizeProject } from '../../core/summary.ts'
import { createDemoProject } from '../demo/coffee-shop-demo.ts'
import type {
  ProjectOrigin,
  StorageLoadError,
  StorageProvider,
  StoredProjectSummary,
} from '../persistence/storage-provider.ts'

export type Screen =
  { readonly kind: 'loading' } | { readonly kind: 'start' } | { readonly kind: 'project' }

export type OpenProject = {
  readonly project: Project
  readonly origin: ProjectOrigin
  readonly analysis: Result<CriticalPath, CycleError>
  readonly progress: ReadonlyMap<string, number>
}

export type PendingImport = {
  readonly fileName: string
  readonly project: Project
  readonly report: ImportReport
}

export type OpenFileError =
  | GanImportError
  | StorageLoadError
  | { readonly type: 'unsupported-file' }
  | { readonly type: 'invalid-json' }

export type Notice =
  | { readonly kind: 'open-failed'; readonly fileName: string; readonly error: OpenFileError }
  | { readonly kind: 'storage-failed' }

export type AppState = {
  readonly screen: Screen
  readonly projects: readonly StoredProjectSummary[]
  readonly current: OpenProject | null
  readonly pendingImport: PendingImport | null
  readonly notice: Notice | null
}

export type AppActions = {
  /** Lists stored projects and reopens the most recent one, or shows the start screen. */
  start(): Promise<void>
  openFile(file: { readonly name: string; readonly text: string }): Promise<void>
  confirmImport(): Promise<void>
  cancelImport(): void
  openProject(id: string): Promise<void>
  openDemo(): Promise<void>
  showStart(): void
  dismissNotice(): void
}

export type AppStore = StoreApi<AppState & AppActions>

export type AppDependencies = {
  readonly storage: StorageProvider
  readonly today: () => IsoDate
  readonly newId: () => string
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function stemOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? name : name.slice(0, dot)
}

export function createAppStore({ storage, today, newId }: AppDependencies): AppStore {
  return createStore<AppState & AppActions>()((set, get) => {
    const open = (project: Project, origin: ProjectOrigin): OpenProject => ({
      project,
      origin,
      analysis: analyzeCriticalPath(project),
      progress: rollUpProgress(project),
    })

    /** Saves, refreshes the list and shows the project. */
    const saveAndShow = async (project: Project, origin: ProjectOrigin): Promise<void> => {
      const opened = open(project, origin)
      const summary = opened.analysis.ok
        ? summarizeProject(project, opened.analysis.value.schedule, today())
        : { progress: 0, lateCount: 0 }
      try {
        await storage.save(
          { schemaVersion: CURRENT_SCHEMA_VERSION, project },
          { origin, progress: summary.progress, lateCount: summary.lateCount },
        )
        set({ current: opened, screen: { kind: 'project' }, projects: await storage.list() })
      } catch {
        set({ current: opened, screen: { kind: 'project' }, notice: { kind: 'storage-failed' } })
      }
    }

    const fail = (fileName: string, error: OpenFileError): void => {
      set({ notice: { kind: 'open-failed', fileName, error } })
    }

    return {
      screen: { kind: 'loading' },
      projects: [],
      current: null,
      pendingImport: null,
      notice: null,

      async start() {
        let projects: StoredProjectSummary[]
        try {
          projects = await storage.list()
        } catch {
          set({ screen: { kind: 'start' }, notice: { kind: 'storage-failed' } })
          return
        }
        set({ projects })
        const latest = projects[0]
        if (latest) await get().openProject(latest.id)
        else set({ screen: { kind: 'start' } })
      },

      async openFile({ name, text }) {
        const extension = extensionOf(name)
        if (extension === 'gan') {
          const result = importGan(text, { projectId: newId() })
          if (!result.ok) {
            fail(name, result.error)
            return
          }
          const { project, report } = result.value
          const named = project.name.trim() === '' ? { ...project, name: stemOf(name) } : project
          set({ pendingImport: { fileName: name, project: named, report }, notice: null })
        } else if (extension === 'rentang') {
          let json: unknown
          try {
            json = JSON.parse(text)
          } catch {
            fail(name, { type: 'invalid-json' })
            return
          }
          const loaded = loadProjectFile(json)
          if (!loaded.ok) {
            fail(name, loaded.error)
            return
          }
          set({ notice: null })
          await saveAndShow(loaded.value.project, 'rentang')
        } else {
          fail(name, { type: 'unsupported-file' })
        }
      },

      async confirmImport() {
        const pending = get().pendingImport
        if (!pending) return
        set({ pendingImport: null })
        await saveAndShow(pending.project, 'gan')
      },

      cancelImport() {
        set({ pendingImport: null })
      },

      async openProject(id) {
        const loaded = await storage.load(id).catch(() => null)
        if (!loaded) {
          set({ screen: { kind: 'start' }, notice: { kind: 'storage-failed' } })
          return
        }
        if (!loaded.ok) {
          set({
            screen: { kind: 'start' },
            notice: { kind: 'open-failed', fileName: id, error: loaded.error },
          })
          return
        }
        const origin = get().projects.find((summary) => summary.id === id)?.origin ?? 'rentang'
        set({
          current: open(loaded.value.project, origin),
          screen: { kind: 'project' },
          notice: null,
        })
      },

      async openDemo() {
        set({ notice: null })
        await saveAndShow(createDemoProject(today()), 'demo')
      },

      showStart() {
        set({ screen: { kind: 'start' } })
      },

      dismissNotice() {
        set({ notice: null })
      },
    }
  })
}
