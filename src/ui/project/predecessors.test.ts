import { describe, expect, it } from 'vitest'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import { predecessorIds, predecessorOptions } from './predecessors.ts'

const project = coffeeShopProject()

describe('predecessorOptions', () => {
  it('offers every task but the task itself and its subtree', () => {
    const ids = predecessorOptions(project, '5').map((option) => option.id)
    expect(ids).not.toContain('5')
    expect(ids).not.toContain('6')
    expect(ids).toContain('2')
  })

  it('leaves out tasks that already wait for this one', () => {
    const ids = predecessorOptions(project, '3').map((option) => option.id)
    expect(ids).not.toContain('6')
    expect(ids).not.toContain('13')
    expect(ids).toContain('2')
  })

  it('offers everything for a task that does not exist yet', () => {
    expect(predecessorOptions(project, null)).toHaveLength(project.tasks.length)
  })

  it('indents subtasks by their depth', () => {
    const labels = predecessorOptions(project, null).map((option) => option.label)
    expect(labels).toContain('Persiapan')
    expect(labels).toContain('— Survei lokasi')
  })
})

describe('predecessorIds', () => {
  it('lists what a task waits for now', () => {
    expect(predecessorIds(project, '11').sort()).toEqual(['10', '8'])
    expect(predecessorIds(project, '1')).toEqual([])
  })
})
