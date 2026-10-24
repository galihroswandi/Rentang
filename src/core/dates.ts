/**
 * Calendar-date arithmetic on 'YYYY-MM-DD' strings, without the Date object.
 * Dates have no time or zone, so timezone bugs cannot happen. Internally a date is a
 * day number: days since 1970-01-01 in the proleptic Gregorian calendar.
 */

declare const isoDateBrand: unique symbol

/** A valid calendar date written as 'YYYY-MM-DD'. Create one with {@link parseIsoDate} or {@link toIsoDate}. */
export type IsoDate = string & { readonly [isoDateBrand]: true }

export type DateParts = { readonly year: number; readonly month: number; readonly day: number }

/** 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isValidParts({ year, month, day }: DateParts): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 1 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  )
}

/** Splits a 'YYYY-MM-DD' string into its parts, or returns null if it is not a real date. */
export function parseIsoDate(text: string): DateParts | null {
  const match = ISO_DATE_PATTERN.exec(text)
  if (!match) return null
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  return isValidParts(parts) ? parts : null
}

export function isIsoDate(text: string): text is IsoDate {
  return parseIsoDate(text) !== null
}

/**
 * The window Rentang works in. Dates outside it are refused when data comes in, so
 * arithmetic stays far from the edges of the calendar (year 1 and year 9999).
 */
export const MIN_DATE = '1970-01-01' as IsoDate
export const MAX_DATE = '2100-12-31' as IsoDate

export function isSupportedDate(date: IsoDate): boolean {
  return date >= MIN_DATE && date <= MAX_DATE
}

/** The date itself, or the nearest edge of the supported window. */
export function clampDate(date: IsoDate): IsoDate {
  return date < MIN_DATE ? MIN_DATE : date > MAX_DATE ? MAX_DATE : date
}

/** Writes date parts as 'YYYY-MM-DD'. Throws RangeError for a date that does not exist. */
export function formatIsoDate(parts: DateParts): IsoDate {
  if (!isValidParts(parts)) {
    throw new RangeError(`Not a calendar date: ${JSON.stringify(parts)}`)
  }
  const year = String(parts.year).padStart(4, '0')
  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  return `${year}-${month}-${day}` as IsoDate
}

/** Narrows a string known to be a date, such as a literal in code. Throws RangeError otherwise. */
export function toIsoDate(text: string): IsoDate {
  if (!isIsoDate(text)) {
    throw new RangeError(`Not a 'YYYY-MM-DD' date: ${text}`)
  }
  return text
}

// Day-number conversion after Howard Hinnant's days_from_civil / civil_from_days.
export function toDayNumber(date: IsoDate): number {
  const parts = parseIsoDate(date)
  if (!parts) throw new RangeError(`Not a 'YYYY-MM-DD' date: ${date}`)
  const year = parts.year - (parts.month <= 2 ? 1 : 0)
  const era = Math.floor(year / 400)
  const yearOfEra = year - era * 400
  const shiftedMonth = (parts.month + 9) % 12
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + parts.day - 1
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

export function fromDayNumber(dayNumber: number): IsoDate {
  const shifted = dayNumber + 719468
  const era = Math.floor(shifted / 146097)
  const dayOfEra = shifted - era * 146097
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  )
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153)
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1
  const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0)
  return formatIsoDate({ year, month, day })
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days)
}

/** Calendar days from `from` to `to`; negative when `to` is earlier. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from)
}

export function dayOfWeek(date: IsoDate): Weekday {
  // 1970-01-01 was a Thursday.
  return ((((toDayNumber(date) + 4) % 7) + 7) % 7) as Weekday
}

/** Negative, zero or positive, like a sort comparator. 'YYYY-MM-DD' sorts as text. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b
}
