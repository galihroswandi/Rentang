import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toIsoDate } from '../../core/dates.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { DEMO_PROJECT_ID } from '../demo/coffee-shop-demo.ts'
import { addRole, addTask, renameRole, updateTask } from '../edits/project-edits.ts'
import { createMemoryStorage } from '../persistence/memory.ts'
import type { StorageProvider } from '../persistence/storage-provider.ts'
import { createAppStore } from './app-store.ts'

// The jsdom environment has no file: import.meta.url, so resolve from the repo root.
const fixture = readFileSync(resolve('fixtures/kedai-kopi-demo.gan'), 'utf8')
const rentang = (project = coffeeShopProject()) => JSON.stringify({ schemaVersion: 2, project })

function failing(
  base: StorageProvider,
  broken: Partial<Record<keyof StorageProvider, boolean>>,
): StorageProvider {
  const fail = () => Promise.reject(new Error('blocked'))
  return {
    list: broken.list ? fail : () => base.list(),
    load: broken.load ? fail : (id) => base.load(id),
    save: broken.save ? fail : (file, meta) => base.save(file, meta),
    markOpened: broken.markOpened ? fail : (id) => base.markOpened(id),
    remove: (id) => base.remove(id),
  }
}

function setup(storage: StorageProvider = createMemoryStorage()) {
  let ids = 0
  const store = createAppStore({
    storage,
    today: () => toIsoDate('2026-11-18'),
    newId: () => `id-${String((ids += 1))}`,
  })
  return { store, storage, state: () => store.getState() }
}

describe('start', () => {
  it('lists stored projects and shows the project list', async () => {
    const storage = createMemoryStorage()
    await storage.save(
      { schemaVersion: 2, project: coffeeShopProject() },
      {
        origin: 'gan',
        fileName: 'kedai.gan',
        progress: 0,
        lateCount: 0,
        nextMilestone: null,
        isComplete: false,
      },
    )
    const { state } = setup(storage)
    expect(state().ready).toBe(false)
    await state().start()
    expect(state()).toMatchObject({ ready: true, active: null, tabs: [] })
    expect(state().projects.map((project) => project.id)).toEqual(['kedai-kopi'])
  })

  it('still starts when storage is unavailable', async () => {
    const { state } = setup(failing(createMemoryStorage(), { list: true }))
    await state().start()
    expect(state()).toMatchObject({ ready: true, notice: { kind: 'storage-failed' } })
  })
})

describe('importing and opening files', () => {
  it('waits for the import report, then saves and opens a tab', async () => {
    const { state } = setup()
    await state().openFile({ name: 'kedai-kopi-demo.gan', text: fixture })
    expect(state().pendingImport?.report.imported.tasks).toBe(14)
    expect(state().tabs).toEqual([])

    await state().confirmImport()
    expect(state()).toMatchObject({
      pendingImport: null,
      tabs: ['id-1'],
      active: 'id-1',
      saveState: 'saved',
    })
    expect(state().sessions['id-1']?.fileName).toBe('kedai-kopi-demo.gan')
    expect(state().projects).toMatchObject([
      {
        id: 'id-1',
        origin: 'gan',
        fileName: 'kedai-kopi-demo.gan',
        progress: 15,
        nextMilestone: { name: 'Soft opening', date: '2026-12-09' },
      },
    ])
  })

  it('cancels an import without saving, and names an unnamed project after its file', async () => {
    const { state } = setup()
    await state().openFile({
      name: 'rencana-cafe.GAN',
      text: '<project name=""><tasks/></project>',
    })
    expect(state().pendingImport?.project.name).toBe('rencana-cafe')
    state().cancelImport()
    await state().confirmImport()
    expect(state().projects).toEqual([])
  })

  it('opens a .rentang file, migrating an older schema', async () => {
    const { state } = setup()
    const { roles: _roles, ...v1 } = coffeeShopProject()
    await state().openFile({
      name: 'kedai.rentang',
      text: JSON.stringify({ schemaVersion: 1, project: v1 }),
    })
    expect(state().sessions['kedai-kopi']?.project.roles).toEqual([])
    expect(state().projects).toMatchObject([
      { id: 'kedai-kopi', origin: 'rentang', fileName: 'kedai.rentang' },
    ])
  })

  it.each([
    ['rusak.gan', '<project>', { type: 'malformed-xml' }],
    ['x.rentang', '{bukan json', { type: 'invalid-json' }],
    [
      'x.rentang',
      JSON.stringify({ schemaVersion: 9 }),
      { type: 'newer-schema-version', version: 9 },
    ],
    ['jadwal.xlsx', '', { type: 'unsupported-file' }],
    ['tanpa-ekstensi', '', { type: 'unsupported-file' }],
  ])('reports %s', async (name, text, error) => {
    const { state } = setup()
    await state().openFile({ name, text })
    expect(state().notice).toMatchObject({ kind: 'open-failed', fileName: name, error })
    state().dismissNotice()
    expect(state().notice).toBeNull()
  })
})

