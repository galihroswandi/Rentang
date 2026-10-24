/**
 * Progress and status, derived from the project and its schedule. "Today" is passed in,
 * since core never reads the clock.
 */
import type { Project, Task, TaskId } from './model.ts'
import type { IsoDate } from './dates.ts'
import type { Schedule } from './schedule.ts'

export type TaskStatus = 'not-started' | 'in-progress' | 'done' | 'late'

export type ProjectSummary = {
  readonly taskCount: number
  /** Progress of the whole project, 0-100, weighted by workday duration. */
  readonly progress: number
  /** Leaf tasks that should have ended before today but are not done. */
  readonly lateCount: number
  readonly start: IsoDate | null
  readonly end: IsoDate | null
}

export function taskStatus(progress: number, end: IsoDate, today: IsoDate): TaskStatus {
  if (progress >= 100) return 'done'
  if (end < today) return 'late'
  return progress > 0 ? 'in-progress' : 'not-started'
}

/**
 * Weighted mean of leaf progress, weighted by duration so a long task counts more than a
 * short one. Milestones weigh nothing unless only milestones are present.
 */
function weightedProgress(leaves: readonly Task[]): number {
  if (leaves.length === 0) return 0
  const weight = leaves.reduce((sum, leaf) => sum + leaf.duration, 0)
  const total =
    weight === 0
      ? leaves.reduce((sum, leaf) => sum + leaf.progress, 0) / leaves.length
      : leaves.reduce((sum, leaf) => sum + leaf.progress * leaf.duration, 0) / weight
  return Math.round(total)
}

/** Progress for every task; a summary task rolls up its leaves. */
export function rollUpProgress(project: Pick<Project, 'tasks'>): ReadonlyMap<TaskId, number> {
  const childrenOf = new Map<TaskId, Task[]>()
  for (const task of project.tasks) {
    if (task.parentId === undefined) continue
    const siblings = childrenOf.get(task.parentId)
    if (siblings) siblings.push(task)
    else childrenOf.set(task.parentId, [task])
  }
  const leavesOf = (task: Task): Task[] => {
    const children = childrenOf.get(task.id)
    return children ? children.flatMap(leavesOf) : [task]
  }
  return new Map(project.tasks.map((task) => [task.id, weightedProgress(leavesOf(task))]))
}

export function summarizeProject(
  project: Project,
  schedule: Schedule,
  today: IsoDate,
): ProjectSummary {
  const parentIds = new Set(project.tasks.map((task) => task.parentId))
  const leaves = project.tasks.filter((task) => !parentIds.has(task.id))
  const lateCount = leaves.filter((task) => {
    const dates = schedule.tasks.get(task.id)
    return dates !== undefined && taskStatus(task.progress, dates.end, today) === 'late'
  }).length
  return {
    taskCount: project.tasks.length,
    progress: weightedProgress(leaves),
    lateCount,
    start: schedule.projectStart,
    end: schedule.projectEnd,
  }
}
