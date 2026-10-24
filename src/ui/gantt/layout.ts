/**
 * Gantt geometry as plain data: no DOM, so it is tested without a browser and the SVG
 * component only draws what this module returns.
 */
import type { WorkCalendar } from '../../core/calendar.ts'
import {
  addDays,
  dayOfWeek,
  diffDays,
  maxDate,
  minDate,
  parseIsoDate,
  formatIsoDate,
  type IsoDate,
} from '../../core/dates.ts'
import type { Dependency } from '../../core/model.ts'
import { formatRange, formatShortDate, MONTHS } from '../format.ts'
import type { TaskRow } from '../table/rows.ts'

export type Zoom = 'day' | 'week' | 'month'

export const ZOOMS: readonly Zoom[] = ['day', 'week', 'month']
export const DAY_WIDTH: Readonly<Record<Zoom, number>> = { day: 32, week: 20, month: 6 }
export const ROW_HEIGHT = 36
export const HEADER_ROW_HEIGHT = 26
const BAR_HEIGHT = 18
const SUMMARY_HEIGHT = 13
const MILESTONE_HALF = 7
const LINK_GAP = 6

/** Below this x a milestone label would run off the chart, so it goes to the right. */
const LABEL_ROOM = 180

export type GanttBar =
  | {
      readonly kind: 'task'
      readonly id: string
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
      readonly progressWidth: number
      readonly critical: boolean
    }
  | { readonly kind: 'summary'; readonly id: string; readonly points: string }
  | {
      readonly kind: 'milestone'
      readonly id: string
      readonly cx: number
      readonly cy: number
      readonly critical: boolean
      readonly name: string
      readonly date: string
      /** Where the label starts (right side) or ends (left side). */
      readonly labelX: number
      readonly labelSide: 'left' | 'right'
    }

export type GanttLink = { readonly id: string; readonly d: string; readonly critical: boolean }

export type HeaderCell = {
  readonly key: string
  readonly x: number
  readonly width: number
  readonly label: string
  readonly isToday: boolean
  readonly isOff: boolean
}

export type GanttLayout = {
  readonly zoom: Zoom
  readonly dayWidth: number
  readonly start: IsoDate
  readonly end: IsoDate
  readonly width: number
  readonly height: number
  readonly bars: readonly GanttBar[]
  readonly links: readonly GanttLink[]
  /** Runs of non-working days, merged. */
  readonly offDays: readonly { readonly x: number; readonly width: number }[]
  /** x of each week start inside the range, for the faint week separators. */
  readonly weekLines: readonly number[]
  readonly top: readonly HeaderCell[]
  readonly bottom: readonly HeaderCell[]
  readonly todayX: number
}

export type LayoutInput = {
  readonly rows: readonly TaskRow[]
  readonly dependencies: readonly Pick<Dependency, 'id' | 'from' | 'to'>[]
  readonly calendar: WorkCalendar
  readonly zoom: Zoom
  readonly today: IsoDate
}

function mondayOnOrBefore(date: IsoDate): IsoDate {
  return addDays(date, -((dayOfWeek(date) + 6) % 7))
}

function monthStart(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date) ?? { year: 1970, month: 1 }
  return formatIsoDate({ year, month, day: 1 })
}

function nextMonthStart(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date) ?? { year: 1970, month: 1 }
  return month === 12
    ? formatIsoDate({ year: year + 1, month: 1, day: 1 })
    : formatIsoDate({ year, month: month + 1, day: 1 })
}

/** The visible date range: the project and today, padded and aligned to the zoom's unit. */
function rangeOf(rows: readonly TaskRow[], zoom: Zoom, today: IsoDate): [IsoDate, IsoDate] {
  let low = today
  let high = today
  for (const row of rows) {
    if (row.start) low = minDate(low, row.start)
    if (row.end) high = maxDate(high, row.end)
  }
  if (zoom === 'month') {
    return [monthStart(low), addDays(nextMonthStart(nextMonthStart(high)), -1)]
  }
  return [addDays(mondayOnOrBefore(low), -7), addDays(mondayOnOrBefore(high), 13)]
}

