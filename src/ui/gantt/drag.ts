/**
 * What a drag on a Gantt bar means, as pure functions: pixels become whole days, and days
 * become a start date and a length in workdays. Moving never lands on a day off, and a
 * task never gets shorter than one workday.
 */
import type { WorkCalendar } from '../../core/calendar.ts'
import { addDays, type IsoDate } from '../../core/dates.ts'
import { endOf } from '../../core/schedule.ts'

export type DragMode = 'move' | 'resize'

/** Pointer travel (px) before a press counts as a drag rather than a click. */
export const DRAG_THRESHOLD = 4

export type DragInput = {
  readonly mode: DragMode
  /** The task as currently scheduled. */
  readonly start: IsoDate
  readonly end: IsoDate
  readonly duration: number
  readonly isMilestone: boolean
  readonly deltaDays: number
  readonly calendar: WorkCalendar
}

export type DragResult = {
  readonly start: IsoDate
  readonly end: IsoDate
  /** Workdays; 0 for a milestone. */
  readonly duration: number
}

export function daysFromPixels(deltaX: number, dayWidth: number): number {
  // Rounded by size, so a half day snaps the same way in both directions.
  const days = Math.round(Math.abs(deltaX) / dayWidth)
  return deltaX < 0 && days > 0 ? -days : days
}

export function resolveDrag(input: DragInput): DragResult {
  const { mode, start, end, duration, isMilestone, deltaDays, calendar } = input

  if (mode === 'resize' && !isMilestone) {
    // The new last day: snapped back to a workday, and never before the start.
    const lastDay = calendar.previousWorkday(addDays(end, deltaDays))
    const length = lastDay <= start ? 1 : calendar.workdaysBetween(start, lastDay) + 1
    return { start, end: endOf(calendar, start, length), duration: length }
  }

  // Dragging forward lands on the next workday, backward on the previous one, so a bar
  // never jumps against the direction it is being pulled.
  const moved = addDays(start, deltaDays)
  const newStart = deltaDays < 0 ? calendar.previousWorkday(moved) : calendar.nextWorkday(moved)
  const length = isMilestone ? 0 : duration
  return { start: newStart, end: endOf(calendar, newStart, length), duration: length }
}

/** True when a drag ended somewhere that changes the task. */
export function changed(input: DragInput, result: DragResult): boolean {
  return result.start !== input.start || result.duration !== input.duration
}
