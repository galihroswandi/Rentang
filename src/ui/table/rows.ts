/**
 * Rows shared by the task table and the Gantt chart: the task tree flattened in sibling
 * order, with WBS numbers, computed dates and status. Collapsed subtrees are left out.
 */
import type { CriticalPath } from '../../core/critical-path.ts'
import type { IsoDate } from '../../core/dates.ts'
import type { Project, Task, TaskId, TaskType } from '../../core/model.ts'
import { taskStatus, type TaskStatus } from '../../core/summary.ts'
import { initialsOf } from '../resource/people.ts'

export type TaskRow = {
  readonly id: TaskId
  readonly name: string
  readonly type: TaskType | null
  /** People assigned to the task. */
  readonly people: readonly {
    readonly id: string
    readonly name: string
    readonly initials: string
  }[]
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

/** What the type filter calls a task: its type, or "MS" for any milestone. */
export type TypeKey = TaskType | 'MS'

export type RowFilter = {
  readonly hiddenTypes: ReadonlySet<TypeKey>
  /** Hides finished tasks; milestones stay, since reaching one is worth seeing. */
  readonly hideDone: boolean
}

export const NO_FILTER: RowFilter = { hiddenTypes: new Set(), hideDone: false }

export function typeKeyOf(task: Pick<Task, 'isMilestone' | 'type'>): TypeKey | null {
  return task.isMilestone ? 'MS' : (task.type ?? null)
}

/** How many tasks carry each type, for the counts beside the filter's checkboxes. */
export function countTypes(
  tasks: readonly Pick<Task, 'isMilestone' | 'type'>[],
): Record<TypeKey, number> {
  const counts: Record<TypeKey, number> = { IMP: 0, DOC: 0, DSG: 0, BUG: 0, FIX: 0, REV: 0, MS: 0 }
  for (const task of tasks) {
    const key = typeKeyOf(task)
    if (key) counts[key] += 1
  }
  return counts
}

/** How many filter settings are on, for the badge on the filter button. */
export function activeFilters(filter: RowFilter): number {
  return filter.hiddenTypes.size + (filter.hideDone ? 1 : 0)
}

export type RowInput = {
  readonly project: Pick<Project, 'tasks'> & Partial<Pick<Project, 'resources' | 'assignments'>>
  readonly analysis: CriticalPath | null
  readonly progress: ReadonlyMap<TaskId, number>
  readonly collapsed: ReadonlySet<TaskId>
  readonly today: IsoDate
  readonly filter?: RowFilter
}

export function buildTaskRows({
  project,
  analysis,
  progress,
  collapsed,
  today,
  filter = NO_FILTER,
}: RowInput): TaskRow[] {
  const childrenOf = new Map<string | null, Task[]>()
  for (const task of project.tasks) {
    const key = task.parentId ?? null
    const siblings = childrenOf.get(key)
    if (siblings) siblings.push(task)
    else childrenOf.set(key, [task])
  }
  for (const siblings of childrenOf.values()) siblings.sort((a, b) => a.order - b.order)

  const names = new Map((project.resources ?? []).map((resource) => [resource.id, resource.name]))
  const peopleOf = new Map<TaskId, { id: string; name: string; initials: string }[]>()
  for (const assignment of project.assignments ?? []) {
    const name = names.get(assignment.resourceId)
    if (name === undefined) continue
    const person = { id: assignment.resourceId, name, initials: initialsOf(name) }
    const list = peopleOf.get(assignment.taskId)
    if (list) list.push(person)
    else peopleOf.set(assignment.taskId, [person])
  }

  // A task stays when it passes the filter itself; a summary task stays while anything
  // below it does, so a visible task never loses its place in the outline.
  const shown = new Map<TaskId, boolean>()
  const isShown = (task: Task): boolean => {
    const known = shown.get(task.id)
    if (known !== undefined) return known
    const children = childrenOf.get(task.id)
    let result: boolean
    if (children) {
      result = children.some(isShown)
    } else {
      const key = typeKeyOf(task)
      const done = !task.isMilestone && (progress.get(task.id) ?? task.progress) >= 100
      result = !(key && filter.hiddenTypes.has(key)) && !(filter.hideDone && done)
    }
    shown.set(task.id, result)
    return result
  }

  const rows: TaskRow[] = []
  const visit = (parentId: TaskId | null, prefix: string, level: number): void => {
    const all = childrenOf.get(parentId) ?? []
    // Outline numbers come from the full list, so a task keeps its number while filtered.
    const siblings = all.filter(isShown)
    siblings.forEach((task, shownIndex) => {
      const index = all.indexOf(task)
      const wbs = `${prefix}${String(index + 1)}`
      const isSummary = childrenOf.has(task.id)
      const dates = analysis?.schedule.tasks.get(task.id)
      const taskProgress = progress.get(task.id) ?? task.progress
      const expanded = isSummary && !collapsed.has(task.id)
      rows.push({
        id: task.id,
        name: task.name,
        type: task.type ?? null,
        people: peopleOf.get(task.id) ?? [],
        wbs,
        level,
        parentId,
        positionInSet: shownIndex + 1,
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
