import { describe, expect, it } from 'vitest'
import { BLOCK_CHOICES, filterBlocks } from './blocks.ts'

const kinds = (query: string) => filterBlocks(query).map((choice) => choice.kind)

describe('filterBlocks', () => {
  it('shows every choice before anything is typed', () => {
    expect(filterBlocks(' ')).toEqual(BLOCK_CHOICES)
    expect(new Set(BLOCK_CHOICES.map((choice) => choice.kind)).size).toBe(BLOCK_CHOICES.length)
  })

  it('matches a word of the label or a keyword from its start', () => {
    expect(kinds('jud')).toEqual(['heading-1', 'heading-2'])
    expect(kinds('Daftar')).toEqual(['bullet-list', 'ordered-list', 'task-list'])
    expect(kinds('centang')).toEqual(['task-list'])
    expect(kinds('h2')).toEqual(['heading-2'])
    expect(kinds('tugas')).toEqual(['mention'])
    expect(kinds('xyz')).toEqual([])
  })
})
