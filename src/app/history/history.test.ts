import { describe, expect, it } from 'vitest'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { addRole, renameProject, renameRole } from '../edits/project-edits.ts'
import { EMPTY_HISTORY, HISTORY_LIMIT, record, redo, undo } from './history.ts'

describe('history', () => {
  it('records an edit and takes it back and forth', () => {
    const start = coffeeShopProject()
    const added = record(start, EMPTY_HISTORY, 'Role ditambahkan', addRole('k', 'Kasir'))
    if (!added) throw new Error('expected a change')
    expect(added.project.roles).toEqual([{ id: 'k', name: 'Kasir' }])
    expect(added.history.past.map((entry) => entry.label)).toEqual(['Role ditambahkan'])

    const undone = undo(added.project, added.history)
    expect(undone?.project).toEqual(start)
    expect(undone?.history).toMatchObject({ past: [], future: [{ label: 'Role ditambahkan' }] })

    const redone = undone && redo(undone.project, undone.history)
    expect(redone?.project).toEqual(added.project)
    expect(redone?.history.future).toEqual([])
  })

  it('ignores edits that change nothing and steps that do not exist', () => {
    const start = coffeeShopProject()
    expect(record(start, EMPTY_HISTORY, 'x', renameRole('missing', 'y'))).toBeNull()
    expect(undo(start, EMPTY_HISTORY)).toBeNull()
    expect(redo(start, EMPTY_HISTORY)).toBeNull()
  })

  it('clears redo after a new edit and keeps a bounded past', () => {
    let project = coffeeShopProject()
    let history = EMPTY_HISTORY
    for (let index = 0; index < HISTORY_LIMIT + 5; index++) {
      const step = record(
        project,
        history,
        `Role ${String(index)}`,
        addRole(`r${String(index)}`, 'R'),
      )
      if (!step) throw new Error('expected a change')
      ;({ project, history } = step)
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    const undone = undo(project, history)
    if (!undone) throw new Error('expected undo')
    const fresh = record(undone.project, undone.history, 'Baru', addRole('baru', 'Baru'))
    expect(fresh?.history.future).toEqual([])
  })
})

describe('merged steps', () => {
  const start = coffeeShopProject()

  function typeNames(names: readonly string[], key: string | undefined) {
    let project = start
    let history = EMPTY_HISTORY
    for (const name of names) {
      const step = record(project, history, 'Nama proyek diubah', renameProject(name), key)
      if (!step) throw new Error('expected a change')
      ;({ project, history } = step)
    }
    return { project, history }
  }

  it('joins edits in a row with the same key into one step', () => {
    const { project, history } = typeNames(['K', 'Ke', 'Ked'], 'nama')
    expect(project.name).toBe('Ked')
    expect(history.past).toHaveLength(1)
    // The joined step stores the name once, not once per edit.
    expect(history.past[0]?.patches).toHaveLength(1)
    expect(undo(project, history)?.project).toEqual(start)
  })

  it('keeps separate steps without a key or with another key', () => {
    expect(typeNames(['K', 'Ke'], undefined).history.past).toHaveLength(2)
    const first = typeNames(['K'], 'a')
    const second = record(first.project, first.history, 'x', renameProject('Ke'), 'b')
    expect(second?.history.past).toHaveLength(2)
  })

  it('starts a new step after an undo', () => {
    const typed = typeNames(['K'], 'nama')
    const role = record(typed.project, typed.history, 'Role', addRole('k', 'Kasir'))
    if (!role) throw new Error('expected a change')
    const undone = undo(role.project, role.history)
    if (!undone) throw new Error('expected undo')
    const again = record(undone.project, undone.history, 'Nama', renameProject('Ke'), 'nama')
    expect(again?.history.past).toHaveLength(2)
  })

  it('drops the step when the joined edits cancel out', () => {
    const typed = typeNames(['Baru'], 'nama')
    const back = record(typed.project, typed.history, 'Nama', renameProject(start.name), 'nama')
    expect(back?.project.name).toBe(start.name)
    expect(back?.history.past).toEqual([])
    expect(back?.entry.patches).toEqual([])
  })
})
