/**
 * Where projects live. Only the browser provider exists so far; the local-file provider
 * (File System Access API) follows behind the same interface.
 */
import type { IsoDate } from '../../core/dates.ts'
import type { LoadError } from '../../core/migrations.ts'
import type { Area, ProjectFile } from '../../core/model.ts'
import type { Result } from '../../core/result.ts'

/** How a project first reached Rentang. */
export type ProjectOrigin = 'demo' | 'gan' | 'rentang' | 'new'

/** Cached at save time so the project list needs no scheduling. */
export type StoredProjectSummary = {
  readonly id: string
  readonly name: string
  readonly area: Area
  readonly origin: ProjectOrigin
  /** The file the project came from, if any. */
  readonly fileName: string | null
  readonly progress: number
  readonly lateCount: number
  readonly nextMilestone: { readonly name: string; readonly date: IsoDate } | null
  readonly isComplete: boolean
  /** RFC 3339 timestamp of the last save. */
  readonly updatedAt: string
  /** RFC 3339 timestamp of the last time the project was opened. */
  readonly openedAt: string
}

export type StoredProjectMeta = Pick<
  StoredProjectSummary,
  'origin' | 'fileName' | 'progress' | 'lateCount' | 'nextMilestone' | 'isComplete'
>

export type StorageLoadError = LoadError | { readonly type: 'not-found' }

export type StorageProvider = {
  /** Most recently opened first. */
  list(): Promise<StoredProjectSummary[]>
  load(id: string): Promise<Result<ProjectFile, StorageLoadError>>
  save(file: ProjectFile, meta: StoredProjectMeta): Promise<StoredProjectSummary>
  markOpened(id: string): Promise<void>
  remove(id: string): Promise<void>
}
