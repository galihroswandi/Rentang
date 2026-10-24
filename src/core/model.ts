/**
 * Domain model and its Zod schemas. Types are derived from the schemas so that
 * data read from disk is validated by the same definition the code is typed with.
 * End dates are never stored: they are computed by schedule.ts.
 */
import { z } from 'zod'
import { isIsoDate, type IsoDate } from './dates.ts'

export const CURRENT_SCHEMA_VERSION = 1

export const isoDateSchema = z.custom<IsoDate>(
  (value) => typeof value === 'string' && isIsoDate(value),
  { message: "Expected a 'YYYY-MM-DD' date" },
)

const idSchema = z.string().min(1)

export const areaSchema = z.enum(['work', 'finance', 'career'])

export const calendarSchema = z.object({
  /** Weekdays that are worked; 0 = Sunday ... 6 = Saturday. */
  workingDays: z
    .array(z.int().min(0).max(6))
    .min(1)
    .refine((days) => new Set(days).size === days.length, 'Working days must be unique'),
  holidays: z.array(z.object({ date: isoDateSchema, name: z.string().optional() })),
})

export const taskSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    /** Requested start. The scheduled start may be later because of dependencies or days off. */
    start: isoDateSchema,
    /** Length in workdays; 0 only for milestones. Ignored for summary tasks. */
    duration: z.int().min(0),
    progress: z.int().min(0).max(100),
    isMilestone: z.boolean(),
    parentId: idSchema.optional(),
    /** Position among siblings. */
    order: z.int().min(0),
    /** Rich-text notes as editor JSON. */
    notes: z.json().optional(),
    link: z.url().optional(),
  })
  .refine((task) => (task.isMilestone ? task.duration === 0 : task.duration >= 1), {
    message: 'Milestones last 0 workdays; other tasks at least 1',
    path: ['duration'],
  })

export const dependencySchema = z.object({
  id: idSchema,
  /** Predecessor task. */
  from: idSchema,
  /** Successor task. */
  to: idSchema,
  type: z.literal('finish-to-start'),
  /** Workdays between the predecessor's finish and the successor's start; negative overlaps. */
  lag: z.int(),
})

export const resourceSchema = z.object({ id: idSchema, name: z.string() })

export const assignmentSchema = z.object({ id: idSchema, taskId: idSchema, resourceId: idSchema })

export const documentSchema = z.object({
  id: idSchema,
  title: z.string(),
  content: z.json(),
  order: z.int().min(0),
})

export const projectSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    area: areaSchema,
    calendar: calendarSchema,
    tasks: z.array(taskSchema),
    dependencies: z.array(dependencySchema),
    resources: z.array(resourceSchema),
    assignments: z.array(assignmentSchema),
    documents: z.array(documentSchema),
  })
  .superRefine((project, context) => {
    for (const issue of findReferenceIssues(project)) {
      context.addIssue({ code: 'custom', message: issue.message, path: issue.path })
    }
  })

export const projectFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  project: projectSchema,
})

export type Area = z.infer<typeof areaSchema>
export type Calendar = z.infer<typeof calendarSchema>
export type Task = z.infer<typeof taskSchema>
export type Dependency = z.infer<typeof dependencySchema>
export type Resource = z.infer<typeof resourceSchema>
export type Assignment = z.infer<typeof assignmentSchema>
export type ProjectDocument = z.infer<typeof documentSchema>
export type Project = z.infer<typeof projectSchema>
export type ProjectFile = z.infer<typeof projectFileSchema>
export type TaskId = Task['id']

type ReferenceIssue = { message: string; path: (string | number)[] }

function findDuplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates]
}

function findReferenceIssues(project: {
  tasks: readonly Task[]
  dependencies: readonly Dependency[]
  resources: readonly Resource[]
  assignments: readonly Assignment[]
  documents: readonly ProjectDocument[]
}): ReferenceIssue[] {
  const issues: ReferenceIssue[] = []
  const collections = ['tasks', 'dependencies', 'resources', 'assignments', 'documents'] as const
  for (const collection of collections) {
    for (const id of findDuplicates(project[collection].map((item) => item.id))) {
      issues.push({ message: `Duplicate id "${id}"`, path: [collection] })
    }
  }

  const tasksById = new Map(project.tasks.map((task) => [task.id, task]))
  project.tasks.forEach((task, index) => {
    if (task.parentId === undefined) return
    const parent = tasksById.get(task.parentId)
    if (!parent) {
      issues.push({
        message: `Unknown parent "${task.parentId}"`,
        path: ['tasks', index, 'parentId'],
      })
    } else if (parent.isMilestone) {
      issues.push({
        message: 'A milestone cannot have subtasks',
        path: ['tasks', index, 'parentId'],
      })
    }
  })

  for (const task of project.tasks) {
    const visited = new Set<string>()
    for (let current: Task | undefined = task; current?.parentId !== undefined;) {
      if (visited.has(current.id)) {
        issues.push({ message: `Task "${task.id}" is its own ancestor`, path: ['tasks'] })
        break
      }
      visited.add(current.id)
      current = tasksById.get(current.parentId)
    }
  }

  project.dependencies.forEach((dependency, index) => {
    for (const end of ['from', 'to'] as const) {
      if (!tasksById.has(dependency[end])) {
        issues.push({
          message: `Unknown task "${dependency[end]}"`,
          path: ['dependencies', index, end],
        })
      }
    }
  })

  const resourceIds = new Set(project.resources.map((resource) => resource.id))
  project.assignments.forEach((assignment, index) => {
    if (!tasksById.has(assignment.taskId)) {
      issues.push({
        message: `Unknown task "${assignment.taskId}"`,
        path: ['assignments', index, 'taskId'],
      })
    }
    if (!resourceIds.has(assignment.resourceId)) {
      issues.push({
        message: `Unknown resource "${assignment.resourceId}"`,
        path: ['assignments', index, 'resourceId'],
      })
    }
  })

  return issues
}
