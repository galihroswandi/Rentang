import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, type ProjectFile } from '../../core/model.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { createBrowserStorage } from './browser.ts'
import { createMemoryStorage } from './memory.ts'
import type { StorageProvider, StoredProjectMeta } from './storage-provider.ts'

let counter = 0
function clock(): () => string {
  let tick = 0
  return () => `2026-10-24T08:00:${String((tick += 1)).padStart(2, '0')}.000Z`
}

const meta: StoredProjectMeta = {
  origin: 'demo',
  fileName: 'kedai.gan',
  progress: 40,
  lateCount: 1,
  nextMilestone: null,
  isComplete: false,
}
const file = (project = coffeeShopProject()): ProjectFile => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  project,
})

const providers: [string, () => StorageProvider][] = [
  ['browser', () => createBrowserStorage(`rentang-test-${String((counter += 1))}`, clock())],
  ['memory', () => createMemoryStorage(clock())],
]

describe.each(providers)('%s storage', (_, create) => {
  it('saves, lists and loads a project', async () => {
    const store = create()
    const summary = await store.save(file(), meta)
    expect(summary).toEqual({
      id: 'kedai-kopi',
      name: 'Peluncuran Kedai Kopi',
      area: 'work',
      ...meta,
      updatedAt: '2026-10-24T08:00:01.000Z',
      openedAt: '2026-10-24T08:00:01.000Z',
    })
    expect(await store.list()).toEqual([summary])
    expect(await store.load('kedai-kopi')).toEqual({ ok: true, value: file() })
  })

  it('lists the most recently opened first and keeps the opening time on save', async () => {
    const store = create()
    await store.save(file(), meta)
    await store.save(file({ ...coffeeShopProject(), id: 'b', name: 'B' }), meta)
    await store.markOpened('kedai-kopi')
    await store.save(file({ ...coffeeShopProject(), name: 'Diganti' }), meta)

    const list = await store.list()
    expect(list.map((item) => [item.id, item.name, item.openedAt])).toEqual([
      ['kedai-kopi', 'Diganti', '2026-10-24T08:00:03.000Z'],
      ['b', 'B', '2026-10-24T08:00:02.000Z'],
    ])
  })

  it('reports a missing project and removes projects', async () => {
    const store = create()
    await store.save(file(), meta)
    await store.markOpened('hilang')
    await store.remove('kedai-kopi')
    expect(await store.list()).toEqual([])
    expect(await store.load('kedai-kopi')).toEqual({ ok: false, error: { type: 'not-found' } })
  })
})

describe('browser storage upgrades', () => {
  it('reads records saved before the summary fields existed', async () => {
    const name = `rentang-old-${String((counter += 1))}`
    const old = new Dexie(name)
    old.version(1).stores({ projects: 'id, updatedAt' })
    await old
      .table('projects')
      .put({ id: 'lama', name: 'Lama', updatedAt: '2026-10-01T00:00:00Z', file: {} })
    old.close()

    const list = await createBrowserStorage(name).list()
    expect(list).toEqual([
      {
        id: 'lama',
        name: 'Lama',
        area: 'work',
        origin: 'rentang',
        fileName: null,
        progress: 0,
        lateCount: 0,
        nextMilestone: null,
        isComplete: false,
        updatedAt: '2026-10-01T00:00:00Z',
        openedAt: '2026-10-01T00:00:00Z',
      },
    ])
  })
})
