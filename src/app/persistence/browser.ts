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

export function createBrowserStorage(
  databaseName = 'rentang',
  now: () => string = () => new Date().toISOString(),
): StorageProvider {
  const db = new Dexie(databaseName) as RentangDatabase
  db.version(1).stores({ projects: 'id, updatedAt' })

  const summaryOf = (record: ProjectRecord): StoredProjectSummary => ({
    id: record.id,
    name: record.name,
    area: record.area,
    origin: record.origin,
    progress: record.progress,
    lateCount: record.lateCount,
    updatedAt: record.updatedAt,
  })

  return {
    async list() {
      const records = await db.projects.orderBy('updatedAt').reverse().toArray()
      return records.map(summaryOf)
    },

    async load(id) {
      const record = await db.projects.get(id)
      if (!record) return err({ type: 'not-found' })
      return loadProjectFile(record.file)
    },

    async save(file: ProjectFile, meta) {
      const { project } = file
      const record: ProjectRecord = {
        id: project.id,
        name: project.name,
        area: project.area,
        ...meta,
        updatedAt: now(),
        // Stored as JSON so that what is saved is exactly what a .rentang file would hold.
        file: JSON.parse(JSON.stringify(file)) as unknown,
      }
      await db.projects.put(record)
      return summaryOf(record)
    },

    async remove(id) {
      await db.projects.delete(id)
    },
  }
}
