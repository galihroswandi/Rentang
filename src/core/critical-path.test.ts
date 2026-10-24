import { describe, expect, it } from 'vitest'
import { analyzeCriticalPath, type CriticalPath } from './critical-path.ts'
import { toIsoDate } from './dates.ts'
import type { Dependency, Project, Task } from './model.ts'
import { coffeeShopProject } from './test-utils/coffee-shop.ts'
import { generateProject } from './test-utils/generate-project.ts'
import { schedule } from './schedule.ts'

function analyzed(project: Project): CriticalPath {
  const result = analyzeCriticalPath(project)
  if (!result.ok) throw new Error(`Unexpected cycle: ${result.error.taskIds.join(' -> ')}`)
  return result.value
}

const byNumber = (a: string, b: string): number => Number(a) - Number(b)

describe('golden: Peluncuran Kedai Kopi', () => {
  it('marks exactly 2, 3, 6, 7, 8, 11, 12 and 13 as critical', () => {
    const { critical } = analyzed(coffeeShopProject())
    expect([...critical].sort(byNumber)).toEqual(['2', '3', '6', '7', '8', '11', '12', '13'])
  })

  it('gives the non-critical tasks their float in workdays', () => {
    const { float, critical } = analyzed(coffeeShopProject())
    expect(critical.has('4')).toBe(false)
    expect(critical.has('10')).toBe(false)
    expect(float.get('4')).toBe(22)
    expect(float.get('10')).toBe(8)
  })

  it('never marks summary tasks', () => {
    const { critical, float } = analyzed(coffeeShopProject())
    for (const summary of ['1', '5', '9']) {
      expect(critical.has(summary)).toBe(false)
      expect(float.has(summary)).toBe(false)
    }
  })

  it('stays consistent when a holiday moves the project end', () => {
    const { critical, schedule } = analyzed(coffeeShopProject(['2026-11-18']))
    expect(schedule.projectEnd).toBe('2026-12-10')
    expect([...critical].sort(byNumber)).toEqual(['2', '3', '6', '7', '8', '11', '12', '13'])
  })
})

describe('analyzeCriticalPath', () => {
  const base = coffeeShopProject()
  const task = (id: string, start: string, duration: number): Task => ({
    id,
    name: id,
    start: toIsoDate(start),
    duration,
    progress: 0,
    isMilestone: duration === 0,
    order: 0,
  })
  const link = (from: string, to: string, lag = 0): Dependency => ({
    id: `${from}-${to}`,
    from,
    to,
    type: 'finish-to-start',
    lag,
  })

  it('uses lag in the backward pass', () => {
    const project = {
      ...base,
      tasks: [task('a', '2026-11-02', 2), task('b', '2026-11-02', 1), task('c', '2026-11-02', 6)],
      dependencies: [link('a', 'b', 3)],
    }
    const { critical, float } = analyzed(project)
    // a (2 days) + lag 3 + b (1 day) = 6 workdays, exactly as long as c.
    expect([...critical].sort()).toEqual(['a', 'b', 'c'])
    expect(float.get('a')).toBe(0)
  })

  it('pulls a milestone predecessor as late as its successor allows', () => {
    const project = {
      ...base,
      tasks: [task('m', '2026-11-02', 0), task('b', '2026-11-02', 2), task('c', '2026-11-02', 5)],
      dependencies: [link('m', 'b')],
    }
    const { float } = analyzed(project)
    expect(float.get('m')).toBe(3)
    expect(float.get('b')).toBe(3)
    expect(float.get('c')).toBe(0)
  })

  it('returns the cycle error from scheduling', () => {
    const project = {
      ...base,
      tasks: [task('a', '2026-11-02', 1), task('b', '2026-11-02', 1)],
      dependencies: [link('a', 'b'), link('b', 'a')],
    }
    expect(analyzeCriticalPath(project).ok).toBe(false)
  })
})

describe('performance', () => {
  it('schedules and analyses 200 tasks in under 50 ms', () => {
    const project = generateProject(200)
    expect(project.tasks).toHaveLength(200)
    expect(schedule(project).ok).toBe(true)

    // Warm up the JIT, then take the best of several runs: the criterion is whether 200 tasks
    // can be scheduled in 50 ms, and the best run is the one least disturbed by coverage
    // instrumentation or other test workers sharing the machine.
    for (let run = 0; run < 3; run++) analyzeCriticalPath(project)
    const timings: number[] = []
    for (let run = 0; run < 10; run++) {
      const started = performance.now()
      analyzeCriticalPath(project)
      timings.push(performance.now() - started)
    }
    expect(Math.min(...timings)).toBeLessThan(50)
  })

  it('generates the same project for the same seed', () => {
    expect(generateProject(200, 7)).toEqual(generateProject(200, 7))
    expect(generateProject(200, 7)).not.toEqual(generateProject(200, 8))
  })
})
