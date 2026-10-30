/**
 * Edits to a project, written as Immer recipes: each returns a function that mutates a
 * draft. The store runs them through the history, which records patches for undo.
 * Validation happens afterwards against the project schema, so a recipe never needs to
 * guard against producing an invalid project; the store refuses the result instead.
 */
import type { Draft } from 'immer'
import { clampDate, type IsoDate } from '../../core/dates.ts'
import {
  MAX_DURATION,
  type Area,
  type Project,
  type Task,
  type TaskType,
} from '../../core/model.ts'

export type Recipe = (draft: Draft<Project>) => void

export type TaskInput = {
  readonly name: string
  readonly type: TaskType | null
  readonly start: IsoDate
  /** Workdays; ignored for milestones. */
  readonly duration: number
  readonly isMilestone: boolean
  readonly progress: number
  /** Free-text notes; blank clears them. */
  readonly notes: string
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

/** Renames the project; a blank name is ignored. */
export function renameProject(name: string): Recipe {
  return (draft) => {
    const label = name.trim()
    if (label !== '') draft.name = label
  }
}

/** Whole workdays, at least one and at most the longest the model allows. */
function workdaysOf(duration: number): number {
  return Math.min(MAX_DURATION, Math.max(1, Math.round(duration)))
}

function applyTaskInput(task: Draft<Task>, input: TaskInput, isSummary: boolean): void {
  task.name = input.name.trim()
  if (input.type === null) delete task.type
  else task.type = input.type
  const notes = input.notes.trim()
  if (notes === '') delete task.notes
  else task.notes = notes
  if (isSummary) return
  task.start = clampDate(input.start)
  task.isMilestone = input.isMilestone
  task.duration = input.isMilestone ? 0 : workdaysOf(input.duration)
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
      start: clampDate(input.start),
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

/** Adds a task as the last subtask of `parentId`. */
export function addSubtask(id: string, input: TaskInput, parentId: string): Recipe {
  return (draft) => {
    if (!draft.tasks.some((task) => task.id === parentId)) return
    const task: Draft<Task> = {
      id,
      name: '',
      start: clampDate(input.start),
      duration: 1,
      progress: 0,
      isMilestone: false,
      order: siblingsOf(draft, parentId).length,
      parentId,
    }
    applyTaskInput(task, input, false)
    draft.tasks.push(task)
  }
}

/** Makes a task the last subtask of the sibling right above it. */
export function indentTask(id: string): Recipe {
  return (draft) => {
    const task = draft.tasks.find((candidate) => candidate.id === id)
    if (!task) return
    const siblings = siblingsOf(draft, task.parentId)
    const above = siblings[siblings.indexOf(task) - 1]
    if (!above || above.isMilestone) return
    const oldParent = task.parentId
    task.parentId = above.id
    task.order = siblingsOf(draft, above.id).length - 1
    siblingsOf(draft, oldParent).forEach((sibling, index) => {
      sibling.order = index
    })
  }
}

/** Moves a task, with its subtasks, to be the last child of `parentId` (null: top level). */
export function setParent(id: string, parentId: string | null): Recipe {
  return (draft) => {
    const task = draft.tasks.find((candidate) => candidate.id === id)
    const parent = draft.tasks.find((candidate) => candidate.id === parentId)
    if (!task || (parentId !== null && (!parent || parent.isMilestone))) return
    if (parentId !== null && subtreeOf(draft, id).has(parentId)) return
    if (task.parentId === (parentId ?? undefined)) return
    const oldParent = task.parentId
    task.order = siblingsOf(draft, parentId ?? undefined).length
    if (parentId === null) delete task.parentId
    else task.parentId = parentId
    siblingsOf(draft, oldParent).forEach((sibling, index) => {
      sibling.order = index
    })
  }
}

/** Moves a subtask up one level, to sit right after the task it was under. */
export function outdentTask(id: string): Recipe {
  return (draft) => {
    const task = draft.tasks.find((candidate) => candidate.id === id)
    const parent = draft.tasks.find((candidate) => candidate.id === task?.parentId)
    if (!task || !parent) return
    const oldParent = parent.id
    const grandParent = parent.parentId
    const target = siblingsOf(draft, grandParent).filter((sibling) => sibling.id !== id)
    target.splice(target.indexOf(parent) + 1, 0, task)
    if (grandParent === undefined) delete task.parentId
    else task.parentId = grandParent
    target.forEach((sibling, index) => {
      sibling.order = index
    })
    siblingsOf(draft, oldParent).forEach((sibling, index) => {
      sibling.order = index
    })
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
    task.start = clampDate(start)
    task.duration = task.isMilestone ? 0 : workdaysOf(duration)
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

/**
 * Puts a task right before or after one of its siblings, and renumbers the group. Its own
 * subtasks stay under it, so moving a summary task moves the whole branch.
 */
export function moveTask(id: string, targetId: string, place: 'before' | 'after'): Recipe {
  return (draft) => {
    const task = draft.tasks.find((candidate) => candidate.id === id)
    const target = draft.tasks.find((candidate) => candidate.id === targetId)
    if (!task || !target || id === targetId || task.parentId !== target.parentId) return
    const others = siblingsOf(draft, task.parentId).filter((sibling) => sibling.id !== id)
    others.splice(others.indexOf(target) + (place === 'after' ? 1 : 0), 0, task)
    others.forEach((sibling, index) => {
      sibling.order = index
    })
  }
}

/**
 * Like `moveTask`, but the target may be in another group: the task joins the target's
 * group, so dropping a subtask next to a top-level task takes it out of its parent.
 */
export function placeTask(id: string, targetId: string, place: 'before' | 'after'): Recipe {
  return (draft) => {
    const task = draft.tasks.find((candidate) => candidate.id === id)
    const target = draft.tasks.find((candidate) => candidate.id === targetId)
    if (!task || !target || subtreeOf(draft, id).has(targetId)) return
    const oldParent = task.parentId
    if (target.parentId === undefined) delete task.parentId
    else task.parentId = target.parentId
    const others = siblingsOf(draft, target.parentId).filter((sibling) => sibling.id !== id)
    others.splice(others.indexOf(target) + (place === 'after' ? 1 : 0), 0, task)
    others.forEach((sibling, index) => {
      sibling.order = index
    })
    if (oldParent !== target.parentId) {
      siblingsOf(draft, oldParent).forEach((sibling, index) => {
        sibling.order = index
      })
    }
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

/**
 * Makes `taskId` wait for exactly the tasks in `fromIds` (finish-to-start). Dependencies
 * that stay keep their lag; new ones start with none.
 */
export function setPredecessors(
  taskId: string,
  fromIds: readonly string[],
  newId: () => string,
): Recipe {
  return (draft) => {
    const wanted = new Set(fromIds)
    const kept = new Set<string>()
    draft.dependencies = draft.dependencies.filter((dependency) => {
      if (dependency.to !== taskId) return true
      if (!wanted.has(dependency.from) || kept.has(dependency.from)) return false
      kept.add(dependency.from)
      return true
    })
    for (const from of wanted) {
      if (kept.has(from) || from === taskId) continue
      draft.dependencies.push({ id: newId(), from, to: taskId, type: 'finish-to-start', lag: 0 })
    }
  }
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
