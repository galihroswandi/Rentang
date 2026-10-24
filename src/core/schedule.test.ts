import { describe, expect, it } from 'vitest'
import { toIsoDate } from './dates.ts'
import type { Dependency, Project, Task } from './model.ts'
import { schedule, type Schedule } from './schedule.ts'
import { coffeeShopProject } from './test-utils/coffee-shop.ts'

const d = toIsoDate

function scheduled(project: Project): Schedule {
  const result = schedule(project)
  if (!result.ok) throw new Error(`Unexpected cycle: ${result.error.taskIds.join(' -> ')}`)
  return result.value
}

function datesOf(result: Schedule): Record<string, [string, string]> {
  return Object.fromEntries([...result.tasks].map(([id, task]) => [id, [task.start, task.end]]))
}

function task(id: string, start: string, duration: number, extra: Partial<Task> = {}): Task {
  return {
    id,
    name: id,
    start: d(start),
    duration,
    progress: 0,
    isMilestone: duration === 0,
    order: 0,
    ...extra,
  }
}

function dependency(from: string, to: string, lag = 0): Dependency {
  return { id: `${from}-${to}`, from, to, type: 'finish-to-start', lag }
}

function project(tasks: Task[], dependencies: Dependency[] = [], holidays: string[] = []): Project {
  return {
    ...coffeeShopProject(holidays),
    tasks,
    dependencies,
  }
}

describe('golden: Peluncuran Kedai Kopi', () => {
  it('computes every end date', () => {
    const ends = Object.fromEntries(
      [...scheduled(coffeeShopProject()).tasks].map(([id, { end }]) => [id, end]),
    )
    expect(ends).toMatchObject({
      '2': '2026-11-04',
      '3': '2026-11-10',
      '4': '2026-11-09',
      '6': '2026-11-17',
      '7': '2026-11-27',
      '8': '2026-12-01',
      '10': '2026-11-19',
      '11': '2026-12-04',
      '12': '2026-12-08',
      '13': '2026-12-09',
    })
  })

  it('spans summary tasks over their subtasks', () => {
    const result = scheduled(coffeeShopProject())
    expect(datesOf(result)).toMatchObject({
      '1': ['2026-11-02', '2026-11-10'],
      '5': ['2026-11-11', '2026-12-01'],
      '9': ['2026-11-12', '2026-12-09'],
    })
    expect(result.tasks.get('1')?.isSummary).toBe(true)
    expect(result.tasks.get('2')?.isSummary).toBe(false)
    expect(result.projectStart).toBe('2026-11-02')
    expect(result.projectEnd).toBe('2026-12-09')
  })

  it('shifts exactly six tasks for a holiday on 2026-11-18', () => {
    const before = datesOf(scheduled(coffeeShopProject()))
    const after = datesOf(scheduled(coffeeShopProject(['2026-11-18'])))

    expect(after['7']).toEqual(['2026-11-19', '2026-11-30'])
    expect(after['13']).toEqual(['2026-12-10', '2026-12-10'])

    const leaves = ['2', '3', '4', '6', '7', '8', '10', '11', '12', '13']
    const shifted = leaves.filter((id) => JSON.stringify(before[id]) !== JSON.stringify(after[id]))
    expect(shifted).toEqual(['7', '8', '10', '11', '12', '13'])
  })
})

