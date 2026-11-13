/**
 * Tasks as a document shows them: on a mention chip, on the cards beside the page, and in the
 * "@" menu. Everything comes from the task rows, so names, progress and dates follow the
 * schedule the moment it changes.
 */
import { diffDays, type IsoDate } from '../../core/dates.ts'
import { taskStatus } from '../../core/summary.ts'
import { formatRange, formatShortDate } from '../format.ts'
import type { TaskRow, TypeKey } from '../table/rows.ts'

export type TaskLink = {
  readonly id: string
  readonly name: string
  /** Outline number such as "2.1". */
  readonly wbs: string
  readonly type: TypeKey | null
  readonly isMilestone: boolean
  readonly progress: number
  /** Beside the name on a chip: "45%", or the date of a milestone. */
  readonly meta: string
  /** "11 – 17 Nov", or "Milestone · 9 Des"; empty when the schedule cannot be computed. */
  readonly range: string
  /** Calendar days past its end while it is not done; 0 when it is on time. */
  readonly lateDays: number
}

function metaOf(row: TaskRow): string {
  if (!row.isMilestone) return `${String(row.progress)}%`
  return row.start === null ? '' : formatShortDate(row.start)
}

/** One link per task, in outline order, keyed by task id. */
export function taskLinks(rows: readonly TaskRow[], today: IsoDate): Map<string, TaskLink> {
  const links = new Map<string, TaskLink>()
  for (const row of rows) {
    const { start, end } = row
    const late = !row.isMilestone && end !== null && taskStatus(row.progress, end, today) === 'late'
    let range = ''
    if (start !== null && end !== null) {
      range = row.isMilestone ? `Milestone · ${formatShortDate(start)}` : formatRange(start, end)
    }
    links.set(row.id, {
      id: row.id,
      name: row.name,
      wbs: row.wbs,
      type: row.isMilestone ? 'MS' : row.type,
      isMilestone: row.isMilestone,
      progress: row.progress,
      meta: metaOf(row),
      range,
      lateDays: late ? diffDays(end, today) : 0,
    })
  }
  return links
}

/**
 * Tasks for the "@" menu. Without a query: the first ones in outline order. With one: tasks
 * whose name contains it, names that start with it first, then names with a word that does,
 * and an outline number such as "2.1" finds its task too.
 */
export function findTasks(links: Iterable<TaskLink>, query: string, limit = 8): TaskLink[] {
  const all = [...links]
  const wanted = query.trim().toLocaleLowerCase('id')
  if (wanted === '') return all.slice(0, limit)
  const rank = (link: TaskLink): number => {
    const name = link.name.toLocaleLowerCase('id')
    if (name.startsWith(wanted)) return 0
    if (name.split(/\s+/).some((word) => word.startsWith(wanted))) return 1
    if (name.includes(wanted)) return 2
    return link.wbs.startsWith(wanted) ? 3 : -1
  }
  return all
    .map((link) => ({ link, rank: rank(link) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ link }) => link)
}
