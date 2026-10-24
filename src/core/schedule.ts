/**
 * Scheduling: a project goes in, computed dates come out. Nothing is stored.
 *
 * A leaf task starts on the first workday on or after the later of its requested start
 * and the earliest start its predecessors allow. It ends `duration` workdays later,
 * counting the start day. A milestone has no length: it sits at the start of its day.
 * A summary task spans its subtasks.
 */
import { createWorkCalendar, type WorkCalendar } from './calendar.ts'
import { maxDate, minDate, type IsoDate } from './dates.ts'
import { buildLeafGraph, type CycleError, type LeafGraph } from './graph.ts'
import type { Project, Task, TaskId } from './model.ts'
import { ok, type Result } from './result.ts'

export type ScheduledTask = {
  readonly start: IsoDate
  /** Last workday of the task. A milestone ends on its start day. */
  readonly end: IsoDate
  readonly isSummary: boolean
}

export type Schedule = {
  readonly tasks: ReadonlyMap<TaskId, ScheduledTask>
  readonly projectStart: IsoDate | null
  readonly projectEnd: IsoDate | null
}

export type ScheduleInput = Pick<Project, 'tasks' | 'dependencies' | 'calendar'>

export type ScheduleError = CycleError

/** Last workday of a task that starts on `start`. */
export function endOf(calendar: WorkCalendar, start: IsoDate, duration: number): IsoDate {
  return duration === 0 ? start : calendar.addWorkdays(start, duration - 1)
}

/**
 * The first moment a successor may start: the next workday after a task's end, or the
 * milestone's own day, since a milestone takes no time.
 */
export function releaseOf(calendar: WorkCalendar, start: IsoDate, duration: number): IsoDate {
  return duration === 0 ? start : calendar.addWorkdays(endOf(calendar, start, duration), 1)
}

export function schedule(input: ScheduleInput): Result<Schedule, ScheduleError> {
  const graph = buildLeafGraph(input)
  if (!graph.ok) return graph
  return ok(scheduleGraph(input, graph.value, createWorkCalendar(input.calendar)))
}

export function scheduleGraph(
  input: ScheduleInput,
  graph: LeafGraph,
  calendar: WorkCalendar,
): Schedule {
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]))
  const scheduled = new Map<TaskId, ScheduledTask>()

  for (const id of graph.order) {
    const task = tasksById.get(id) as Task
    let earliest = task.start
    for (const edge of graph.incoming.get(id) ?? []) {
      const predecessor = scheduled.get(edge.from) as ScheduledTask
      const duration = (tasksById.get(edge.from) as Task).duration
      const release = releaseOf(calendar, predecessor.start, duration)
      earliest = maxDate(earliest, calendar.addWorkdays(release, edge.lag))
    }
    const start = calendar.nextWorkday(earliest)
    scheduled.set(id, { start, end: endOf(calendar, start, task.duration), isSummary: false })
  }

  // A summary task always has at least one leaf below it, so its span is never empty.
  const spanOf = (id: TaskId): ScheduledTask => {
    const known = scheduled.get(id)
    if (known) return known
    const spans = (graph.childrenOf.get(id) ?? []).map(spanOf)
    const span = {
      start: spans.map((child) => child.start).reduce(minDate),
      end: spans.map((child) => child.end).reduce(maxDate),
      isSummary: true,
    }
    scheduled.set(id, span)
    return span
  }
  input.tasks.forEach((task) => spanOf(task.id))

  let projectStart: IsoDate | null = null
  let projectEnd: IsoDate | null = null
  for (const id of graph.order) {
    const { start, end } = scheduled.get(id) as ScheduledTask
    projectStart = projectStart === null ? start : minDate(projectStart, start)
    projectEnd = projectEnd === null ? end : maxDate(projectEnd, end)
  }

  return { tasks: scheduled, projectStart, projectEnd }
}
