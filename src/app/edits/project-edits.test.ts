import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { toIsoDate } from '../../core/dates.ts'
import { projectSchema, type Project } from '../../core/model.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import {
  addResource,
  addRole,
  addTask,
  assign,
  createProject,
  deleteTask,
  removeResource,
  removeRole,
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
