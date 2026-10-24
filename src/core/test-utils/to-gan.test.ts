import { describe, expect, it } from 'vitest'
import { importGan } from '../gan/map.ts'
import { generateProject } from './generate-project.ts'
import { toGan } from './to-gan.ts'

describe('toGan', () => {
  it('round-trips a generated project through the importer', () => {
    const project = generateProject(200)
    const result = importGan(toGan(project), { projectId: project.id })
    if (!result.ok) throw new Error(JSON.stringify(result.error))
    expect(result.value.report.imported).toMatchObject({ tasks: 200, holidays: 3 })
    expect(result.value.project.dependencies).toHaveLength(project.dependencies.length)
    expect(result.value.project.tasks.map((task) => task.id)).toEqual(
      project.tasks.map((task) => task.id),
    )
  })
})
