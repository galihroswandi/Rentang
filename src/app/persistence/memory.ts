/** Storage that lives only as long as the page; a fallback when IndexedDB is unavailable. */
import { err, ok } from '../../core/result.ts'
import type { StorageProvider, StoredProjectSummary } from './storage-provider.ts'
import type { ProjectFile } from '../../core/model.ts'

export function createMemoryStorage(
  now: () => string = () => new Date().toISOString(),
): StorageProvider {
  const records = new Map<string, { file: ProjectFile; summary: StoredProjectSummary }>()
  return {
    list: () =>
      Promise.resolve(
        [...records.values()]
          .map((record) => record.summary)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      ),
    load: (id) => {
      const record = records.get(id)
      return Promise.resolve(record ? ok(record.file) : err({ type: 'not-found' as const }))
    },
    save: (file, meta) => {
      const { id, name, area } = file.project
      const summary = { id, name, area, ...meta, updatedAt: now() }
      records.set(id, { file: structuredClone(file), summary })
      return Promise.resolve(summary)
    },
    remove: (id) => {
      records.delete(id)
      return Promise.resolve()
    },
  }
}
