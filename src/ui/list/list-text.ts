/** Labels and filtering for the project list. */
import type { StoredProjectSummary } from '../../app/persistence/storage-provider.ts'
import { diffDays, formatIsoDate, parseIsoDate, type IsoDate } from '../../core/dates.ts'
import { formatShortDate } from '../format.ts'

/** Local calendar date of an RFC 3339 timestamp, or null for an empty or bad one. */
function localDateOf(timestamp: string): IsoDate | null {
  const time = new Date(timestamp)
  if (timestamp === '' || Number.isNaN(time.getTime())) return null
  return formatIsoDate({
    year: time.getFullYear(),
    month: time.getMonth() + 1,
    day: time.getDate(),
  })
}

/** "Hari ini", "Kemarin", "3 hari lalu", "1 minggu lalu", "2 bulan lalu", "1 tahun lalu". */
export function relativeDay(timestamp: string, today: IsoDate): string {
  const day = localDateOf(timestamp)
  if (day === null) return '—'
  const days = Math.max(0, diffDays(day, today))
  if (days === 0) return 'Hari ini'
  if (days === 1) return 'Kemarin'
  if (days < 7) return `${String(days)} hari lalu`
  if (days < 30) return `${String(Math.floor(days / 7))} minggu lalu`
  if (days < 365) return `${String(Math.floor(days / 30))} bulan lalu`
  return `${String(Math.floor(days / 365))} tahun lalu`
}

/** "12 Nov", or "20 Jan 2027" when the date is in another year than today. */
export function shortDateFrom(date: IsoDate, today: IsoDate): string {
  const year = parseIsoDate(date)?.year
  return year === parseIsoDate(today)?.year
    ? formatShortDate(date)
    : `${formatShortDate(date)} ${String(year)}`
}

export type MilestoneText = {
  readonly name: string
  readonly date: string
  readonly done: boolean
} | null

export function milestoneText(project: StoredProjectSummary, today: IsoDate): MilestoneText {
  if (project.isComplete) return { name: 'Semua tugas selesai', date: 'Selesai', done: true }
  if (!project.nextMilestone) return null
  return {
    name: project.nextMilestone.name,
    date: shortDateFrom(project.nextMilestone.date, today),
    done: false,
  }
}

/** Matches the query against name and file name, ignoring case and accents. */
export function filterProjects(
  projects: readonly StoredProjectSummary[],
  query: string,
): StoredProjectSummary[] {
  const normalise = (text: string) =>
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const words = normalise(query).split(/\s+/).filter(Boolean)
  return projects.filter((project) => {
    const haystack = normalise(`${project.name} ${project.fileName ?? ''}`)
    return words.every((word) => haystack.includes(word))
  })
}
