/** Storage that lives only as long as the page; a fallback when IndexedDB is unavailable. */
import type { ProjectFile } from '../../core/model.ts'
import { err, ok } from '../../core/result.ts'
import type { StorageProvider, StoredProjectSummary } from './storage-provider.ts'

export function createMemoryStorage(
  now: () => string = () => new Date().toISOString(),
): StorageProvider {
  const records = new Map<string, { file: ProjectFile; summary: StoredProjectSummary }>()
  return {
    list: () =>
      Promise.resolve(
        [...records.values()]
          .map((record) => record.summary)
          .sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
      ),
    load: (id) => {
      const record = records.get(id)
      return Promise.resolve(
        record ? ok(structuredClone(record.file)) : err({ type: 'not-found' as const }),
      )
    },
    save: (file, meta) => {
      const { id, name, area } = file.project
      const time = now()
      const summary = {
        id,
        name,
        area,
        ...meta,
        updatedAt: time,
        openedAt: records.get(id)?.summary.openedAt ?? time,
      }
      records.set(id, { file: structuredClone(file), summary })
      return Promise.resolve(summary)
    },
    markOpened: (id) => {
      const record = records.get(id)
      if (record) record.summary = { ...record.summary, openedAt: now() }
      return Promise.resolve()
    },
    remove: (id) => {
      records.delete(id)
      return Promise.resolve()
    },
  }
}
