import { describe, expect, it } from 'vitest'
import { createWorkCalendar } from '../../core/calendar.ts'
import { analyzeCriticalPath } from '../../core/critical-path.ts'
import { toIsoDate } from '../../core/dates.ts'
import { rollUpProgress } from '../../core/summary.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { buildTaskRows } from '../table/rows.ts'
import { layoutGantt, type GanttBar, type Zoom } from './layout.ts'

const today = toIsoDate('2026-11-18')
const project = coffeeShopProject()
const analysis = analyzeCriticalPath(project)
if (!analysis.ok) throw new Error('cycle')

function layout(zoom: Zoom, collapsed: string[] = []) {
  const tasks = project.tasks.map((task) => (task.id === '2' ? { ...task, progress: 50 } : task))
  const rows = buildTaskRows({
    project: { tasks },
    analysis: analysis.ok ? analysis.value : null,
    progress: rollUpProgress({ tasks }),
    collapsed: new Set(collapsed),
    today,
  })
  return layoutGantt({
    rows,
    dependencies: project.dependencies,
    calendar: createWorkCalendar(project.calendar),
    zoom,
    today,
  })
}

function bar(bars: readonly GanttBar[], id: string): GanttBar | undefined {
  return bars.find((candidate) => candidate.id === id)
}

describe('week zoom', () => {
  const result = layout('week')

  it('pads the range by a week and aligns it to Monday through Sunday', () => {
    expect(result.start).toBe('2026-10-26')
    expect(result.end).toBe('2026-12-20')
    expect(result.width).toBe(56 * 15)
    expect(result.height).toBe(13 * 36)
    expect(result.todayX).toBe(23 * 15 + 7.5)
  })

  it('places task bars by date with progress', () => {
    expect(bar(result.bars, '2')).toEqual({
      kind: 'task',
      id: '2',
      x: 7 * 15,
      y: 36 + 9,
      width: 3 * 15,
      height: 18,
      progressWidth: 23,
      critical: true,
    })
    expect(bar(result.bars, '4')).toMatchObject({ critical: false })
  })

  it('draws summaries as brackets and milestones as diamonds', () => {
    expect(bar(result.bars, '1')).toEqual({
      kind: 'summary',
      id: '1',
      points: '105,11.5 240,11.5 240,24.5 234,18.5 111,18.5 105,24.5',
    })
    expect(bar(result.bars, '13')).toEqual({
      kind: 'milestone',
      id: '13',
      cx: 44 * 15 + 7.5,
      cy: 12 * 36 + 18,
      critical: true,
      label: 'Soft opening · 9 Des',
      labelX: 44 * 15 + 7.5 + 13,
    })
  })

  it('routes links straight when there is room and around when there is not', () => {
    const links = new Map(result.links.map((link) => [link.id, link]))
    // Izin usaha ends 10 Nov; Rekrut barista starts 12 Nov, one day later.
    expect(links.get('3-10')).toEqual({ id: '3-10', d: 'M240 90 H246 V342 H255', critical: false })
    // Survei lokasi ends 4 Nov and Izin usaha starts the next day: no room.
    expect(links.get('2-3')).toEqual({
      id: '2-3',
      d: 'M150 54 H156 V72 H144 V90 H150',
      critical: true,
    })
  })

  it('merges weekends and labels weeks and weekdays', () => {
    expect(result.offDays[0]).toEqual({ x: 5 * 15, width: 30 })
    expect(result.offDays).toHaveLength(8)
    expect(result.top[0]).toMatchObject({ x: 0, width: 105, label: '26 Okt' })
    expect(
      result.bottom
        .slice(0, 7)
        .map((cell) => cell.label)
        .join(''),
    ).toBe('SSRKJSM')
    expect(result.bottom.find((cell) => cell.isToday)?.key).toBe('2026-11-18')
    expect(result.bottom.find((cell) => cell.key === '2026-10-31')?.isOff).toBe(true)
  })
})

describe('other zooms', () => {
  it('labels weeks with their year and days by number when zoomed to days', () => {
    const result = layout('day')
    expect(result.dayWidth).toBe(32)
    expect(result.top[0]).toMatchObject({ x: 0, width: 7 * 32, label: '26 Okt 2026' })
    expect(result.top).toHaveLength(8)
    expect(result.bottom[0]?.label).toBe('26')
    expect(result.offDays[0]).toEqual({ x: 5 * 32, width: 64 })
  })

  it('aligns to whole months and labels weeks when zoomed to months', () => {
    const result = layout('month')
    expect(result.start).toBe('2026-11-01')
    expect(result.end).toBe('2027-01-31')
    expect(result.top.map((cell) => cell.label)).toEqual(['Nov 2026', 'Des 2026', 'Jan 2027'])
    // The range starts on a Sunday, so the first week cell is a single day.
    expect(result.bottom[0]).toMatchObject({ x: 0, width: 4, label: '1', isToday: false })
    expect(result.bottom.find((cell) => cell.isToday)?.label).toBe('16')
    expect(result.offDays).toEqual([])
  })
})

describe('collapsed tasks and empty projects', () => {
  it('skips links to rows that are hidden', () => {
    const result = layout('week', ['5'])
    expect(result.links.map((link) => link.id)).not.toContain('6-7')
    expect(bar(result.bars, '6')).toBeUndefined()
  })

  it('centres an empty chart on today', () => {
    const result = layoutGantt({
      rows: [],
      dependencies: [],
      calendar: createWorkCalendar(project.calendar),
      zoom: 'week',
      today,
    })
    expect(result.start).toBe('2026-11-09')
    expect(result.end).toBe('2026-11-29')
    expect(result.bars).toEqual([])
  })
})
