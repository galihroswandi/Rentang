import { describe, expect, it } from 'vitest'
import { analyzeCriticalPath, type CriticalPath } from '../../core/critical-path.ts'
import { toIsoDate } from '../../core/dates.ts'
import type { Project } from '../../core/model.ts'
import { rollUpProgress } from '../../core/summary.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { buildTaskRows } from './rows.ts'

function analysed(project: Project): CriticalPath {
  const result = analyzeCriticalPath(project)
  if (!result.ok) throw new Error('cycle')
  return result.value
}

const today = toIsoDate('2026-11-18')
const project: Project = {
  ...coffeeShopProject(),
  // Shuffle the stored order to prove rows follow `order`, not array position.
  tasks: [...coffeeShopProject().tasks]
    .reverse()
    .map((task) =>
      task.id === '2'
        ? { ...task, progress: 100 }
        : task.id === '6'
          ? { ...task, progress: 40 }
          : task,
    ),
}

function rows(collapsed: string[] = []) {
  return buildTaskRows({
    project,
    analysis: analysed(project),
    progress: rollUpProgress(project),
    collapsed: new Set(collapsed),
    today,
  })
}

describe('buildTaskRows', () => {
  it('numbers the outline in sibling order', () => {
    expect(rows().map((row) => `${row.wbs} ${row.name}`)).toEqual([
      '1 Persiapan',
      '1.1 Survei lokasi',
      '1.2 Izin usaha',
      '1.3 Kontrak sewa',
      '2 Renovasi',
      '2.1 Desain interior',
      '2.2 Pengerjaan ruang',
      '2.3 Pasang mesin espresso',
      '3 Operasional',
      '3.1 Rekrut barista',
      '3.2 Pelatihan barista',
      '3.3 Uji coba menu',
      '3.4 Soft opening',
    ])
  })

  it('carries tree position for assistive technology', () => {
    const [persiapan, survei] = rows()
    expect(persiapan).toMatchObject({
      level: 1,
      positionInSet: 1,
      setSize: 3,
      isSummary: true,
      expanded: true,
      parentId: null,
    })
    expect(survei).toMatchObject({
      level: 2,
      positionInSet: 1,
      setSize: 3,
      isSummary: false,
      expanded: false,
      parentId: '1',
    })
  })

  it('adds computed dates, rolled-up progress, status and critical flags', () => {
    const byId = new Map(rows().map((row) => [row.id, row]))
    expect(byId.get('1')).toMatchObject({
      start: '2026-11-02',
      end: '2026-11-10',
      progress: 30,
      status: null,
    })
    expect(byId.get('2')).toMatchObject({ status: 'done', critical: true })
    expect(byId.get('4')).toMatchObject({ status: 'late', critical: false })
    expect(byId.get('6')).toMatchObject({ status: 'late', progress: 40 })
    expect(byId.get('7')).toMatchObject({ status: 'not-started', critical: true })
    expect(byId.get('13')).toMatchObject({
      isMilestone: true,
      start: '2026-12-09',
      end: '2026-12-09',
    })
  })

  it('carries the task type and assigned people', () => {
    const [first] = buildTaskRows({
      project: {
        tasks: project.tasks.map((task) =>
          task.id === '1' ? { ...task, type: 'DOC' as const } : task,
        ),
        resources: [{ id: 'r', name: 'Sari Wulandari' }],
        assignments: [
          { id: 'a', taskId: '1', resourceId: 'r' },
          { id: 'b', taskId: '1', resourceId: 'gone' },
        ],
      },
      analysis: null,
      progress: new Map(),
      collapsed: new Set(),
      today,
    })
    expect(first).toMatchObject({
      type: 'DOC',
      people: [{ id: 'r', name: 'Sari Wulandari', initials: 'SW' }],
    })
    expect(rows()[1]).toMatchObject({ type: null, people: [] })
  })

  it('leaves out collapsed subtrees', () => {
    const visible = rows(['1', '9'])
    expect(visible.map((row) => row.wbs)).toEqual(['1', '2', '2.1', '2.2', '2.3', '3'])
    expect(visible[0]?.expanded).toBe(false)
  })

  it('shows tasks without dates when the schedule failed', () => {
    const [first] = buildTaskRows({
      project,
      analysis: null,
      progress: new Map(),
      collapsed: new Set(),
      today,
    })
    expect(first).toMatchObject({
      start: null,
      end: null,
      status: null,
      critical: false,
      progress: 0,
    })
  })
})
