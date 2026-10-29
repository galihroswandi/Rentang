import { describe, expect, it } from 'vitest'
import { toIsoDate } from './dates.ts'
import {
  CURRENT_SCHEMA_VERSION,
  MAX_DURATION,
  MAX_LAG,
  noteTextOf,
  projectFileSchema,
  projectSchema,
  type Project,
  type Task,
} from './model.ts'
import { coffeeShopProject } from './test-utils/coffee-shop.ts'

function issuesOf(project: unknown): string[] {
  const result = projectSchema.safeParse(project)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

function taskAt(project: Project, index: number): Task {
  const task = project.tasks[index]
  if (!task) throw new Error(`No task at ${String(index)}`)
  return task
}

function withChanges(change: (project: Project) => void): Project {
  const project = structuredClone(coffeeShopProject())
  change(project)
  return project
}

describe('projectSchema', () => {
  it('accepts the golden project with resources, assignments and documents', () => {
    const project = withChanges((p) => {
      p.resources.push({ id: 'r1', name: 'Barista Fiktif' })
      p.assignments.push({ id: 'a1', taskId: '10', resourceId: 'r1' })
      p.documents.push({
        id: 'doc1',
        title: 'Catatan peluncuran',
        content: { type: 'doc', content: [] },
        order: 0,
      })
      p.calendar.holidays.push({ date: toIsoDate('2026-12-25'), name: 'Libur fiktif' })
      taskAt(p, 1).link = 'https://example.com/survei'
      taskAt(p, 1).notes = { type: 'doc', content: [{ type: 'paragraph' }] }
    })
    expect(issuesOf(project)).toEqual([])
  })

  it('rejects malformed dates and durations', () => {
    expect(issuesOf(withChanges((p) => (taskAt(p, 1).start = '2026-02-30' as never)))).toContain(
      "Expected a 'YYYY-MM-DD' date from 1970 to 2100",
    )
    expect(issuesOf(withChanges((p) => (taskAt(p, 1).duration = 0)))).toContain(
      'Milestones last 0 workdays; other tasks at least 1',
    )
    expect(issuesOf(withChanges((p) => (taskAt(p, 12).duration = 1)))).toContain(
      'Milestones last 0 workdays; other tasks at least 1',
    )
  })

  it('rejects dates, durations and lags outside the supported limits', () => {
    const dateMessage = "Expected a 'YYYY-MM-DD' date from 1970 to 2100"
    expect(issuesOf(withChanges((p) => (taskAt(p, 1).start = '1969-12-31' as never)))).toContain(
      dateMessage,
    )
    expect(issuesOf(withChanges((p) => (taskAt(p, 1).start = '2101-01-01' as never)))).toContain(
      dateMessage,
    )
    expect(issuesOf(withChanges((p) => (taskAt(p, 1).duration = 2_000_000_000)))).not.toEqual([])
    expect(issuesOf(withChanges((p) => (taskAt(p, 1).duration = MAX_DURATION)))).toEqual([])
    expect(
      issuesOf(
        withChanges((p) => {
          const dependency = p.dependencies[0]
          if (dependency) dependency.lag = MAX_LAG + 1
        }),
      ),
    ).not.toEqual([])
  })

  it('rejects a calendar without or with repeated working days', () => {
    expect(issuesOf(withChanges((p) => (p.calendar.workingDays = [])))).not.toEqual([])
    expect(issuesOf(withChanges((p) => (p.calendar.workingDays = [1, 1])))).toContain(
      'Working days must be unique',
    )
  })

  it('rejects duplicate ids', () => {
    expect(issuesOf(withChanges((p) => (taskAt(p, 2).id = '2')))).toContain('Duplicate id "2"')
  })

  it('rejects unknown and impossible parents', () => {
    expect(issuesOf(withChanges((p) => (taskAt(p, 1).parentId = 'nope')))).toContain(
      'Unknown parent "nope"',
    )
    expect(issuesOf(withChanges((p) => (taskAt(p, 1).parentId = '13')))).toContain(
      'A milestone cannot have subtasks',
    )
    expect(issuesOf(withChanges((p) => (taskAt(p, 0).parentId = '2')))).toContain(
      'Task "1" is its own ancestor',
    )
    expect(issuesOf(withChanges((p) => (taskAt(p, 0).parentId = '1')))).toContain(
      'Task "1" is its own ancestor',
    )
  })

  it('rejects dependencies and assignments pointing nowhere', () => {
    expect(
      issuesOf(
        withChanges((p) =>
          p.dependencies.push({ id: 'x', from: '2', to: '99', type: 'finish-to-start', lag: 0 }),
        ),
      ),
    ).toContain('Unknown task "99"')
    const assignment = withChanges((p) =>
      p.assignments.push({ id: 'a', taskId: '98', resourceId: 'r9' }),
    )
    expect(issuesOf(assignment)).toEqual(
      expect.arrayContaining(['Unknown task "98"', 'Unknown resource "r9"']),
    )
  })

  it('accepts roles and rejects resources pointing at an unknown role', () => {
    const withRole = withChanges((p) => {
      p.roles.push({ id: 'barista', name: 'Barista' })
      p.resources.push({ id: 'r1', name: 'Dimas', roleId: 'barista' })
      taskAt(p, 1).type = 'DOC'
    })
    expect(issuesOf(withRole)).toEqual([])
    expect(
      issuesOf(withChanges((p) => p.resources.push({ id: 'r1', name: 'Dimas', roleId: 'kasir' }))),
    ).toContain('Unknown role "kasir"')
    expect(issuesOf(withChanges((p) => p.roles.push({ id: 'x', name: '' })))).not.toEqual([])
  })

  it('accepts only finish-to-start dependencies', () => {
    const project = withChanges((p) => {
      ;(p.dependencies[0] as { type: string }).type = 'start-to-start'
    })
    expect(issuesOf(project)).not.toEqual([])
  })
})

describe('projectFileSchema', () => {
  it('requires the current schema version', () => {
    const project = coffeeShopProject()
    expect(
      projectFileSchema.safeParse({ schemaVersion: CURRENT_SCHEMA_VERSION, project }).success,
    ).toBe(true)
    expect(projectFileSchema.safeParse({ schemaVersion: 0, project }).success).toBe(false)
  })
})

describe('noteTextOf', () => {
  it('returns text notes and an empty string for none or non-text notes', () => {
    expect(noteTextOf({ notes: 'Halo' })).toBe('Halo')
    expect(noteTextOf({})).toBe('')
    expect(noteTextOf({ notes: { type: 'doc' } })).toBe('')
  })
})
