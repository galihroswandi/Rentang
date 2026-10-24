/**
 * Edits to a project, written as Immer recipes: each returns a function that mutates a
 * draft. The store runs them through the history, which records patches for undo.
 * Validation happens afterwards against the project schema, so a recipe never needs to
 * guard against producing an invalid project; the store refuses the result instead.
 */
import type { Draft } from 'immer'
import type { IsoDate } from '../../core/dates.ts'
import type { Area, Project, Task, TaskType } from '../../core/model.ts'

export type Recipe = (draft: Draft<Project>) => void

export type TaskInput = {
  readonly name: string
  readonly type: TaskType | null
  readonly start: IsoDate
  /** Workdays; ignored for milestones. */
  readonly duration: number
  readonly isMilestone: boolean
  readonly progress: number
}

export function createProject(id: string, name: string, area: Area): Project {
  return {
    id,
    name,
    area,
    calendar: { workingDays: [1, 2, 3, 4, 5], holidays: [] },
    tasks: [],
    dependencies: [],
    roles: [],
    resources: [],
    assignments: [],
    documents: [],
  }
}

function applyTaskInput(task: Draft<Task>, input: TaskInput, isSummary: boolean): void {
  task.name = input.name.trim()
  if (input.type === null) delete task.type
  else task.type = input.type
  if (isSummary) return
  task.start = input.start
  task.isMilestone = input.isMilestone
  task.duration = input.isMilestone ? 0 : Math.max(1, Math.round(input.duration))
  task.progress = Math.min(100, Math.max(0, Math.round(input.progress)))
}

function siblingsOf(draft: Draft<Project>, parentId: string | undefined): Draft<Task>[] {
  return draft.tasks.filter((task) => task.parentId === parentId).sort((a, b) => a.order - b.order)
}

/** Adds a task right after `afterId` among its siblings, or at the end of the top level. */
export function addTask(id: string, input: TaskInput, afterId: string | null): Recipe {
  return (draft) => {
    const after = draft.tasks.find((task) => task.id === afterId)
    const parentId = after?.parentId
    const siblings = siblingsOf(draft, parentId)
    const order = after ? after.order + 1 : siblings.length
    for (const sibling of siblings) if (sibling.order >= order) sibling.order += 1
    const task: Draft<Task> = {
      id,
      name: '',
      start: input.start,
      duration: 1,
      progress: 0,
      isMilestone: false,
      order,
      ...(parentId === undefined ? {} : { parentId }),
    }
    applyTaskInput(task, input, false)
    draft.tasks.push(task)
  }
}

export function updateTask(id: string, input: TaskInput): Recipe {
  return (draft) => {
    const task = draft.tasks.find((candidate) => candidate.id === id)
    if (!task) return
    const isSummary = draft.tasks.some((candidate) => candidate.parentId === id)
    applyTaskInput(task, input, isSummary)
  }
}

/** Sets when a task starts and how many workdays it lasts, as a drag on the Gantt does. */
export function reschedule(id: string, start: IsoDate, duration: number): Recipe {
  return (draft) => {
    const task = draft.tasks.find((candidate) => candidate.id === id)
    if (!task || draft.tasks.some((candidate) => candidate.parentId === id)) return
    task.start = start
    task.duration = task.isMilestone ? 0 : Math.max(1, Math.round(duration))
  }
}

/** Which weekdays are worked; 0 = Sunday ... 6 = Saturday. At least one must stay. */
export function setWorkingDays(days: readonly number[]): Recipe {
  return (draft) => {
    const next = [...new Set(days)].sort((a, b) => a - b)
    if (next.length === 0) return
    draft.calendar.workingDays = next
  }
}

/** Adds a day off on a date; adding the same date again only updates its name. */
export function addHoliday(date: IsoDate, name: string): Recipe {
  return (draft) => {
    const label = name.trim()
    const existing = draft.calendar.holidays.find((holiday) => holiday.date === date)
    if (existing) {
      if (label === '') delete existing.name
      else existing.name = label
      return
    }
    draft.calendar.holidays.push(label === '' ? { date } : { date, name: label })
    draft.calendar.holidays.sort((a, b) => a.date.localeCompare(b.date))
  }
}

export function removeHoliday(date: IsoDate): Recipe {
  return (draft) => {
    draft.calendar.holidays = draft.calendar.holidays.filter((holiday) => holiday.date !== date)
  }
}

/** Ids of a task and everything below it. */
export function subtreeOf(project: Pick<Project, 'tasks'>, id: string): Set<string> {
  const ids = new Set([id])
  for (let grew = true; grew;) {
    grew = false
    for (const task of project.tasks) {
      if (task.parentId !== undefined && ids.has(task.parentId) && !ids.has(task.id)) {
        ids.add(task.id)
        grew = true
      }
    }
  }
  return ids
}

/** Removes a task with its subtasks, and every dependency and assignment that touched them. */
export function deleteTask(id: string): Recipe {
  return (draft) => {
    const doomed = subtreeOf(draft, id)
    const parentId = draft.tasks.find((task) => task.id === id)?.parentId
    draft.tasks = draft.tasks.filter((task) => !doomed.has(task.id))
    draft.dependencies = draft.dependencies.filter(
      (dependency) => !doomed.has(dependency.from) && !doomed.has(dependency.to),
    )
    draft.assignments = draft.assignments.filter((assignment) => !doomed.has(assignment.taskId))
    siblingsOf(draft, parentId).forEach((task, index) => {
      task.order = index
    })
  }
}

export function addResource(id: string, name: string, roleId: string | null): Recipe {
  return (draft) => {
    draft.resources.push(roleId === null ? { id, name } : { id, name, roleId })
  }
}

export function updateResource(
  id: string,
  change: { readonly name?: string; readonly roleId?: string | null },
): Recipe {
  return (draft) => {
    const resource = draft.resources.find((candidate) => candidate.id === id)
    if (!resource) return
    if (change.name !== undefined) resource.name = change.name.trim()
    if (change.roleId === null) delete resource.roleId
    else if (change.roleId !== undefined) resource.roleId = change.roleId
  }
}

export function removeResource(id: string): Recipe {
  return (draft) => {
    draft.resources = draft.resources.filter((resource) => resource.id !== id)
    draft.assignments = draft.assignments.filter((assignment) => assignment.resourceId !== id)
  }
}

export function addRole(id: string, name: string): Recipe {
  return (draft) => {
    draft.roles.push({ id, name: name.trim() })
  }
}

export function renameRole(id: string, name: string): Recipe {
  return (draft) => {
    const role = draft.roles.find((candidate) => candidate.id === id)
    if (role) role.name = name.trim()
  }
}

/** Removes a role; people who had it keep their place in the project without a role. */
export function removeRole(id: string): Recipe {
  return (draft) => {
    draft.roles = draft.roles.filter((role) => role.id !== id)
    for (const resource of draft.resources) if (resource.roleId === id) delete resource.roleId
  }
}

export function assign(id: string, taskId: string, resourceId: string): Recipe {
  return (draft) => {
    const exists = draft.assignments.some(
      (assignment) => assignment.taskId === taskId && assignment.resourceId === resourceId,
    )
    if (!exists) draft.assignments.push({ id, taskId, resourceId })
  }
}

export function unassign(assignmentId: string): Recipe {
  return (draft) => {
    draft.assignments = draft.assignments.filter((assignment) => assignment.id !== assignmentId)
  }
}
