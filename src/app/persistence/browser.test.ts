import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '../../core/model.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { createBrowserStorage } from './browser.ts'

let counter = 0
function storage(times: string[] = []) {
  const queue = [...times]
  counter += 1
  return createBrowserStorage(`rentang-test-${String(counter)}`, () => queue.shift() ?? 'later')
}

const meta = { origin: 'demo', progress: 40, lateCount: 1 } as const

describe('browser storage', () => {
  it('saves, lists and loads a project', async () => {
    const store = storage(['2026-10-24T08:00:00.000Z'])
    const project = coffeeShopProject()
    const summary = await store.save({ schemaVersion: CURRENT_SCHEMA_VERSION, project }, meta)

    expect(summary).toEqual({
      id: 'kedai-kopi',
      name: 'Peluncuran Kedai Kopi',
      area: 'work',
      ...meta,
      updatedAt: '2026-10-24T08:00:00.000Z',
    })
    expect(await store.list()).toEqual([summary])
    expect(await store.load('kedai-kopi')).toEqual({
      ok: true,
      value: { schemaVersion: CURRENT_SCHEMA_VERSION, project },
    })
  })

  it('lists the most recently saved first and overwrites by id', async () => {
    const store = storage(['2026-10-24T08:00:00Z', '2026-10-24T09:00:00Z', '2026-10-24T10:00:00Z'])
    const project = coffeeShopProject()
    await store.save({ schemaVersion: CURRENT_SCHEMA_VERSION, project }, meta)
    await store.save({ schemaVersion: CURRENT_SCHEMA_VERSION, project: { ...project, id: 'b', name: 'B' } }, meta)
    await store.save({ schemaVersion: CURRENT_SCHEMA_VERSION, project: { ...project, name: 'Diganti' } }, meta)

    const list = await store.list()
    expect(list.map((item) => [item.id, item.name])).toEqual([
      ['kedai-kopi', 'Diganti'],
      ['b', 'B'],
    ])
  })

  it('reports a missing project and removes projects', async () => {
    const store = storage()
    await store.save({ schemaVersion: CURRENT_SCHEMA_VERSION, project: coffeeShopProject() }, meta)
    await store.remove('kedai-kopi')
    expect(await store.list()).toEqual([])
    expect(await store.load('kedai-kopi')).toEqual({ ok: false, error: { type: 'not-found' } })
  })
})
