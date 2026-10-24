/**
 * Rows shared by the task table and the Gantt chart: the task tree flattened in sibling
 * order, with WBS numbers, computed dates and status. Collapsed subtrees are left out.
 */
import type { CriticalPath } from '../../core/critical-path.ts'
import type { IsoDate } from '../../core/dates.ts'
import type { Project, Task, TaskId } from '../../core/model.ts'
import { taskStatus, type TaskStatus } from '../../core/summary.ts'

export type TaskRow = {
  readonly id: TaskId
  readonly name: string
  /** Outline number such as "2.1". */
  readonly wbs: string
  /** 1 for top-level tasks. */
  readonly level: number
  readonly parentId: TaskId | null
  readonly positionInSet: number
  readonly setSize: number
  readonly isSummary: boolean
  readonly isMilestone: boolean
  readonly expanded: boolean
  /** Null when the schedule could not be computed. */
  readonly start: IsoDate | null
  readonly end: IsoDate | null
  readonly duration: number
  readonly progress: number
  /** Null for summary tasks, whose state is the sum of their subtasks. */
  readonly status: TaskStatus | null
  readonly critical: boolean
}

export type RowInput = {
  readonly project: Pick<Project, 'tasks'>
  readonly analysis: CriticalPath | null
  readonly progress: ReadonlyMap<TaskId, number>
  readonly collapsed: ReadonlySet<TaskId>
  readonly today: IsoDate
}

export function buildTaskRows({
  project,
  analysis,
  progress,
  collapsed,
  today,
}: RowInput): TaskRow[] {
  const childrenOf = new Map<string | null, Task[]>()
  for (const task of project.tasks) {
    const key = task.parentId ?? null
    const siblings = childrenOf.get(key)
    if (siblings) siblings.push(task)
    else childrenOf.set(key, [task])
  }
  for (const siblings of childrenOf.values()) siblings.sort((a, b) => a.order - b.order)

  const rows: TaskRow[] = []
  const visit = (parentId: TaskId | null, prefix: string, level: number): void => {
    const siblings = childrenOf.get(parentId) ?? []
    siblings.forEach((task, index) => {
      const wbs = `${prefix}${String(index + 1)}`
      const isSummary = childrenOf.has(task.id)
      const dates = analysis?.schedule.tasks.get(task.id)
      const taskProgress = progress.get(task.id) ?? task.progress
      const expanded = isSummary && !collapsed.has(task.id)
      rows.push({
        id: task.id,
        name: task.name,
        wbs,
        level,
        parentId,
        positionInSet: index + 1,
        setSize: siblings.length,
        isSummary,
        isMilestone: task.isMilestone,
        expanded,
        start: dates?.start ?? null,
        end: dates?.end ?? null,
        duration: task.duration,
        progress: taskProgress,
        status: isSummary || !dates ? null : taskStatus(taskProgress, dates.end, today),
        critical: analysis?.critical.has(task.id) ?? false,
      })
      if (expanded) visit(task.id, `${wbs}.`, level + 1)
    })
  }
  visit(null, '', 1)
  return rows
}