export function layoutGantt({
  rows,
  dependencies,
  calendar,
  zoom,
  today,
}: LayoutInput): GanttLayout {
  const dayWidth = DAY_WIDTH[zoom]
  const [start, end] = rangeOf(rows, zoom, today)
  const dayCount = diffDays(start, end) + 1
  const xOf = (date: IsoDate): number => diffDays(start, date) * dayWidth

  const bars: GanttBar[] = []
  // Where links attach: the end of a predecessor and the start of a successor.
  const anchors = new Map<
    string,
    { index: number; startX: number; endX: number; critical: boolean }
  >()

  rows.forEach((row, index) => {
    if (!row.start || !row.end) return
    const top = index * ROW_HEIGHT
    const x = xOf(row.start)
    const right = xOf(row.end) + dayWidth
    if (row.isMilestone) {
      const cx = x + dayWidth / 2
      const labelSide = cx > LABEL_ROOM ? 'left' : 'right'
      bars.push({
        kind: 'milestone',
        id: row.id,
        cx,
        cy: top + ROW_HEIGHT / 2,
        critical: row.critical,
        name: row.name,
        date: formatShortDate(row.start),
        labelX: labelSide === 'left' ? cx - MILESTONE_HALF - 7 : cx + MILESTONE_HALF + 7,
        labelSide,
      })
      anchors.set(row.id, {
        index,
        startX: cx - MILESTONE_HALF,
        endX: cx + MILESTONE_HALF,
        critical: row.critical,
      })
    } else if (row.isSummary) {
      const y = top + (ROW_HEIGHT - SUMMARY_HEIGHT) / 2
      const notch = Math.min(6, (right - x) / 2)
      const bottom = y + SUMMARY_HEIGHT
      const waist = y + Math.round(SUMMARY_HEIGHT * 0.55)
      const points = [
        [x, y],
        [right, y],
        [right, bottom],
        [right - notch, waist],
        [x + notch, waist],
        [x, bottom],
      ]
      bars.push({ kind: 'summary', id: row.id, points: points.map((p) => p.join(',')).join(' ') })
      anchors.set(row.id, { index, startX: x, endX: right, critical: false })
    } else {
      const width = right - x
      bars.push({
        kind: 'task',
        id: row.id,
        x,
        y: top + (ROW_HEIGHT - BAR_HEIGHT) / 2,
        width,
        height: BAR_HEIGHT,
        progressWidth: Math.round((width * Math.min(100, Math.max(0, row.progress))) / 100),
        critical: row.critical,
      })
      anchors.set(row.id, { index, startX: x, endX: right, critical: row.critical })
    }
  })

  const links: GanttLink[] = []
  for (const dependency of dependencies) {
    const from = anchors.get(dependency.from)
    const to = anchors.get(dependency.to)
    if (!from || !to) continue
    const y1 = from.index * ROW_HEIGHT + ROW_HEIGHT / 2
    const y2 = to.index * ROW_HEIGHT + ROW_HEIGHT / 2
    const x1 = from.endX
    const x2 = to.startX
    let d: string
    if (x2 >= x1 + 2 * LINK_GAP) {
      d = `M${String(x1)} ${String(y1)} H${String(x1 + LINK_GAP)} V${String(y2)} H${String(x2)}`
    } else {
      // No room to drop straight down: run along the successor's row edge and come back.
      const edge = y2 > y1 ? to.index * ROW_HEIGHT : (to.index + 1) * ROW_HEIGHT
      d = [
        `M${String(x1)} ${String(y1)}`,
        `H${String(x1 + LINK_GAP)}`,
        `V${String(edge)}`,
        `H${String(x2 - LINK_GAP)}`,
        `V${String(y2)}`,
        `H${String(x2)}`,
      ].join(' ')
    }
    links.push({ id: dependency.id, d, critical: from.critical && to.critical })
  }

  const offDays: { x: number; width: number }[] = []
  const weekLines: number[] = []
  const bottom: HeaderCell[] = []
  const top: HeaderCell[] = []
  for (let offset = 0; offset < dayCount; offset++) {
    const date = addDays(start, offset)
    const x = offset * dayWidth
    const isOff = !calendar.isWorkday(date)
    const parts = parseIsoDate(date) ?? { year: 0, month: 1, day: 1 }
    const weekStart = dayOfWeek(date) === 1
    if (weekStart && offset > 0) weekLines.push(x)

    if (zoom === 'month') {
      if (weekStart || offset === 0) {
        const weekEnd = minDate(addDays(mondayOnOrBefore(date), 6), end)
        bottom.push({
          key: date,
          x,
          width: (diffDays(date, weekEnd) + 1) * dayWidth,
          label: String(parts.day),
          isToday: today >= date && today <= weekEnd,
          isOff: false,
        })
      }
      if (parts.day === 1 || offset === 0) {
        const monthEnd = minDate(addDays(nextMonthStart(date), -1), end)
        top.push({
          key: date,
          x,
          width: (diffDays(date, monthEnd) + 1) * dayWidth,
          label: `${MONTHS[parts.month - 1] ?? ''} ${String(parts.year)}`,
          isToday: false,
          isOff: false,
        })
      }
      continue
    }

    if (isOff) {
      const last = offDays.at(-1)
      if (last && last.x + last.width === x) last.width += dayWidth
      else offDays.push({ x, width: dayWidth })
    }
    bottom.push({
      key: date,
      x,
      width: dayWidth,
      label: String(parts.day),
      isToday: date === today,
      isOff,
    })
    if (weekStart || offset === 0) {
      // Each week carries its own range, so the month stays readable while scrolling.
      const weekEnd = minDate(addDays(mondayOnOrBefore(date), 6), end)
      top.push({
        key: date,
        x,
        width: (diffDays(date, weekEnd) + 1) * dayWidth,
        label: formatRange(date, weekEnd),
        isToday: false,
        isOff: false,
      })
    }
  }

  return {
    zoom,
    dayWidth,
    start,
    end,
    width: dayCount * dayWidth,
    height: rows.length * ROW_HEIGHT,
    bars,
    links,
    offDays,
    weekLines,
    top,
    bottom,
    todayX: xOf(today) + dayWidth / 2,
  }
}