describe('schedule', () => {
  it('moves a requested start off a weekend', () => {
    const result = scheduled(project([task('a', '2026-11-07', 2)]))
    expect(datesOf(result)['a']).toEqual(['2026-11-09', '2026-11-10'])
  })

  it('keeps a requested start later than the dependencies require', () => {
    const result = scheduled(
      project([task('a', '2026-11-02', 1), task('b', '2026-11-10', 1)], [dependency('a', 'b')]),
    )
    expect(datesOf(result)['b']).toEqual(['2026-11-10', '2026-11-10'])
  })

  it('applies lag in workdays, including negative lag', () => {
    const tasks = [task('a', '2026-11-02', 3), task('b', '2026-11-02', 1)]
    expect(datesOf(scheduled(project(tasks, [dependency('a', 'b', 2)])))['b']).toEqual([
      '2026-11-09',
      '2026-11-09',
    ])
    expect(datesOf(scheduled(project(tasks, [dependency('a', 'b', -1)])))['b']).toEqual([
      '2026-11-04',
      '2026-11-04',
    ])
  })

  it('lets a successor start on the day of a milestone', () => {
    const result = scheduled(
      project([task('m', '2026-11-04', 0), task('b', '2026-11-02', 2)], [dependency('m', 'b')]),
    )
    expect(datesOf(result)['b']).toEqual(['2026-11-04', '2026-11-05'])
  })

  it('treats dependencies on summary tasks as dependencies on their subtasks', () => {
    const tasks = [
      task('p', '2026-11-02', 1),
      task('p1', '2026-11-02', 2, { parentId: 'p' }),
      task('p2', '2026-11-02', 4, { parentId: 'p' }),
      task('q', '2026-11-02', 1),
      task('q1', '2026-11-02', 1, { parentId: 'q' }),
      task('q2', '2026-11-03', 1, { parentId: 'q' }),
    ]
    const result = datesOf(scheduled(project(tasks, [dependency('p', 'q')])))
    expect(result['q1']).toEqual(['2026-11-06', '2026-11-06'])
    expect(result['q2']).toEqual(['2026-11-06', '2026-11-06'])
    expect(result['q']).toEqual(['2026-11-06', '2026-11-06'])
  })

  it('handles nested summary tasks', () => {
    const tasks = [
      task('top', '2026-11-02', 1),
      task('mid', '2026-11-02', 1, { parentId: 'top' }),
      task('leaf', '2026-11-03', 2, { parentId: 'mid' }),
    ]
    const result = datesOf(scheduled(project(tasks)))
    expect(result['top']).toEqual(['2026-11-03', '2026-11-04'])
    expect(result['mid']).toEqual(['2026-11-03', '2026-11-04'])
  })

  it('returns empty project bounds for a project without tasks', () => {
    const result = scheduled(project([]))
    expect(result.tasks.size).toBe(0)
    expect(result.projectStart).toBeNull()
    expect(result.projectEnd).toBeNull()
  })
})

describe('dependency cycles', () => {
  it('reports a cycle as a structured error instead of throwing', () => {
    const tasks = [
      task('a', '2026-11-02', 1),
      task('b', '2026-11-02', 1),
      task('c', '2026-11-02', 1),
    ]
    const result = schedule(
      project(tasks, [dependency('a', 'b'), dependency('b', 'c'), dependency('c', 'a')]),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.type).toBe('dependency-cycle')
    expect([...result.error.taskIds].sort()).toEqual(['a', 'b', 'c'])
  })

  it('reports only the tasks on the cycle, not those downstream of it', () => {
    const tasks = ['a', 'b', 'c', 'd'].map((id) => task(id, '2026-11-02', 1))
    const result = schedule(
      project(tasks, [
        dependency('a', 'b'),
        dependency('b', 'a'),
        dependency('b', 'c'),
        dependency('c', 'd'),
      ]),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect([...result.error.taskIds].sort()).toEqual(['a', 'b'])
  })

  it('lists the cycle in dependency order', () => {
    const tasks = ['x', 'y', 'z'].map((id) => task(id, '2026-11-02', 1))
    const edges = [dependency('x', 'y'), dependency('y', 'z'), dependency('z', 'x')]
    const result = schedule(project(tasks, edges))
    if (result.ok) throw new Error('Expected a cycle')
    const ids = result.error.taskIds
    ids.forEach((id, index) => {
      const next = ids[(index + 1) % ids.length]
      expect(edges.some((edge) => edge.from === id && edge.to === next)).toBe(true)
    })
  })

  it('detects a task depending on itself or on its own summary task', () => {
    const self = schedule(project([task('a', '2026-11-02', 1)], [dependency('a', 'a')]))
    expect(self.ok ? [] : self.error.taskIds).toEqual(['a'])

    const nested = schedule(
      project(
        [task('p', '2026-11-02', 1), task('c', '2026-11-02', 1, { parentId: 'p' })],
        [dependency('c', 'p')],
      ),
    )
    expect(nested.ok ? [] : nested.error.taskIds).toEqual(['c'])
  })
})
