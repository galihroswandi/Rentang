/**
 * Critical path by forward and backward pass over the work calendar.
 *
 * The forward pass is the schedule itself. The backward pass starts every task without
 * successors at the project end and pulls each predecessor as late as its successors
 * allow. Float is the number of workdays a task can slip without moving the project end;
 * leaf tasks and milestones with zero float are critical. Summary tasks are never marked,
 * they are critical only through their subtasks.
 */
import { createWorkCalendar, type WorkCalendar } from './calendar.ts'
import { minDate, type IsoDate } from './dates.ts'
import { buildLeafGraph, type LeafGraph } from './graph.ts'
import type { Task, TaskId } from './model.ts'
import { ok, type Result } from './result.ts'
import {
  scheduleGraph,
  type Schedule,
  type ScheduledTask,
  type ScheduleError,
  type ScheduleInput,
} from './schedule.ts'

export type CriticalPath = {
  readonly schedule: Schedule
  /** Leaf tasks with zero float. */
  readonly critical: ReadonlySet<TaskId>
  /** Workdays each leaf task can slip without delaying the project end. */
  readonly float: ReadonlyMap<TaskId, number>
}

export function analyzeCriticalPath(input: ScheduleInput): Result<CriticalPath, ScheduleError> {
  const graph = buildLeafGraph(input)
  if (!graph.ok) return graph
  const calendar = createWorkCalendar(input.calendar)
  const schedule = scheduleGraph(input, graph.value, calendar)
  return ok(backwardPass(input, graph.value, calendar, schedule))
}

function backwardPass(
  input: ScheduleInput,
  graph: LeafGraph,
  calendar: WorkCalendar,
  schedule: Schedule,
): CriticalPath {
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]))
  const latestStart = new Map<TaskId, IsoDate>()
  const float = new Map<TaskId, number>()
  const critical = new Set<TaskId>()
  const projectEnd = schedule.projectEnd

  for (const id of [...graph.order].reverse()) {
    const { duration } = tasksById.get(id) as Task
    const { start } = schedule.tasks.get(id) as ScheduledTask

    // The latest moment this task may hand over to its successors.
    let latestRelease: IsoDate | null = null
    for (const edge of graph.outgoing.get(id) ?? []) {
      const successorStart = latestStart.get(edge.to) as IsoDate
      const release = calendar.addWorkdays(successorStart, -edge.lag)
      latestRelease = latestRelease === null ? release : minDate(latestRelease, release)
    }

    let latest: IsoDate
    if (duration === 0) {
      latest = latestRelease ?? (projectEnd as IsoDate)
    } else {
      const latestEnd =
        latestRelease === null ? (projectEnd as IsoDate) : calendar.addWorkdays(latestRelease, -1)
      latest = calendar.addWorkdays(latestEnd, -(duration - 1))
    }
    latestStart.set(id, latest)

    const slack = calendar.workdaysBetween(start, latest)
    float.set(id, slack)
    if (slack <= 0) critical.add(id)
  }

  return { schedule, critical, float }
}
