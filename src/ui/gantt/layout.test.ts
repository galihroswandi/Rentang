import { describe, expect, it } from 'vitest'
import { createWorkCalendar } from '../../core/calendar.ts'
import { analyzeCriticalPath } from '../../core/critical-path.ts'
import { toIsoDate } from '../../core/dates.ts'
import { rollUpProgress } from '../../core/summary.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { buildTaskRows } from '../table/rows.ts'
import { DAY_WIDTH, headerMode, layoutGantt, ZOOMS, type GanttBar, type Zoom } from './layout.ts'

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
    expect(result.width).toBe(56 * 20)
    expect(result.height).toBe(13 * 36)
    expect(result.todayX).toBe(23 * 20 + 10)
  })

  it('places task bars by date with progress', () => {
    expect(bar(result.bars, '2')).toEqual({
      kind: 'task',
      id: '2',
      x: 7 * 20,
      y: 36 + 9,
      width: 3 * 20,
      height: 18,
      progressWidth: 30,
      critical: true,
    })
    expect(bar(result.bars, '4')).toMatchObject({ critical: false })
  })

  it('draws summaries as brackets and milestones as diamonds labelled on the left', () => {
    expect(bar(result.bars, '1')).toEqual({
      kind: 'summary',
      id: '1',
      points: '140,11.5 320,11.5 320,24.5 314,18.5 146,18.5 140,24.5',
    })
    expect(bar(result.bars, '13')).toEqual({
      kind: 'milestone',
      id: '13',
      cx: 44 * 20 + 10,
      cy: 12 * 36 + 18,
      critical: true,
      name: 'Soft opening',
      date: '9 Des',
      labelX: 44 * 20 + 10 - 14,
      labelSide: 'left',
    })
  })

  it('routes links straight when there is room and around when there is not', () => {
    const links = new Map(result.links.map((link) => [link.id, link]))
    // Into the milestone's top point rather than across its label.
    expect(links.get('12-13')).toEqual({ id: '12-13', d: 'M880 414 H890 V438', critical: true })
    // Izin usaha ends 10 Nov; Rekrut barista starts 12 Nov, one day later.
    expect(links.get('3-10')).toEqual({ id: '3-10', d: 'M320 90 H326 V342 H340', critical: false })
    // Survei lokasi ends 4 Nov and Izin usaha starts the next day: no room.
    expect(links.get('2-3')).toEqual({
      id: '2-3',
      d: 'M200 54 H206 V72 H194 V90 H200',
      critical: true,
    })
  })

  it('merges weekends, separates weeks and labels week ranges and day numbers', () => {
    expect(result.offDays[0]).toEqual({ x: 5 * 20, width: 40 })
    expect(result.offDays).toHaveLength(8)
    expect(result.weekLines).toEqual([140, 280, 420, 560, 700, 840, 980])
    expect(result.top[0]).toMatchObject({ x: 0, width: 140, label: '26 Okt – 1 Nov' })
    expect(result.top[1]?.label).toBe('2 – 8 Nov')
    expect(
      result.bottom
        .slice(0, 7)
        .map((cell) => cell.label)
        .join(','),
    ).toBe('26,27,28,29,30,31,1')
    expect(result.bottom.find((cell) => cell.isToday)?.key).toBe('2026-11-18')
    expect(result.bottom.find((cell) => cell.key === '2026-10-31')?.isOff).toBe(true)
  })
})

describe('other zooms', () => {
  it('uses wider days with the same week labels when zoomed to days', () => {
    const result = layout('day')
    expect(result.dayWidth).toBe(32)
    expect(result.top[0]).toMatchObject({ x: 0, width: 7 * 32, label: '26 Okt – 1 Nov' })
    expect(result.top).toHaveLength(8)
    expect(result.bottom[0]?.label).toBe('26')
    expect(result.offDays[0]).toEqual({ x: 5 * 32, width: 64 })
  })

  it('aligns to whole months and labels weeks when zoomed to months', () => {
    const result = layout('month')
    expect(result.start).toBe('2026-11-01')
    expect(result.end).toBe('2027-01-31')
    expect(result.top.map((cell) => cell.label)).toEqual([
      'November 2026',
      'Desember 2026',
      'Januari 2027',
    ])
    // The range starts on a Sunday, so the first week cell is a single day.
    expect(result.bottom[0]).toMatchObject({ x: 0, width: 6, label: '1', isToday: false })
    expect(result.bottom.find((cell) => cell.isToday)?.label).toBe('16')
    expect(result.offDays).toEqual([])
  })
})

