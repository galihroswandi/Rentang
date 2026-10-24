import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toIsoDate } from '../../core/dates.ts'
import type { ProjectFile } from '../../core/model.ts'
import { err, ok } from '../../core/result.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { DEMO_PROJECT_ID } from '../demo/coffee-shop-demo.ts'
import type { StorageProvider, StoredProjectSummary } from '../persistence/storage-provider.ts'
import { createAppStore } from './app-store.ts'

// The jsdom environment has no file: import.meta.url, so resolve from the repo root.
const fixture = readFileSync(resolve('fixtures/kedai-kopi-demo.gan'), 'utf8')

function memoryStorage(failing: { save?: boolean; list?: boolean } = {}): StorageProvider {
  const records = new Map<string, { file: ProjectFile; summary: StoredProjectSummary }>()
  let clock = 0
  return {
    list() {
      if (failing.list) return Promise.reject(new Error('blocked'))
      return Promise.resolve(
        [...records.values()]
          .map((record) => record.summary)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      )
    },
    load(id) {
      const record = records.get(id)
      return Promise.resolve(record ? ok(record.file) : err({ type: 'not-found' as const }))
    },
    save(file, meta) {
      if (failing.save) return Promise.reject(new Error('quota'))
      clock += 1
      const { id, name, area } = file.project
      const summary = { id, name, area, ...meta, updatedAt: String(clock).padStart(4, '0') }
      records.set(id, { file, summary })
      return Promise.resolve(summary)
    },
    remove(id) {
      records.delete(id)
      return Promise.resolve()
    },
  }
}

function setup(storage = memoryStorage()) {
  let ids = 0
  const store = createAppStore({
    storage,
    today: () => toIsoDate('2026-11-18'),
    newId: () => `id-${String((ids += 1))}`,
  })
  return { store, storage }
}

describe('start', () => {
  it('shows the start screen when nothing is stored', async () => {
    const { store } = setup()
    expect(store.getState().screen).toEqual({ kind: 'loading' })
    await store.getState().start()
    expect(store.getState().screen).toEqual({ kind: 'start' })
  })

  it('reopens the most recently saved project', async () => {
    const storage = memoryStorage()
    await storage.save(
      { schemaVersion: 1, project: coffeeShopProject() },
      {
        origin: 'gan',
        progress: 0,
        lateCount: 0,
      },
    )
    const { store } = setup(storage)
    await store.getState().start()
    expect(store.getState().screen).toEqual({ kind: 'project' })
    expect(store.getState().current?.project.id).toBe('kedai-kopi')
    expect(store.getState().current?.origin).toBe('gan')
  })

  it('falls back to the start screen when storage is unavailable', async () => {
    const { store } = setup(memoryStorage({ list: true }))
    await store.getState().start()
    expect(store.getState()).toMatchObject({
      screen: { kind: 'start' },
      notice: { kind: 'storage-failed' },
    })
  })
})

describe('importing a .gan file', () => {
  it('waits for confirmation with the import report, then saves and opens', async () => {
    const { store } = setup()
    await store.getState().openFile({ name: 'kedai-kopi-demo.gan', text: fixture })

    const pending = store.getState().pendingImport
    expect(pending?.fileName).toBe('kedai-kopi-demo.gan')
    expect(pending?.report.imported.tasks).toBe(14)
    expect(store.getState().projects).toEqual([])

    await store.getState().confirmImport()
    const state = store.getState()
    expect(state.pendingImport).toBeNull()
    expect(state.screen).toEqual({ kind: 'project' })
    expect(state.current?.project).toMatchObject({ id: 'id-1', name: 'Peluncuran Kedai Kopi' })
    expect(state.current?.analysis.ok).toBe(true)
    expect(state.current?.progress.get('1')).toBe(58)
    expect(state.projects).toMatchObject([{ id: 'id-1', origin: 'gan', progress: 15 }])
  })

  it('can be cancelled without saving', async () => {
    const { store } = setup()
    await store.getState().openFile({ name: 'kedai-kopi-demo.gan', text: fixture })
    store.getState().cancelImport()
    await store.getState().confirmImport()
    expect(store.getState().pendingImport).toBeNull()
    expect(store.getState().projects).toEqual([])
  })

  it('names an unnamed project after its file', async () => {
    const { store } = setup()
    const xml = '<project name=""><tasks/></project>'
    await store.getState().openFile({ name: 'rencana-cafe.GAN', text: xml })
    expect(store.getState().pendingImport?.project.name).toBe('rencana-cafe')
  })

  it('reports a file it cannot read', async () => {
    const { store } = setup()
    await store.getState().openFile({ name: 'rusak.gan', text: '<project>' })
    expect(store.getState().notice).toMatchObject({
      kind: 'open-failed',
      fileName: 'rusak.gan',
      error: { type: 'malformed-xml' },
    })
    store.getState().dismissNotice()
    expect(store.getState().notice).toBeNull()
  })
})

