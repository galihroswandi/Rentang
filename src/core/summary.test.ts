import { describe, expect, it } from 'vitest'
import { toIsoDate } from './dates.ts'
import type { Project } from './model.ts'
import { schedule, type Schedule } from './schedule.ts'
import { rollUpProgress, summarizeProject, taskStatus } from './summary.ts'
import { coffeeShopProject } from './test-utils/coffee-shop.ts'

const d = toIsoDate

function withProgress(progress: Record<string, number>): Project {
  const project = coffeeShopProject()
  return {
    ...project,
    tasks: project.tasks.map((task) => ({ ...task, progress: progress[task.id] ?? 0 })),
  }
}

function scheduled(project: Project): Schedule {
  const result = schedule(project)
  if (!result.ok) throw new Error('Unexpected cycle')
  return result.value
}

describe('taskStatus', () => {
  const today = d('2026-11-12')

  it.each([
    [100, '2026-11-01', 'done'],
    [40, '2026-11-11', 'late'],
    [0, '2026-11-11', 'late'],
    [40, '2026-11-12', 'in-progress'],
    [0, '2026-11-20', 'not-started'],
  ] as const)('progress %i ending %s is %s', (progress, end, status) => {
    expect(taskStatus(progress, d(end), today)).toBe(status)
  })
})

describe('rollUpProgress', () => {
  it('weights subtasks by duration', () => {
    // Persiapan: survei 3 days at 100%, izin 4 days at 50%, kontrak 3 days at 0% → 200/10.
    const progress = rollUpProgress(withProgress({ '2': 100, '3': 50, '4': 0 }))
    expect(progress.get('1')).toBe(50)
    expect(progress.get('2')).toBe(100)
    expect(progress.get('5')).toBe(0)
  })

  it('ignores milestones unless only milestones are present', () => {
    const progress = rollUpProgress(withProgress({ '10': 100, '11': 0, '12': 0, '13': 100 }))
    // Operasional: 6 days at 100%, 3 + 2 days at 0%, milestone weighs nothing → 600/11.
    expect(progress.get('9')).toBe(55)

    const base = { start: d('2026-11-02'), progress: 0, order: 0 }
    const onlyMilestones = {
      tasks: [
        { ...base, id: 'p', name: 'Fase', duration: 1, isMilestone: false },
        {
          ...base,
          id: 'm1',
          name: 'M1',
          duration: 0,
          isMilestone: true,
          progress: 100,
          parentId: 'p',
        },
        { ...base, id: 'm2', name: 'M2', duration: 0, isMilestone: true, parentId: 'p' },
      ],
    }
    expect(rollUpProgress(onlyMilestones).get('p')).toBe(50)
  })
})

describe('summarizeProject', () => {
  it('summarises progress, lateness and span', () => {
    const project = withProgress({ '2': 100, '3': 100, '4': 50, '6': 20 })
    const summary = summarizeProject(project, scheduled(project), d('2026-11-18'))
    expect(summary).toEqual({
      taskCount: 13,
      // (3 + 4) * 100 + 3 * 50 + 5 * 20 = 950 over 36 workdays of leaf tasks.
      progress: 26,
      // Kontrak sewa ended 9 Nov at 50%, Desain interior ended 17 Nov at 20%.
      lateCount: 2,
      start: '2026-11-02',
      end: '2026-12-09',
    })
  })

  it('handles an empty project', () => {
    const project = { ...coffeeShopProject(), tasks: [], dependencies: [] }
    expect(summarizeProject(project, scheduled(project), d('2026-11-18'))).toEqual({
      taskCount: 0,
      progress: 0,
      lateCount: 0,
      start: null,
      end: null,
    })
  })
})