describe('tabs', () => {
  it('opens stored projects as tabs and closes them', async () => {
    const { state } = setup()
    await state().openDemo()
    await state().createProject('  Kebun  ', 'career')
    expect(state().tabs).toEqual([DEMO_PROJECT_ID, 'id-1'])
    expect(state().sessions['id-1']?.project).toMatchObject({ name: 'Kebun', area: 'career' })
    expect(
      state()
        .projects.map((project) => project.id)
        .sort(),
    ).toEqual([DEMO_PROJECT_ID, 'id-1'].sort())

    state().showList()
    expect(state().active).toBeNull()
    await state().openProject(DEMO_PROJECT_ID)
    expect(state().active).toBe(DEMO_PROJECT_ID)

    state().closeTab(DEMO_PROJECT_ID)
    expect(state()).toMatchObject({ tabs: ['id-1'], active: 'id-1' })
    state().closeTab('id-1')
    expect(state()).toMatchObject({ tabs: [], active: null, sessions: {} })
    state().closeTab('nope')

    await state().openProject(DEMO_PROJECT_ID)
    expect(state().sessions[DEMO_PROJECT_ID]?.origin).toBe('demo')
  })

  it('keeps the active tab when closing another one', async () => {
    const { state } = setup()
    await state().openDemo()
    await state().createProject('Kebun', 'work')
    state().closeTab(DEMO_PROJECT_ID)
    expect(state().active).toBe('id-1')
  })

  it('reports a project that is no longer stored or cannot be read', async () => {
    const { state } = setup()
    await state().openProject('hilang')
    expect(state().notice).toMatchObject({ kind: 'open-failed', error: { type: 'not-found' } })

    const broken = setup(failing(createMemoryStorage(), { load: true }))
    await broken.state().openProject('x')
    expect(broken.state().notice).toEqual({ kind: 'storage-failed' })
  })
})

describe('editing', () => {
  it('applies, undoes and redoes edits, saving each time', async () => {
    const { state, storage } = setup()
    await state().openDemo()
    expect(state().edit('Role ditambahkan', addRole('kasir', 'Kasir'))).toBe('applied')
    expect(state().toast).toMatchObject({ message: 'Role ditambahkan', action: 'undo' })
    const roleIds = () => state().sessions[DEMO_PROJECT_ID]?.project.roles.map((role) => role.id)

    expect(roleIds()).toContain('kasir')
    state().undo()
    expect(roleIds()).not.toContain('kasir')
    expect(state().toast).toMatchObject({ message: 'Dibatalkan: Role ditambahkan', action: 'redo' })
    state().redo()
    expect(roleIds()).toContain('kasir')
    expect(state().toast).toMatchObject({ message: 'Diulang: Role ditambahkan', action: 'undo' })

    await new Promise((resolve) => setTimeout(resolve, 0))
    const saved = await storage.load(DEMO_PROJECT_ID)
    expect(saved.ok && saved.value.project.roles.map((role) => role.id)).toContain('kasir')
    state().dismissToast()
    expect(state().toast).toBeNull()
  })

  it('recomputes the schedule after an edit', async () => {
    const { state } = setup()
    await state().openFile({ name: 'k.rentang', text: rentang() })
    const input = {
      name: 'Pengerjaan ruang',
      type: null,
      start: toIsoDate('2026-11-18'),
      duration: 10,
      isMilestone: false,
      progress: 0,
    }
    state().edit('Tugas diubah', updateTask('7', input))
    const analysis = state().sessions['kedai-kopi']?.analysis
    expect(analysis?.ok && analysis.value.schedule.tasks.get('7')?.end).toBe('2026-12-01')
  })

  it('refuses an edit that would make the project invalid', async () => {
    const { state } = setup()
    await state().openDemo()
    const input = {
      name: 'x',
      type: null,
      start: toIsoDate('2026-11-18'),
      duration: 1,
      isMilestone: false,
      progress: 0,
    }
    expect(state().edit('Tugas ditambahkan', addTask('x', input, '13'))).toBe('applied')
    const bad = state().edit('Rusak', (draft) => {
      const task = draft.tasks.find((candidate) => candidate.id === '2')
      if (task) task.parentId = '13'
    })
    expect(bad).toBe('rejected')
    expect(state().notice).toMatchObject({ kind: 'edit-rejected' })
  })

  it('ignores edits, undo and redo when nothing applies', async () => {
    const { state } = setup()
    expect(state().edit('x', addRole('a', 'A'))).toBe('unchanged')
    state().undo()
    state().redo()
    await state().openDemo()
    expect(state().edit('x', renameRole('missing', 'A'))).toBe('unchanged')
    state().undo()
    state().redo()
    expect(state().toast).toBeNull()
    expect(state().createId()).toBe('id-1')
  })

  it('reports a failed save', async () => {
    const { state } = setup(failing(createMemoryStorage(), { save: true }))
    await state().openDemo()
    expect(state()).toMatchObject({
      saveState: 'failed',
      notice: { kind: 'storage-failed' },
      active: DEMO_PROJECT_ID,
    })
  })

  it('keeps a project with a dependency cycle open and saves it without a summary', async () => {
    const project = coffeeShopProject()
    const loop = { id: 'loop', from: '13', to: '2', type: 'finish-to-start' as const, lag: 0 }
    const { state } = setup()
    await state().openFile({
      name: 'loop.rentang',
      text: rentang({ ...project, dependencies: [...project.dependencies, loop] }),
    })
    expect(state().sessions['kedai-kopi']?.analysis.ok).toBe(false)
    expect(state().projects).toMatchObject([{ progress: 0, nextMilestone: null }])
  })
})
