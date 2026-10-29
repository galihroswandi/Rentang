import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { toIsoDate } from '../../core/dates.ts'
import { projectSchema, type Project } from '../../core/model.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import {
  addHoliday,
  addResource,
  addRole,
  addSubtask,
  addTask,
  indentTask,
  outdentTask,
  assign,
  createProject,
  deleteTask,
  moveTask,
  placeTask,
  removeHoliday,
  removeResource,
  setWorkingDays,
  removeRole,
  renameProject,
  setParent,
  setPredecessors,
  reschedule,
  renameRole,
  subtreeOf,
  unassign,
  updateResource,
  updateTask,
  type Recipe,
  type TaskInput,
} from './project-edits.ts'

const input: TaskInput = {
  name: '  Cetak menu  ',
  type: 'DSG',
  start: toIsoDate('2026-11-23'),
  duration: 2.4,
  isMilestone: false,
  progress: 30,
  notes: '',
}

function apply(project: Project, ...recipes: Recipe[]): Project {
  const next = recipes.reduce((current, recipe) => produce(current, recipe), project)
  const valid = projectSchema.safeParse(next)
  if (!valid.success) throw new Error(valid.error.message)
  return next
}

const byId = (project: Project, id: string) => project.tasks.find((task) => task.id === id)
const ordered = (project: Project, parentId?: string) =>
  project.tasks
    .filter((task) => task.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map((task) => task.id)

describe('createProject', () => {
  it('makes a valid empty project with a Monday to Friday calendar', () => {
    const project = createProject('p', 'Kebun Hidroponik', 'career')
    expect(projectSchema.safeParse(project).success).toBe(true)
    expect(project).toMatchObject({ name: 'Kebun Hidroponik', area: 'career', tasks: [] })
  })
})

describe('subtask hierarchy', () => {
  it('adds a subtask as the last child of a task', () => {
    const project = apply(coffeeShopProject(), addSubtask('n', input, '5'))
    expect(ordered(project, '5')).toEqual(['6', '7', '8', 'n'])
    expect(byId(project, 'n')).toMatchObject({ parentId: '5', order: 3 })
  })

  it('turns a leaf into a summary task when it gets its first subtask', () => {
    const project = apply(coffeeShopProject(), addSubtask('n', input, '9'))
    expect(subtreeOf(project, '9').has('n')).toBe(true)
  })

  it('indents a task under the sibling above it and renumbers', () => {
    const project = apply(coffeeShopProject(), indentTask('9'))
    expect(byId(project, '9')?.parentId).toBe('5')
    expect(ordered(project, '5').at(-1)).toBe('9')
    expect(ordered(project)).toEqual(['1', '5'])
  })

  it('does not indent the first task of a group', () => {
    const before = coffeeShopProject()
    expect(apply(before, indentTask('1'))).toEqual(before)
  })

  it('outdents a subtask to sit right after its parent', () => {
    const project = apply(coffeeShopProject(), outdentTask('6'))
    expect(byId(project, '6')).not.toHaveProperty('parentId')
    expect(ordered(project)).toEqual(['1', '5', '6', '9'])
    expect(ordered(project, '5')).toEqual(['7', '8'])
  })

  it('moves a task under any other task, and back to the top level', () => {
    const under = apply(coffeeShopProject(), setParent('1', '5'))
    expect(byId(under, '1')?.parentId).toBe('5')
    expect(ordered(under)).toEqual(['5', '9'])
    expect(ordered(under, '5').at(-1)).toBe('1')
    const top = apply(under, setParent('1', null))
    expect(ordered(top).at(-1)).toBe('1')
  })

  it('refuses to move a task under itself or its own subtask', () => {
    const before = coffeeShopProject()
    expect(apply(before, setParent('5', '6'))).toEqual(before)
    expect(apply(before, setParent('5', '5'))).toEqual(before)
  })

  it('does not outdent a top-level task', () => {
    const before = coffeeShopProject()
    expect(apply(before, outdentTask('1'))).toEqual(before)
  })
})

describe('tasks', () => {
  it('adds a task after another one, among its siblings', () => {
    const project = apply(coffeeShopProject(), addTask('n', input, '6'))
    expect(byId(project, 'n')).toEqual({
      id: 'n',
      name: 'Cetak menu',
      type: 'DSG',
      start: '2026-11-23',
      duration: 2,
      progress: 30,
      isMilestone: false,
      order: 1,
      parentId: '5',
    })
    expect(ordered(project, '5')).toEqual(['6', 'n', '7', '8'])
  })

  it('adds a task at the end of the top level without a reference', () => {
    const project = apply(coffeeShopProject(), addTask('n', { ...input, type: null }, null))
    expect(ordered(project)).toEqual(['1', '5', '9', 'n'])
    expect(byId(project, 'n')).not.toHaveProperty('type')
    expect(byId(project, 'n')).not.toHaveProperty('parentId')
  })

  it('updates a task, turning it into a milestone and clamping progress', () => {
    const project = apply(
      coffeeShopProject(),
      updateTask('7', { ...input, isMilestone: true, progress: 140, type: null }),
    )
    expect(byId(project, '7')).toMatchObject({
      name: 'Cetak menu',
      duration: 0,
      isMilestone: true,
      progress: 100,
    })
    expect(byId(project, '7')).not.toHaveProperty('type')
  })

  it('stores trimmed notes and clears them when blank', () => {
    const noted = apply(
      coffeeShopProject(),
      updateTask('7', { ...input, notes: '  Tanya tukang  ' }),
    )
    expect(byId(noted, '7')?.notes).toBe('Tanya tukang')
    const cleared = apply(noted, updateTask('7', { ...input, notes: '   ' }))
    expect(byId(cleared, '7')).not.toHaveProperty('notes')
  })

  it('lets a summary task keep notes too', () => {
    const project = apply(coffeeShopProject(), updateTask('5', { ...input, notes: 'Induk' }))
    expect(byId(project, '5')?.notes).toBe('Induk')
  })

  it('only renames and retypes a summary task, whose dates come from its subtasks', () => {
    const before = byId(coffeeShopProject(), '5')
    const project = apply(
      coffeeShopProject(),
      updateTask('5', { ...input, progress: 0 }),
      updateTask('zz', input),
    )
    expect(byId(project, '5')).toEqual({ ...before, name: 'Cetak menu', type: 'DSG' })
  })

  it('deletes a task with its subtasks, links and assignments, and closes the gap', () => {
    const withPeople = apply(
      coffeeShopProject(),
      addResource('r', 'Bagas', null),
      assign('a1', '7', 'r'),
      assign('a2', '2', 'r'),
    )
    const project = apply(withPeople, deleteTask('5'))
    expect(project.tasks.map((task) => task.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '9',
      '10',
      '11',
      '12',
      '13',
    ])
    expect(project.dependencies.map((dependency) => dependency.id)).not.toContain('8-11')
    expect(project.dependencies.map((dependency) => dependency.id)).not.toContain('3-6')
    expect(project.assignments.map((assignment) => assignment.id)).toEqual(['a2'])
    expect(ordered(project)).toEqual(['1', '9'])
    expect(byId(project, '9')?.order).toBe(1)
  })

  it('finds a subtree', () => {
    expect([...subtreeOf(coffeeShopProject(), '9')].sort()).toEqual(['10', '11', '12', '13', '9'])
  })
})

describe('moveTask', () => {
  it('moves a task before or after a sibling and renumbers the group', () => {
    const down = apply(coffeeShopProject(), moveTask('6', '7', 'after'))
    expect(ordered(down, '5')).toEqual(['7', '6', '8'])
    expect(
      down.tasks
        .filter((task) => task.parentId === '5')
        .map((task) => task.order)
        .sort(),
    ).toEqual([0, 1, 2])
    expect(ordered(apply(down, moveTask('8', '7', 'before')), '5')).toEqual(['8', '7', '6'])
    expect(ordered(apply(coffeeShopProject(), moveTask('9', '1', 'before')))).toEqual([
      '9',
      '1',
      '5',
    ])
  })

  it('takes a summary task with its subtasks', () => {
    const project = apply(coffeeShopProject(), moveTask('1', '9', 'after'))
    expect(ordered(project)).toEqual(['5', '9', '1'])
    expect(ordered(project, '1')).toEqual(['2', '3', '4'])
  })

  it('refuses a move to itself, to another group or to a task that is not there', () => {
    const before = coffeeShopProject()
    const unchanged = apply(
      before,
      moveTask('6', '6', 'after'),
      moveTask('6', '2', 'after'),
      moveTask('6', 'nope', 'before'),
      moveTask('nope', '7', 'before'),
    )
    expect(unchanged).toEqual(before)
  })
})

describe('placeTask', () => {
  it('takes a subtask out of its parent, next to a top-level task', () => {
    const project = apply(coffeeShopProject(), placeTask('6', '9', 'before'))
    expect(byId(project, '6')).not.toHaveProperty('parentId')
    expect(ordered(project)).toEqual(['1', '5', '6', '9'])
    expect(ordered(project, '5')).toEqual(['7', '8'])
  })

  it('moves a task next to a subtask of another parent', () => {
    const project = apply(coffeeShopProject(), placeTask('9', '3', 'after'))
    expect(byId(project, '9')?.parentId).toBe('1')
    expect(ordered(project, '1')).toEqual(['2', '3', '9', '4'])
  })

  it('works inside one group, and refuses its own subtree or a missing task', () => {
    const before = coffeeShopProject()
    expect(ordered(apply(before, placeTask('8', '6', 'before')), '5')).toEqual(['8', '6', '7'])
    expect(
      apply(
        before,
        placeTask('5', '6', 'after'),
        placeTask('5', 'nope', 'after'),
        placeTask('nope', '1', 'after'),
      ),
    ).toEqual(before)
  })
})

describe('calendar', () => {
  it('sets the working weekdays, sorted and without repeats, and keeps at least one', () => {
    const project = apply(coffeeShopProject(), setWorkingDays([6, 1, 1, 0]))
    expect(project.calendar.workingDays).toEqual([0, 1, 6])
    const kept = apply(project, setWorkingDays([]))
    expect(kept.calendar.workingDays).toEqual([0, 1, 6])
  })

  it('adds holidays in date order, renames a repeated date and removes them', () => {
    let project = apply(
      coffeeShopProject(),
      addHoliday(toIsoDate('2026-12-25'), ' Natal '),
      addHoliday(toIsoDate('2026-11-18'), ''),
    )
    expect(project.calendar.holidays).toEqual([
      { date: '2026-11-18' },
      { date: '2026-12-25', name: 'Natal' },
    ])
    project = apply(
      project,
      addHoliday(toIsoDate('2026-11-18'), 'Cuti bersama'),
      addHoliday(toIsoDate('2026-12-25'), ''),
    )
    expect(project.calendar.holidays).toEqual([
      { date: '2026-11-18', name: 'Cuti bersama' },
      { date: '2026-12-25' },
    ])
    project = apply(
      project,
      removeHoliday(toIsoDate('2026-11-18')),
      removeHoliday(toIsoDate('2027-01-01')),
    )
    expect(project.calendar.holidays).toEqual([{ date: '2026-12-25' }])
  })
})

describe('reschedule', () => {
  it('moves and resizes a task, and leaves milestones without a length', () => {
    const project = apply(
      coffeeShopProject(),
      reschedule('7', toIsoDate('2026-11-25'), 4.4),
      reschedule('13', toIsoDate('2026-12-14'), 9),
    )
    expect(byId(project, '7')).toMatchObject({ start: '2026-11-25', duration: 4 })
    expect(byId(project, '13')).toMatchObject({ start: '2026-12-14', duration: 0 })
  })

  it('refuses summary tasks, unknown ids and lengths below one day', () => {
    const before = coffeeShopProject()
    const unchanged = apply(
      before,
      reschedule('5', toIsoDate('2026-12-01'), 3),
      reschedule('nope', toIsoDate('2026-12-01'), 3),
    )
    expect(unchanged).toEqual(before)
    expect(byId(apply(before, reschedule('7', toIsoDate('2026-11-18'), 0)), '7')?.duration).toBe(1)
  })
})

describe('limits', () => {
  it('clamps lengths and start dates to what the model accepts', () => {
    const project = apply(
      coffeeShopProject(),
      reschedule('7', toIsoDate('2999-01-01'), 2_000_000_000),
      reschedule('8', toIsoDate('1900-01-01'), 3),
    )
    expect(byId(project, '7')).toMatchObject({ start: '2100-12-31', duration: 3650 })
    expect(byId(project, '8')).toMatchObject({ start: '1970-01-01', duration: 3 })
    expect(projectSchema.safeParse(project).success).toBe(true)
  })
})

describe('people and roles', () => {
  it('adds, edits and removes people and their assignments', () => {
    let project = apply(
      coffeeShopProject(),
      addRole('barista', ' Barista '),
      addResource('r1', 'Dimas', 'barista'),
      addResource('r2', 'Rina', null),
      assign('a1', '11', 'r1'),
      assign('a1-again', '11', 'r1'),
      assign('a2', '12', 'r2'),
    )
    expect(project.roles).toEqual([{ id: 'barista', name: 'Barista' }])
    expect(project.assignments.map((assignment) => assignment.id)).toEqual(['a1', 'a2'])

    project = apply(
      project,
      updateResource('r1', { name: ' Dimas P ', roleId: null }),
      updateResource('r2', { roleId: 'barista' }),
      updateResource('missing', { name: 'x' }),
    )
    expect(project.resources).toEqual([
      { id: 'r1', name: 'Dimas P' },
      { id: 'r2', name: 'Rina', roleId: 'barista' },
    ])

    project = apply(project, unassign('a2'), removeResource('r1'))
    expect(project.resources.map((resource) => resource.id)).toEqual(['r2'])
    expect(project.assignments).toEqual([])
  })

  it('renames and removes roles, clearing them from people', () => {
    const project = apply(
      coffeeShopProject(),
      addRole('k', 'Kasir'),
      addResource('r', 'Rina', 'k'),
      renameRole('k', ' Kasir utama '),
      renameRole('missing', 'x'),
    )
    expect(project.roles).toEqual([{ id: 'k', name: 'Kasir utama' }])
    const removed = apply(project, removeRole('k'))
    expect(removed.roles).toEqual([])
    expect(removed.resources).toEqual([{ id: 'r', name: 'Rina' }])
  })
})

describe('renameProject', () => {
  it('trims the name and ignores a blank one', () => {
    const base = createProject('p', 'Lama', 'work')
    expect(produce(base, renameProject('  Baru  ')).name).toBe('Baru')
    expect(produce(base, renameProject('   ')).name).toBe('Lama')
  })
})

describe('setPredecessors', () => {
  const apply = (recipe: Recipe): Project => produce(coffeeShopProject(), recipe)
  const idsFor = () => {
    let n = 0
    return () => `new-${String((n += 1))}`
  }
  const waitsFor = (project: Project, id: string) =>
    project.dependencies.filter((d) => d.to === id).map((d) => d.from)

  it('replaces what a task waits for, keeping the lag of what stays', () => {
    const before = coffeeShopProject()
    const kept = before.dependencies.find((d) => d.to === '11' && d.from === '8')
    const after = apply(setPredecessors('11', ['8', '2'], idsFor()))
    expect(waitsFor(after, '11').sort()).toEqual(['2', '8'])
    expect(after.dependencies.find((d) => d.id === kept?.id)).toEqual(kept)
    expect(after.dependencies.find((d) => d.from === '2' && d.to === '11')).toMatchObject({
      type: 'finish-to-start',
      lag: 0,
    })
    expect(projectSchema.safeParse(after).success).toBe(true)
  })

  it('clears every predecessor with an empty list and ignores a task waiting for itself', () => {
    expect(waitsFor(apply(setPredecessors('11', [], idsFor())), '11')).toEqual([])
    expect(waitsFor(apply(setPredecessors('5', ['5'], idsFor())), '5')).toEqual([])
  })

  it('leaves other tasks alone', () => {
    const before = coffeeShopProject()
    const after = apply(setPredecessors('11', [], idsFor()))
    expect(after.dependencies).toHaveLength(
      before.dependencies.length - waitsFor(before, '11').length,
    )
  })
})
