/**
 * Application state: the project list, the open project tabs with their computed schedule
 * and undo history, the import waiting for confirmation, and save status. Framework-free
 * (zustand/vanilla), so it runs and is tested without Svelte.
 */
import { createStore, type StoreApi } from 'zustand/vanilla'
import { analyzeCriticalPath, type CriticalPath } from '../../core/critical-path.ts'
import type { IsoDate } from '../../core/dates.ts'
import { importGan, type GanImportError } from '../../core/gan/map.ts'
import type { ImportReport } from '../../core/gan/report.ts'
import type { CycleError } from '../../core/graph.ts'
import { loadProjectFile } from '../../core/migrations.ts'
import { CURRENT_SCHEMA_VERSION, projectSchema, type Area, type Project } from '../../core/model.ts'
import type { Result } from '../../core/result.ts'
import { rollUpProgress, summarizeProject } from '../../core/summary.ts'
import { createDemoProject } from '../demo/coffee-shop-demo.ts'
import { createProject, type Recipe } from '../edits/project-edits.ts'
import { EMPTY_HISTORY, record, redo, undo, type History, type Step } from '../history/history.ts'
import type {
  ProjectOrigin,
  StorageLoadError,
  StorageProvider,
  StoredProjectSummary,
} from '../persistence/storage-provider.ts'

