/**
 * Keeping the reader's place while the zoom changes. The date in the middle of the chart's
 * visible part stays in the middle; only the width of a day stretches around it. A pure
 * function over numbers and dates, so it is tested without a browser.
 */
import { addDays, diffDays, type IsoDate } from '../../core/dates.ts'

/** What the chart showed: where its first day is, how wide a day is, how far it was scrolled. */
export type ChartView = {
  readonly start: IsoDate
  readonly dayWidth: number
  readonly scrollLeft: number
}

/**
 * The scroll position that puts the same moment in the middle of `visible` pixels.
 * The moment is kept to a fraction of a day, so a wide day does not jump to its centre.
 */
export function scrollAfterZoom(
  before: ChartView,
  after: { readonly start: IsoDate; readonly dayWidth: number },
  visible: number,
): number {
  const centre = (before.scrollLeft + visible / 2) / before.dayWidth
  const wholeDays = Math.floor(centre)
  const fraction = centre - wholeDays
  const date = addDays(before.start, wholeDays)
  const x = (diffDays(after.start, date) + fraction) * after.dayWidth
  return Math.max(0, x - visible / 2)
}
