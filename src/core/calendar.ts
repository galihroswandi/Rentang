import {
  addDays,
  clampDate,
  dayOfWeek,
  isSupportedDate,
  toDayNumber,
  type IsoDate,
} from './dates.ts'

/** The parts of a project calendar that decide which days count as workdays. */
export type CalendarRules = {
  /** Weekdays that are worked; 0 = Sunday ... 6 = Saturday. */
  readonly workingDays: readonly number[]
  readonly holidays: readonly { readonly date: IsoDate }[]
}

export type WorkCalendar = {
  isWorkday(date: IsoDate): boolean
  /**
   * The date itself if it is a workday, otherwise the first workday after it.
   * Every result stays inside the supported window (MIN_DATE to MAX_DATE); a search that
   * reaches an edge stops there, even when that day is a day off.
   */
  nextWorkday(date: IsoDate): IsoDate
  /** The date itself if it is a workday, otherwise the last workday before it. */
  previousWorkday(date: IsoDate): IsoDate
  /** Moves `count` workdays from `date` (negative moves back). `date` itself is not counted. */
  addWorkdays(date: IsoDate, count: number): IsoDate
  /**
   * Workdays in [from, to) when from <= to, negated when to < from.
   * For two workdays a and b: addWorkdays(a, workdaysBetween(a, b)) === b.
   */
  workdaysBetween(from: IsoDate, to: IsoDate): number
}

export function createWorkCalendar(rules: CalendarRules): WorkCalendar {
  const workingDays = new Set(rules.workingDays)
  if (![0, 1, 2, 3, 4, 5, 6].some((day) => workingDays.has(day))) {
    throw new RangeError('A calendar needs at least one working weekday')
  }
  const holidays = new Set<string>(rules.holidays.map((holiday) => holiday.date))

  const isWorkday = (date: IsoDate): boolean =>
    workingDays.has(dayOfWeek(date)) && !holidays.has(date)

  const step = (date: IsoDate, direction: 1 | -1): IsoDate => {
    let current = clampDate(date)
    while (!isWorkday(current)) {
      const next = addDays(current, direction)
      if (!isSupportedDate(next)) return current
      current = next
    }
    return current
  }

  return {
    isWorkday,
    nextWorkday: (date) => step(date, 1),
    previousWorkday: (date) => step(date, -1),
    addWorkdays(date, count) {
      const direction = count < 0 ? -1 : 1
      let current = clampDate(date)
      for (let remaining = Math.abs(count); remaining > 0; remaining--) {
        const next = addDays(current, direction)
        // At an edge, further steps cannot move; stopping keeps a huge count from looping.
        if (!isSupportedDate(next)) break
        const moved = step(next, direction)
        if (moved === current) break
        current = moved
      }
      return current
    },
    workdaysBetween(from, to) {
      const low = clampDate(from)
      const high = clampDate(to)
      return high < low ? -countWorkdays(isWorkday, high, low) : countWorkdays(isWorkday, low, high)
    },
  }
}

function countWorkdays(isWorkday: (date: IsoDate) => boolean, from: IsoDate, to: IsoDate): number {
  let count = 0
  for (let offset = 0, days = toDayNumber(to) - toDayNumber(from); offset < days; offset++) {
    if (isWorkday(addDays(from, offset))) count++
  }
  return count
}