export type ProjectSession = {
  readonly project: Project
  readonly origin: ProjectOrigin
  readonly fileName: string | null
  readonly analysis: Result<CriticalPath, CycleError>
  readonly progress: ReadonlyMap<string, number>
  readonly history: History
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
  | { readonly kind: 'edit-rejected'; readonly issues: readonly string[] }

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export type Toast = {
  /** Changes with every toast, so the same message shown twice still restarts its timer. */
  readonly id: number
  readonly message: string
  readonly action: 'undo' | 'redo' | null
}

export type AppState = {
  readonly ready: boolean
  readonly projects: readonly StoredProjectSummary[]
  readonly sessions: Readonly<Record<string, ProjectSession>>
  /** Open project ids, in tab order. */
  readonly tabs: readonly string[]
  /** The open project's id, or null while the project list shows. */
  readonly active: string | null
  readonly pendingImport: PendingImport | null
  readonly notice: Notice | null
  readonly saveState: SaveState
  readonly toast: Toast | null
}

export type EditOutcome = 'applied' | 'unchanged' | 'rejected'

export type AppActions = {
  start(): Promise<void>
  openFile(file: { readonly name: string; readonly text: string }): Promise<void>
  confirmImport(): Promise<void>
  cancelImport(): void
  openProject(id: string): Promise<void>
  openDemo(): Promise<void>
  createProject(name: string, area: Area): Promise<void>
  closeTab(id: string): void
  /** Removes a project from storage and closes its tab. */
  deleteProject(id: string): Promise<void>
  showList(): void
  /** Applies an edit to the active project, with undo, and saves it. */
  edit(label: string, recipe: Recipe): EditOutcome
  undo(): void
  redo(): void
  /** A fresh id for a new task, person, role or assignment. */
  createId(): string
  dismissNotice(): void
  dismissToast(): void
}

export type AppStore = StoreApi<AppState & AppActions>

export type AppDependencies = {
  readonly storage: StorageProvider
  readonly today: () => IsoDate
  readonly newId: () => string
  /** Remembers which projects are open across a page reload. Optional. */
  readonly workspace?: WorkspaceMemory
}

export type Workspace = { readonly tabs: readonly string[]; readonly active: string | null }

export type WorkspaceMemory = {
  read(): Workspace | null
  write(workspace: Workspace): void
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function stemOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? name : name.slice(0, dot)
}

function sessionOf(
  project: Project,
  origin: ProjectOrigin,
  fileName: string | null,
  history: History = EMPTY_HISTORY,
): ProjectSession {
  return {
    project,
    origin,
    fileName,
    analysis: analyzeCriticalPath(project),
    progress: rollUpProgress(project),
    history,
  }
}

export function createAppStore({ storage, today, newId, workspace }: AppDependencies): AppStore {
  let toastCounter = 0
  // Saves for one project run one after another, so an older save never lands last.
  const saving = new Map<string, Promise<void>>()

  // Until the remembered tabs are back, the workspace must not be overwritten with an empty one.
  let restoring = workspace !== undefined
  let remember = (): void => undefined

  const store = createStore<AppState & AppActions>()((set, get) => {
    remember = () => {
      if (restoring) return
      const { tabs, active } = get()
      workspace?.write({ tabs, active })
    }

    const toast = (message: string, action: Toast['action']): void => {
      set({ toast: { id: (toastCounter += 1), message, action } })
    }

    const persist = (session: ProjectSession): Promise<void> => {
      const { project, origin, fileName, analysis } = session
      const summary = analysis.ok
        ? summarizeProject(project, analysis.value.schedule, today())
        : null
      set({ saveState: 'saving' })
      const run = async (): Promise<void> => {
        try {
          await storage.save(
            { schemaVersion: CURRENT_SCHEMA_VERSION, project },
            {
              origin,
              fileName,
              progress: summary?.progress ?? 0,
              lateCount: summary?.lateCount ?? 0,
              nextMilestone: summary?.nextMilestone ?? null,
              isComplete: summary?.isComplete ?? false,
            },
          )
          set({ saveState: 'saved', projects: await storage.list() })
        } catch {
          set({ saveState: 'failed', notice: { kind: 'storage-failed' } })
        }
      }
      const next = (saving.get(project.id) ?? Promise.resolve()).then(run)
      saving.set(project.id, next)
      return next
    }

    const show = (session: ProjectSession): void => {
      const { id } = session.project
      const { tabs, sessions } = get()
      set({
        sessions: { ...sessions, [id]: session },
        tabs: tabs.includes(id) ? tabs : [...tabs, id],
        active: id,
      })
    }

    const saveAndShow = async (session: ProjectSession): Promise<void> => {
      show(session)
      await persist(session)
      await storage.markOpened(session.project.id).catch(() => undefined)
      set({ projects: await storage.list().catch(() => get().projects) })
    }

    const fail = (fileName: string, error: OpenFileError): void => {
      set({ notice: { kind: 'open-failed', fileName, error } })
    }

    const applyStep = (step: Step | null, message: string, action: Toast['action']): void => {
      const { active, sessions } = get()
      const session = active === null ? undefined : sessions[active]
      if (!step || !session || active === null) return
      const next = sessionOf(step.project, session.origin, session.fileName, step.history)
      set({ sessions: { ...sessions, [active]: next } })
      toast(message, action)
      void persist(next)
    }

    const stopRestoring = (): void => {
      restoring = false
      remember()
    }
    const restoreTab = async (id: string, activate = false): Promise<void> => {
      const loaded = await storage.load(id).catch(() => null)
      if (!loaded?.ok) return
      const summary = get().projects.find((candidate) => candidate.id === id)
      const session = sessionOf(
        loaded.value.project,
        summary?.origin ?? 'rentang',
        summary?.fileName ?? null,
      )
      const { tabs, sessions, active } = get()
      set({
        sessions: { ...sessions, [id]: session },
        tabs: tabs.includes(id) ? tabs : [...tabs, id],
        active: activate ? id : active,
      })
    }
    return {
      ready: false,
      projects: [],
      sessions: {},
      tabs: [],
      active: null,
      pendingImport: null,
      notice: null,
      saveState: 'idle',
      toast: null,

      async start() {
        try {
          set({ projects: await storage.list(), ready: true })
        } catch {
          set({ ready: true, notice: { kind: 'storage-failed' } })
          stopRestoring()
          return
        }
        const remembered = workspace?.read()
        if (!remembered) {
          stopRestoring()
          return
        }
        const known = new Set(get().projects.map((summary) => summary.id))
        const ids = remembered.tabs.filter((id) => known.has(id))
        for (const id of ids) {
          if (id !== remembered.active) await restoreTab(id)
        }
        if (remembered.active !== null && ids.includes(remembered.active)) {
          await restoreTab(remembered.active, true)
        }
        stopRestoring()
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
          await saveAndShow(sessionOf(loaded.value.project, 'rentang', name))
        } else {
          fail(name, { type: 'unsupported-file' })
        }
      },

      async confirmImport() {
        const pending = get().pendingImport
        if (!pending) return
        set({ pendingImport: null })
        await saveAndShow(sessionOf(pending.project, 'gan', pending.fileName))
      },

      cancelImport() {
        set({ pendingImport: null })
      },

      async openProject(id) {
        const open = get().sessions[id]
        if (open) {
          show(open)
        } else {
          const loaded = await storage.load(id).catch(() => null)
          if (!loaded) {
            set({ notice: { kind: 'storage-failed' } })
            return
          }
          if (!loaded.ok) {
            const name = get().projects.find((summary) => summary.id === id)?.name ?? id
            fail(name, loaded.error)
            return
          }
          const summary = get().projects.find((candidate) => candidate.id === id)
          show(
            sessionOf(
              loaded.value.project,
              summary?.origin ?? 'rentang',
              summary?.fileName ?? null,
            ),
          )
        }
        set({ notice: null })
        await storage.markOpened(id).catch(() => undefined)
        set({ projects: await storage.list().catch(() => get().projects) })
      },

      async openDemo() {
        set({ notice: null })
        await saveAndShow(sessionOf(createDemoProject(today()), 'demo', null))
      },

      async createProject(name, area) {
        set({ notice: null })
        await saveAndShow(sessionOf(createProject(newId(), name.trim(), area), 'new', null))
      },

      closeTab(id) {
        const { tabs, sessions, active } = get()
        const index = tabs.indexOf(id)
        if (index === -1) return
        const remaining = tabs.filter((tab) => tab !== id)
        const { [id]: _closed, ...rest } = sessions
        const neighbour = remaining[Math.min(index, remaining.length - 1)]
        set({
          tabs: remaining,
          sessions: rest,
          active: active === id ? (neighbour ?? null) : active,
        })
      },

      async deleteProject(id) {
        // Wait for a save still in flight, or it could bring the project back.
        await saving.get(id)
        try {
          await storage.remove(id)
        } catch {
          set({ notice: { kind: 'storage-failed' } })
          return
        }
        saving.delete(id)
        get().closeTab(id)
        set({ projects: await storage.list().catch(() => get().projects) })
        toast('Proyek dihapus', null)
      },

      showList() {
        set({ active: null })
      },

      edit(label, recipe) {
        const { active, sessions } = get()
        const session = active === null ? undefined : sessions[active]
        if (!session) return 'unchanged'
        const step = record(session.project, session.history, label, recipe)
        if (!step) return 'unchanged'
        const valid = projectSchema.safeParse(step.project)
        if (!valid.success) {
          set({
            notice: {
              kind: 'edit-rejected',
              issues: valid.error.issues.map((issue) => issue.message),
            },
          })
          return 'rejected'
        }
        applyStep(step, label, 'undo')
        return 'applied'
      },

      undo() {
        const { active, sessions } = get()
        const session = active === null ? undefined : sessions[active]
        if (!session) return
        const step = undo(session.project, session.history)
        if (step) applyStep(step, `Dibatalkan: ${step.entry.label}`, 'redo')
      },

      redo() {
        const { active, sessions } = get()
        const session = active === null ? undefined : sessions[active]
        if (!session) return
        const step = redo(session.project, session.history)
        if (step) applyStep(step, `Diulang: ${step.entry.label}`, 'undo')
      },

      createId: newId,

      dismissNotice() {
        set({ notice: null })
      },

      dismissToast() {
        set({ toast: null })
      },
    }
  })
  store.subscribe(() => {
    remember()
  })
  return store
}
