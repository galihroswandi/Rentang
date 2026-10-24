/**
 * Where projects live. Stage 1 has only the browser provider; the local-file provider
 * (File System Access API) follows in stage 3 behind the same interface.
 */
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
  readonly progress: number
  readonly lateCount: number
  /** RFC 3339 timestamp of the last save. */
  readonly updatedAt: string
}

export type StoredProjectMeta = Pick<StoredProjectSummary, 'origin' | 'progress' | 'lateCount'>

export type StorageLoadError = LoadError | { readonly type: 'not-found' }

export type StorageProvider = {
  /** Most recently saved first. */
  list(): Promise<StoredProjectSummary[]>
  load(id: string): Promise<Result<ProjectFile, StorageLoadError>>
  save(file: ProjectFile, meta: StoredProjectMeta): Promise<StoredProjectSummary>
  remove(id: string): Promise<void>
}
