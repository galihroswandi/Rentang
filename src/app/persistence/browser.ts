/** Browser-only storage in IndexedDB, used for the demo and until a file is chosen. */
import Dexie, { type EntityTable } from 'dexie'
import { loadProjectFile } from '../../core/migrations.ts'
import type { ProjectFile } from '../../core/model.ts'
import { err } from '../../core/result.ts'
import type { StorageProvider, StoredProjectSummary } from './storage-provider.ts'

type ProjectRecord = StoredProjectSummary & {
  /** The saved file as plain JSON; validated and migrated again on every load. */
  readonly file: unknown
}

type RentangDatabase = Dexie & { projects: EntityTable<ProjectRecord, 'id'> }

/** Records saved before a field existed get a neutral value for it. */
function summaryOf(
  record: Partial<ProjectRecord> & Pick<ProjectRecord, 'id'>,
): StoredProjectSummary {
  const updatedAt = record.updatedAt ?? ''
  return {
    id: record.id,
    name: record.name ?? '',
    area: record.area ?? 'work',
    origin: record.origin ?? 'rentang',
    fileName: record.fileName ?? null,
    progress: record.progress ?? 0,
    lateCount: record.lateCount ?? 0,
    nextMilestone: record.nextMilestone ?? null,
    isComplete: record.isComplete ?? false,
    updatedAt,
    openedAt: record.openedAt ?? updatedAt,
  }
}

export function createBrowserStorage(
  databaseName = 'rentang',
  now: () => string = () => new Date().toISOString(),
): StorageProvider {
  const db = new Dexie(databaseName) as RentangDatabase
  db.version(1).stores({ projects: 'id, updatedAt' })
  db.version(2).stores({ projects: 'id, updatedAt, openedAt' })

  return {
    async list() {
      const records = await db.projects.toArray()
      return records.map(summaryOf).sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    },

    async load(id) {
      const record = await db.projects.get(id)
      if (!record) return err({ type: 'not-found' })
      return loadProjectFile(record.file)
    },

    async save(file: ProjectFile, meta) {
      const { project } = file
      const previous = await db.projects.get(project.id)
      const time = now()
      const record: ProjectRecord = {
        id: project.id,
        name: project.name,
        area: project.area,
        ...meta,
        updatedAt: time,
        openedAt: previous?.openedAt ?? time,
        // Stored as JSON so that what is saved is exactly what a .rentang file would hold.
        file: JSON.parse(JSON.stringify(file)) as unknown,
      }
      await db.projects.put(record)
      return summaryOf(record)
    },

    async markOpened(id) {
      await db.projects.update(id, { openedAt: now() })
    },

    async remove(id) {
      await db.projects.delete(id)
    },
  }
}
