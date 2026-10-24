/** Indonesian date labels. Written out by hand so output is identical in every browser. */
import { parseIsoDate, type IsoDate } from '../core/dates.ts'

export const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

export const SHORT_MONTHS = [
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
] as const

/** Indexed by weekday, 0 = Sunday (Minggu). */
export const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const

function partsOf(date: IsoDate): { year: number; month: number; day: number } {
  const parts = parseIsoDate(date)
  if (!parts) throw new RangeError(`Not a date: ${date}`)
  return parts
}

/** "11 Nov" */
export function formatShortDate(date: IsoDate): string {
  const { month, day } = partsOf(date)
  return `${String(day)} ${SHORT_MONTHS[month - 1] ?? ''}`
}

/** "11 November 2026" */
export function formatLongDate(date: IsoDate): string {
  const { year, month, day } = partsOf(date)
  return `${String(day)} ${MONTHS[month - 1] ?? ''} ${String(year)}`
}

/** "Senin sampai Jumat" for a run of weekdays (also across the weekend), otherwise a list. */
export function formatWorkingDays(workingDays: readonly number[]): string {
  const days = new Set(workingDays)
  if (days.size === 7) return 'Setiap hari'
  const name = (day: number): string => WEEKDAYS[day] ?? ''
  // A run starts on a working day whose previous day is not worked.
  const first = [...days].find((day) => !days.has((day + 6) % 7))
  if (first !== undefined && days.size >= 3) {
    let last = first
    while (days.has((last + 1) % 7) && (last + 1) % 7 !== first) last = (last + 1) % 7
    const length = ((last - first + 7) % 7) + 1
    if (length === days.size) return `${name(first)} sampai ${name(last)}`
  }
  // Otherwise list them Monday first, as the week is usually read.
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map(name)
    .join(', ')
}

/** "12 – 18 Okt", "26 Okt – 1 Nov", or a single "12 Okt" when both are the same day. */
export function formatRange(from: IsoDate, to: IsoDate): string {
  const a = partsOf(from)
  const b = partsOf(to)
  if (from === to) return formatShortDate(from)
  if (a.month === b.month && a.year === b.year) {
    return `${String(a.day)} – ${String(b.day)} ${SHORT_MONTHS[b.month - 1] ?? ''}`
  }
  return `${formatShortDate(from)} – ${formatShortDate(to)}`
}