describe('all zoom levels', () => {
  it('runs from the closest look to the widest, each level narrower than the one before', () => {
    expect(ZOOMS).toEqual(['detail', 'day', 'week', 'month', 'quarter', 'year'])
    const widths = ZOOMS.map((zoom) => DAY_WIDTH[zoom])
    expect(widths).toEqual([...widths].sort((a, b) => b - a))
    expect(ZOOMS.map(headerMode)).toEqual(['days', 'days', 'days', 'weeks', 'months', 'quarters'])
  })

  it('names the weekday on each day at the closest level', () => {
    const result = layout('detail')
    expect(result.dayWidth).toBe(64)
    expect(result.bottom.slice(0, 3).map((cell) => cell.label)).toEqual([
      'Sen 26',
      'Sel 27',
      'Rab 28',
    ])
    expect(result.top[0]?.label).toBe('26 Okt – 1 Nov')
    expect(result.offDays[0]).toEqual({ x: 5 * 64, width: 128 })
  })

  it('shows months under years, over whole years, with no weekend stripes', () => {
    const result = layout('quarter')
    expect(result.start).toBe('2026-01-01')
    expect(result.end).toBe('2026-12-31')
    expect(result.width).toBe(365 * 3)
    expect(result.top).toEqual([
      { key: '2026-01-01', x: 0, width: 365 * 3, label: '2026', isToday: false, isOff: false },
    ])
    expect(result.bottom.map((cell) => cell.label)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ])
    expect(result.bottom[0]?.width).toBe(31 * 3)
    expect(result.bottom.find((cell) => cell.isToday)?.label).toBe('Nov')
    expect(result.offDays).toEqual([])
    expect(result.weekLines).toEqual([])
  })

  it('shows quarters under years at the widest level, and spans several years', () => {
    const tasks = project.tasks.map((task) =>
      task.id === '13' ? { ...task, start: toIsoDate('2028-03-01') } : task,
    )
    const rows = buildTaskRows({
      project: { tasks },
      analysis: null,
      progress: new Map(),
      collapsed: new Set(),
      today,
    }).map((row) =>
      row.id === '13'
        ? { ...row, start: toIsoDate('2028-03-01'), end: toIsoDate('2028-03-01') }
        : row,
    )
    const result = layoutGantt({
      rows,
      dependencies: [],
      calendar: createWorkCalendar(project.calendar),
      zoom: 'year',
      today,
    })
    expect(result.start).toBe('2026-01-01')
    expect(result.end).toBe('2028-12-31')
    expect(result.top.map((cell) => cell.label)).toEqual(['2026', '2027', '2028'])
    expect(result.bottom).toHaveLength(12)
    expect(result.bottom.slice(0, 4).map((cell) => cell.label)).toEqual(['K1', 'K2', 'K3', 'K4'])
    expect(result.bottom.filter((cell) => cell.isToday).map((cell) => cell.key)).toEqual([
      '2026-10-01',
    ])
    expect(bar(result.bars, '13')).toMatchObject({ kind: 'milestone' })
  })

  it.each(ZOOMS)('lays out every task at %s zoom', (zoom: Zoom) => {
    const result = layout(zoom)
    expect(result.bars).toHaveLength(13)
    expect(result.todayX).toBeGreaterThan(0)
    expect(result.todayX).toBeLessThan(result.width)
    for (const item of result.bars) {
      if (item.kind === 'task') expect(item.width).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('labels, collapsed tasks and empty projects', () => {
  it('puts a milestone label on the right when there is no room on the left', () => {
    const rows = buildTaskRows({
      project: {
        tasks: project.tasks
          .filter((task) => task.id === '13')
          .map(({ parentId: _parent, ...task }) => task),
      },
      analysis: null,
      progress: new Map(),
      collapsed: new Set(),
      today,
    }).map((row) => ({ ...row, start: toIsoDate('2026-10-27'), end: toIsoDate('2026-10-27') }))
    const result = layoutGantt({
      rows,
      dependencies: [],
      calendar: createWorkCalendar(project.calendar),
      zoom: 'week',
      today,
    })
    expect(bar(result.bars, '13')).toMatchObject({ labelSide: 'right', labelX: 8 * 20 + 10 + 14 })
  })

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
