import { describe, expect, it } from 'vitest'
import { analyzeCriticalPath } from '../../core/critical-path.ts'
import { toIsoDate } from '../../core/dates.ts'
import type { Project } from '../../core/model.ts'
import { rollUpProgress } from '../../core/summary.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { buildTaskRows } from '../table/rows.ts'
import { findTasks, taskLinks } from './task-links.ts'

const today = toIsoDate('2026-11-18')

function linksOf(project: Project, withSchedule = true) {
  const analysis = analyzeCriticalPath(project)
  const rows = buildTaskRows({
    project,
    analysis: withSchedule && analysis.ok ? analysis.value : null,
    progress: rollUpProgress(project),
    collapsed: new Set(),
    today,
  })
  return taskLinks(rows, today)
}

const project: Project = {
  ...coffeeShopProject(),
  tasks: coffeeShopProject().tasks.map((task) =>
    task.id === '2' ? { ...task, type: 'DOC', progress: 100 } : task,
  ),
}

describe('taskLinks', () => {
  it('describes work with its progress, dates and lateness', () => {
    const links = linksOf(project)
    expect(links.get('2')).toEqual({
      id: '2',
      name: 'Survei lokasi',
      wbs: '1.1',
      type: 'DOC',
      isMilestone: false,
      progress: 100,
      meta: '100%',
      range: '2 – 4 Nov',
      lateDays: 0,
    })
    expect(links.get('6')).toMatchObject({ meta: '0%', range: '11 – 17 Nov', lateDays: 1 })
    expect(links.get('3')).toMatchObject({ lateDays: 8 })
  })

  it('shows a milestone by its date and never as late', () => {
    expect(linksOf(project).get('13')).toMatchObject({
      type: 'MS',
      meta: '9 Des',
      range: 'Milestone · 9 Des',
      lateDays: 0,
    })
  })

  it('keeps names and progress when the schedule cannot be computed', () => {
    const links = linksOf(project, false)
    expect(links.get('13')).toMatchObject({ meta: '', range: '', lateDays: 0 })
    expect(links.get('2')).toMatchObject({ meta: '100%', range: '' })
  })
})

describe('findTasks', () => {
  const links = linksOf(project)

  it('starts with the first tasks in outline order', () => {
    expect(findTasks(links.values(), '  ', 3).map((link) => link.name)).toEqual([
      'Persiapan',
      'Survei lokasi',
      'Izin usaha',
    ])
  })

  it('puts names that start with the query first, then word starts, then the rest', () => {
    expect(findTasks(links.values(), 'Ba').map((link) => link.name)).toEqual([
      'Rekrut barista',
      'Pelatihan barista',
      'Uji coba menu',
    ])
    expect(findTasks(links.values(), 'pe').map((link) => link.name)).toEqual([
      'Persiapan',
      'Pengerjaan ruang',
      'Pelatihan barista',
      'Operasional',
      'Soft opening',
    ])
  })

  it('finds a task by its outline number and returns nothing for no match', () => {
    expect(findTasks(links.values(), '3.4').map((link) => link.name)).toEqual(['Soft opening'])
    expect(findTasks(links.values(), 'tidak ada')).toEqual([])
  })
})