describe('opening a .rentang file', () => {
  const file = JSON.stringify({ schemaVersion: 1, project: coffeeShopProject() })

  it('saves and opens it', async () => {
    const { store } = setup()
    await store.getState().openFile({ name: 'kedai.rentang', text: file })
    expect(store.getState().current?.project.id).toBe('kedai-kopi')
    expect(store.getState().projects).toMatchObject([{ id: 'kedai-kopi', origin: 'rentang' }])
  })

  it.each([
    ['{bukan json', { type: 'invalid-json' }],
    [
      JSON.stringify({ schemaVersion: 9, project: {} }),
      { type: 'newer-schema-version', version: 9 },
    ],
  ])('reports %j', async (text, error) => {
    const { store } = setup()
    await store.getState().openFile({ name: 'x.rentang', text })
    expect(store.getState().notice).toEqual({ kind: 'open-failed', fileName: 'x.rentang', error })
  })

  it('refuses other file types', async () => {
    const { store } = setup()
    await store.getState().openFile({ name: 'jadwal.xlsx', text: '' })
    expect(store.getState().notice).toMatchObject({ error: { type: 'unsupported-file' } })
    await store.getState().openFile({ name: 'tanpa-ekstensi', text: '' })
    expect(store.getState().notice).toMatchObject({ error: { type: 'unsupported-file' } })
  })
})

describe('demo and navigation', () => {
  it('opens the demo project', async () => {
    const { store } = setup()
    await store.getState().openDemo()
    const state = store.getState()
    expect(state.current?.origin).toBe('demo')
    expect(state.current?.project.id).toBe(DEMO_PROJECT_ID)
    expect(state.projects.map((project) => project.id)).toEqual([DEMO_PROJECT_ID])

    state.showStart()
    expect(store.getState().screen).toEqual({ kind: 'start' })
    await store.getState().openProject(DEMO_PROJECT_ID)
    expect(store.getState().screen).toEqual({ kind: 'project' })
    expect(store.getState().current?.origin).toBe('demo')
  })

  it('still shows a project when saving fails', async () => {
    const { store } = setup(memoryStorage({ save: true }))
    await store.getState().openDemo()
    expect(store.getState()).toMatchObject({
      screen: { kind: 'project' },
      notice: { kind: 'storage-failed' },
    })
  })

  it('reports a project that is no longer stored', async () => {
    const { store } = setup()
    await store.getState().openProject('hilang')
    expect(store.getState()).toMatchObject({
      screen: { kind: 'start' },
      notice: { kind: 'open-failed', error: { type: 'not-found' } },
    })
  })

  it('keeps a project with a dependency cycle open and reports the cycle', async () => {
    const project = coffeeShopProject()
    const cyclic = {
      ...project,
      dependencies: [
        ...project.dependencies,
        { id: 'loop', from: '13', to: '2', type: 'finish-to-start' as const, lag: 0 },
      ],
    }
    const { store } = setup()
    await store.getState().openFile({
      name: 'loop.rentang',
      text: JSON.stringify({ schemaVersion: 1, project: cyclic }),
    })
    const analysis = store.getState().current?.analysis
    expect(analysis?.ok).toBe(false)
    expect(store.getState().projects).toMatchObject([{ progress: 0, lateCount: 0 }])
  })
})
