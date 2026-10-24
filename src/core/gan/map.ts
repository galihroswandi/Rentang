/**
 * Maps a parsed .gan document onto the Rentang model and records every adjustment in an
 * import report. The original .gan file is never written back.
 */
import { z } from 'zod'
import { formatIsoDate, isIsoDate, type IsoDate } from '../dates.ts'
import {
  projectSchema,
  type Area,
  type Assignment,
  type Calendar,
  type Dependency,
  type Project,
  type Resource,
  type Task,
} from '../model.ts'
import { err, ok, type Result } from '../result.ts'
import { parseGan, type GanDocument, type GanParseError, type GanTask } from './parse.ts'
import type { DependencyKind, ImportChange, ImportReport, ImportSkip } from './report.ts'

export type GanImportOptions = {
  readonly projectId: string
  readonly area?: Area
}

export type GanImport = { readonly project: Project; readonly report: ImportReport }

export type GanImportError =
  GanParseError | { readonly type: 'invalid-project'; readonly issues: readonly string[] }

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5]

const DEPENDENCY_KINDS: Readonly<Record<string, DependencyKind | 'finish-to-start'>> = {
  '1': 'start-to-start',
  '2': 'finish-to-start',
  '3': 'finish-to-finish',
  '4': 'start-to-finish',
}

const urlSchema = z.url()

export function importGan(
  xml: string,
  options: GanImportOptions,
): Result<GanImport, GanImportError> {
  const parsed = parseGan(xml)
  if (!parsed.ok) return parsed
  return mapGanToProject(parsed.value, options)
}

export function mapGanToProject(
  gan: GanDocument,
  options: GanImportOptions,
): Result<GanImport, GanImportError> {
  const changed: ImportChange[] = []
  const skipped: ImportSkip[] = []

  const calendar = mapCalendar(gan, changed, skipped)
  const tasks = mapTasks(gan.tasks.task, changed, skipped)
  const taskIds = new Set(tasks.map((task) => task.id))
  const dependencies = mapDependencies(gan.tasks.task, taskIds, changed, skipped)
  const resources: Resource[] = gan.resources.resource.map(({ id, name }) => ({ id, name }))
  const assignments = mapAssignments(gan, taskIds, new Set(resources.map((r) => r.id)), skipped)

  for (const property of gan.tasks.taskproperties.taskproperty) {
    if (property.type === 'custom') skipped.push({ code: 'custom-property', name: property.name })
  }
  for (const baseline of gan.previous['previous-tasks']) {
    skipped.push({ code: 'baseline', name: baseline.name })
  }

  const candidate = {
    id: options.projectId,
    name: gan.name,
    area: options.area ?? 'work',
    calendar,
    tasks,
    dependencies,
    resources,
    assignments,
    documents: [],
  }
  const validated = projectSchema.safeParse(candidate)
  if (!validated.success) {
    return err({
      type: 'invalid-project',
      issues: validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    })
  }

  return ok({
    project: validated.data,
    report: {
      imported: {
        tasks: tasks.length,
        dependencies: dependencies.length,
        resources: resources.length,
        assignments: assignments.length,
        holidays: calendar.holidays.length,
      },
      changed,
      skipped,
    },
  })
}

function mapCalendar(gan: GanDocument, changed: ImportChange[], skipped: ImportSkip[]): Calendar {
  // In GanttProject's default week, "1" marks a weekend day and "0" a working day.
  const week = gan.calendars['day-types']?.['default-week']
  let workingDays = week
    ? WEEKDAY_KEYS.flatMap((key, weekday) => (week[key] === '0' ? [weekday] : []))
    : []
  if (workingDays.length === 0) {
    changed.push({ code: 'default-work-week' })
    workingDays = MONDAY_TO_FRIDAY
  }

  const holidays: Calendar['holidays'] = []
  for (const day of gan.calendars.date) {
    if (day.type !== 'HOLIDAY') {
      skipped.push({ code: 'unsupported-calendar-day', type: day.type })
    } else if (day.year === '') {
      skipped.push({
        code: 'recurring-holiday',
        month: day.month,
        day: day.date,
        name: day['#text'],
      })
    } else {
      const date = toDate(day.year, day.month, day.date)
      if (date === null) {
        skipped.push({ code: 'invalid-holiday', year: day.year, month: day.month, day: day.date })
      } else {
        holidays.push(day['#text'] === '' ? { date } : { date, name: day['#text'] })
      }
    }
  }
  return { workingDays, holidays }
}

function toDate(year: string, month: string, day: string): IsoDate | null {
  const text = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && isIsoDate(text)
    ? formatIsoDate({ year: Number(year), month: Number(month), day: Number(day) })
    : null
}

