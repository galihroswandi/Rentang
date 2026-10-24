import { describe, expect, it } from 'vitest'
import { analyzeCriticalPath } from '../../core/critical-path.ts'
import { createDemoProject } from '../../app/demo/coffee-shop-demo.ts'
import { toIsoDate } from '../../core/dates.ts'
import { buildPeople, filterPeople, initialsOf, tasksOf } from './people.ts'

const project = createDemoProject(toIsoDate('2026-11-18'))

describe('initialsOf', () => {
  it.each([
    ['Sari Wulandari', 'SW'],
    ['dimas pratama putra', 'DP'],
    ['Rina', 'RI'],
    ['  ', '?'],
  ])('%j gives %s', (name, initials) => {
    expect(initialsOf(name)).toBe(initials)
  })
})

describe('buildPeople', () => {
  it('lists people with role names and task counts', () => {
    const people = buildPeople({
      ...project,
      resources: [
        ...project.resources,
        { id: 'x', name: 'Tanpa Role' },
        { id: 'y', name: 'Hilang', roleId: 'zz' },
      ],
    })
    expect(people[0]).toEqual({
      id: 'sw',
      name: 'Sari Wulandari',
      initials: 'SW',
      roleId: 'manajer',
      roleName: 'Manajer proyek',
      taskCount: 4,
    })
    expect(people.at(-2)).toMatchObject({ roleId: null, roleName: null, taskCount: 0 })
    expect(people.at(-1)).toMatchObject({ roleId: 'zz', roleName: null })
  })

  it('filters by name or role', () => {
    const people = buildPeople(project)
    expect(filterPeople(people, '').length).toBe(5)
    expect(filterPeople(people, 'BARISTA').map((person) => person.id)).toEqual(['dp', 'rm'])
    expect(filterPeople(people, 'laras').map((person) => person.id)).toEqual(['la'])
  })
})

describe('tasksOf', () => {
  it("lists a person's tasks in schedule order, with dates when the schedule is known", () => {
    const analysis = analyzeCriticalPath(project)
    const schedule = analysis.ok ? analysis.value.schedule.tasks : null
    const tasks = tasksOf(project, 'sw', schedule)
    expect(tasks.map((item) => item.task.name)).toEqual([
      'Survei lokasi',
      'Izin usaha',
      'Kontrak sewa',
      'Rekrut barista',
    ])
    expect(tasks[0]?.dates?.start).toBeDefined()

    const unscheduled = tasksOf(
      {
        ...project,
        assignments: [...project.assignments, { id: 'ghost', taskId: 'none', resourceId: 'sw' }],
      },
      'sw',
      null,
    )
    expect(unscheduled).toHaveLength(4)
    expect(unscheduled[0]?.dates).toBeNull()
  })
})
