import { describe, expect, it } from 'vitest'
import { toIsoDate } from '../../core/dates.ts'
import { projectSchema } from '../../core/model.ts'
import { mentionedTaskIds } from '../../core/rich-text.ts'
import { createDemoProject } from './coffee-shop-demo.ts'

describe('demo project', () => {
  const project = createDemoProject(toIsoDate('2026-11-18'))

  it('is a valid project', () => {
    expect(projectSchema.safeParse(project).success).toBe(true)
  })

  it('has documents in order that only mention its own tasks', () => {
    const taskIds = new Set(project.tasks.map((task) => task.id))
    expect(project.documents.map((document) => document.order)).toEqual([0, 1, 2, 3, 4])
    for (const document of project.documents) {
      for (const id of mentionedTaskIds(document.content)) expect(taskIds).toContain(id)
    }
    expect(mentionedTaskIds(project.documents[0]?.content)).toEqual(['13', '8', '11', '7', '6'])
  })

  it('dates its documents back from the day it is opened', () => {
    expect(project.documents.map((document) => document.updatedAt?.slice(0, 10))).toEqual([
      '2026-11-18',
      '2026-11-16',
      '2026-11-14',
      '2026-11-11',
      '2026-11-04',
    ])
  })
})
