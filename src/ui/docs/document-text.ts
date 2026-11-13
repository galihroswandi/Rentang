/** Words shown around a document: its title, when it last changed, and how long it is. */
import { formatIsoDate, type IsoDate } from '../../core/dates.ts'
import { formatShortDate } from '../format.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** The title to show; an untitled document still needs a name in the list. */
export function documentTitle(title: string): string {
  return title.trim() === '' ? 'Tanpa judul' : title.trim()
}

/** The title for a document imported from a file that has none of its own: the file's name. */
export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.(?:md|markdown|mdown)$/i, '').trim()
}

function localDay(date: Date): IsoDate {
  return formatIsoDate({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  })
}

/** Whole local days from `from` to `to`, counting calendar days rather than hours. */
function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((end - start) / (24 * HOUR))
}

/**
 * How long ago a timestamp was, in words: "baru saja", "12 menit lalu", "3 jam lalu",
 * "kemarin", "4 hari lalu", "2 minggu lalu", then the date. Null for a missing or broken
 * timestamp. A time slightly ahead of this computer's clock counts as just now.
 */
export function timeAgo(iso: string | undefined, now: Date): string | null {
  if (iso === undefined) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const elapsed = now.getTime() - then.getTime()
  const days = daysBetween(then, now)
  if (elapsed < MINUTE) return 'baru saja'
  if (elapsed < HOUR) return `${String(Math.floor(elapsed / MINUTE))} menit lalu`
  // Hours read better than "kemarin" just after midnight.
  if (days <= 0 || elapsed < 6 * HOUR) return `${String(Math.floor(elapsed / HOUR))} jam lalu`
  if (days === 1) return 'kemarin'
  if (days < 7) return `${String(days)} hari lalu`
  if (days < 30) return `${String(Math.floor(days / 7))} minggu lalu`
  const date = localDay(then)
  const short = formatShortDate(date)
  return then.getFullYear() === now.getFullYear() ? short : `${short} ${String(then.getFullYear())}`
}

/** "Kemarin" for the start of a line; dates and numbers stay as they are. */
export function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('id') + text.slice(1)
}

/** "268 kata" */
export function wordsLabel(count: number): string {
  return `${String(count)} kata`
}
