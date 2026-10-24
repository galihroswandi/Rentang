import { formatIsoDate, type IsoDate } from '../core/dates.ts'

/** Today's date on this computer's clock and time zone. */
export function localToday(): IsoDate {
  const now = new Date()
  return formatIsoDate({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() })
}
