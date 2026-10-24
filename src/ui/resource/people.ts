/** People in a project as the Resource view and the task table show them. */
import type { ScheduledTask } from '../../core/schedule.ts'
import type { Project, Resource, Task } from '../../core/model.ts'

/** "Sari Wulandari" → "SW"; a single name gives its first two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const [first, second] = words
  if (second === undefined) return (first ?? '').slice(0, 2).toUpperCase()
  return `${first?.[0] ?? ''}${second[0] ?? ''}`.toUpperCase()
}

export type PersonRow = {
  readonly id: string
  readonly name: string
  readonly initials: string
  readonly roleId: string | null
  readonly roleName: string | null
  readonly taskCount: number
}

export function buildPeople(
  project: Pick<Project, 'resources' | 'roles' | 'assignments'>,
): PersonRow[] {
  const roles = new Map(project.roles.map((role) => [role.id, role.name]))
  return project.resources.map((resource: Resource) => ({
    id: resource.id,
    name: resource.name,
    initials: initialsOf(resource.name),
    roleId: resource.roleId ?? null,
    roleName: resource.roleId === undefined ? null : (roles.get(resource.roleId) ?? null),
    taskCount: project.assignments.filter((assignment) => assignment.resourceId === resource.id)
      .length,
  }))
}

export function filterPeople(people: readonly PersonRow[], query: string): PersonRow[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...people]
  return people.filter((person) =>
    `${person.name} ${person.roleName ?? ''}`.toLowerCase().includes(needle),
  )
}

export type AssignedTask = {
  readonly assignmentId: string
  readonly task: Task
  readonly dates: ScheduledTask | null
}

/** A person's tasks in schedule order. */
export function tasksOf(
  project: Pick<Project, 'tasks' | 'assignments'>,
  resourceId: string,
  schedule: ReadonlyMap<string, ScheduledTask> | null,
): AssignedTask[] {
  const tasks = new Map(project.tasks.map((task) => [task.id, task]))
  return project.assignments
    .filter((assignment) => assignment.resourceId === resourceId)
    .flatMap((assignment) => {
      const task = tasks.get(assignment.taskId)
      return task
        ? [{ assignmentId: assignment.id, task, dates: schedule?.get(task.id) ?? null }]
        : []
    })
    .sort((a, b) => (a.dates?.start ?? a.task.start).localeCompare(b.dates?.start ?? b.task.start))
}