function mapTasks(
  roots: readonly GanTask[],
  changed: ImportChange[],
  skipped: ImportSkip[],
): Task[] {
  const tasks: Task[] = []
  const seen = new Set<string>()

  const skipSubtree = (task: GanTask, reason: 'parent-skipped'): void => {
    for (const child of task.task) {
      skipped.push({ code: 'invalid-task', taskId: child.id, reason })
      skipSubtree(child, reason)
    }
  }

  const visit = (siblings: readonly GanTask[], parentId: string | undefined): void => {
    let order = 0
    for (const gan of siblings) {
      const start = gan.start
      const reason = seen.has(gan.id)
        ? 'duplicate-id'
        : !/^-?\d+$/.test(gan.duration)
          ? 'invalid-duration'
          : null
      if (reason !== null || !isIsoDate(start)) {
        skipped.push({ code: 'invalid-task', taskId: gan.id, reason: reason ?? 'invalid-start' })
        skipSubtree(gan, 'parent-skipped')
        continue
      }
      seen.add(gan.id)

      const isMilestone = gan.meeting === 'true'
      let duration = Number(gan.duration)
      if (isMilestone && duration !== 0) {
        changed.push({
          code: 'milestone-duration-reset',
          taskId: gan.id,
          originalDuration: duration,
        })
        duration = 0
      } else if (!isMilestone && duration < 1) {
        changed.push({ code: 'zero-duration-raised', taskId: gan.id })
        duration = 1
      }

      const task: Task = {
        id: gan.id,
        name: gan.name,
        start,
        duration,
        progress: mapProgress(gan, changed),
        isMilestone,
        order: order++,
        ...(parentId === undefined ? {} : { parentId }),
        ...(gan.notes === undefined || gan.notes === ''
          ? {}
          : { notes: textToDocument(gan.notes) }),
      }
      const link = mapLink(gan.webLink)
      if (link === null) skipped.push({ code: 'invalid-link', taskId: gan.id })
      else if (link !== undefined) task.link = link
      tasks.push(task)

      visit(gan.task, gan.id)
    }
  }

  visit(roots, undefined)
  return tasks
}

function mapProgress(gan: GanTask, changed: ImportChange[]): number {
  if (gan.complete === undefined) return 0
  const value = Number(gan.complete)
  const progress = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0
  if (String(progress) !== gan.complete) {
    changed.push({ code: 'progress-adjusted', taskId: gan.id, original: gan.complete })
  }
  return progress
}

/** undefined: no link; null: a link that is not a valid URL. */
function mapLink(webLink: string | undefined): string | null | undefined {
  if (webLink === undefined || webLink === '') return undefined
  let decoded: string
  try {
    decoded = decodeURIComponent(webLink)
  } catch {
    return null
  }
  return urlSchema.safeParse(decoded).success ? decoded : null
}

/** Plain-text notes become an editor document with one paragraph per line. */
function textToDocument(text: string): NonNullable<Task['notes']> {
  return {
    type: 'doc',
    content: text
      .split(/\r?\n/)
      .map((line) =>
        line === ''
          ? { type: 'paragraph' }
          : { type: 'paragraph', content: [{ type: 'text', text: line }] },
      ),
  }
}

function mapDependencies(
  roots: readonly GanTask[],
  taskIds: ReadonlySet<string>,
  changed: ImportChange[],
  skipped: ImportSkip[],
): Dependency[] {
  const dependencies: Dependency[] = []
  const seen = new Set<string>()

  const visit = (tasks: readonly GanTask[]): void => {
    for (const task of tasks) {
      for (const depend of task.depend) {
        const from = task.id
        const to = depend.id
        const key = `${from}->${to}`
        if (from === to) {
          skipped.push({ code: 'self-dependency', taskId: from })
        } else if (!taskIds.has(from) || !taskIds.has(to)) {
          skipped.push({ code: 'dangling-dependency', from, to })
        } else if (seen.has(key)) {
          skipped.push({ code: 'duplicate-dependency', from, to })
        } else {
          seen.add(key)
          const kind = DEPENDENCY_KINDS[depend.type] ?? 'unknown'
          if (kind !== 'finish-to-start') {
            changed.push({ code: 'dependency-type-converted', from, to, original: kind })
          }
          let lag = Number(depend.difference)
          if (!Number.isInteger(lag)) {
            changed.push({ code: 'lag-reset', from, to, original: depend.difference })
            lag = 0
          }
          dependencies.push({ id: key, from, to, type: 'finish-to-start', lag })
        }
      }
      visit(task.task)
    }
  }

  visit(roots)
  return dependencies
}

function mapAssignments(
  gan: GanDocument,
  taskIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  skipped: ImportSkip[],
): Assignment[] {
  const assignments: Assignment[] = []
  for (const allocation of gan.allocations.allocation) {
    const taskId = allocation['task-id']
    const resourceId = allocation['resource-id']
    if (taskIds.has(taskId) && resourceIds.has(resourceId)) {
      assignments.push({ id: `${taskId}:${resourceId}`, taskId, resourceId })
    } else {
      skipped.push({ code: 'dangling-assignment', taskId, resourceId })
    }
  }
  return assignments
}
