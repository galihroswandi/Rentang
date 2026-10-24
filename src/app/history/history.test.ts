import { describe, expect, it } from 'vitest'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { addRole, renameRole } from '../edits/project-edits.ts'
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
