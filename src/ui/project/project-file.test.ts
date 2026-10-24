import { describe, expect, it } from 'vitest'
import { loadProjectFile } from '../../core/migrations.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { projectFileName, serializeProject } from './project-file.ts'

describe('serializeProject', () => {
  it('writes text that loads back to the same project', () => {
    const project = coffeeShopProject()
    const loaded = loadProjectFile(JSON.parse(serializeProject(project)))
    expect(loaded.ok && loaded.value.project).toEqual(project)
  })
})

describe('projectFileName', () => {
  it('turns the name into a safe file name', () => {
    expect(projectFileName('Kedai Kopi / Tahap 1')).toBe('Kedai-Kopi-Tahap-1.rentang')
    expect(projectFileName('  ***  ')).toBe('proyek.rentang')
  })
})
