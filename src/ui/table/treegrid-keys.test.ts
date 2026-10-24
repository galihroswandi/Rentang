import { describe, expect, it } from 'vitest'
import type { TaskRow } from './rows.ts'
import { treegridAction } from './treegrid-keys.ts'

function row(
  id: string,
  parentId: string | null,
  isSummary = false,
  expanded = isSummary,
): TaskRow {
  return {
    id,
    name: id,
    type: null,
    people: [],
    wbs: id,
    level: parentId === null ? 1 : 2,
    parentId,
    positionInSet: 1,
    setSize: 1,
    isSummary,
    isMilestone: false,
    expanded,
    start: null,
    end: null,
    duration: 1,
    progress: 0,
    status: null,
    critical: false,
  }
}

// p (open) > a, b; q (closed); r
const rows = [
  row('p', null, true),
  row('a', 'p'),
  row('b', 'p'),
  row('q', null, true, false),
  row('r', null),
]

describe('treegridAction', () => {
  it('moves up and down within bounds', () => {
    expect(treegridAction('ArrowDown', rows, 0)).toEqual({ type: 'focus', index: 1 })
    expect(treegridAction('ArrowDown', rows, 4)).toEqual({ type: 'focus', index: 4 })
    expect(treegridAction('ArrowUp', rows, 0)).toEqual({ type: 'focus', index: 0 })
    expect(treegridAction('ArrowUp', rows, 3)).toEqual({ type: 'focus', index: 2 })
  })

  it('jumps with Home, End and the page keys', () => {
    expect(treegridAction('Home', rows, 3)).toEqual({ type: 'focus', index: 0 })
    expect(treegridAction('End', rows, 1)).toEqual({ type: 'focus', index: 4 })
    expect(treegridAction('PageDown', rows, 1, 2)).toEqual({ type: 'focus', index: 3 })
    expect(treegridAction('PageUp', rows, 1, 2)).toEqual({ type: 'focus', index: 0 })
  })

  it('opens a closed summary, or enters an open one', () => {
    expect(treegridAction('ArrowRight', rows, 3)).toEqual({ type: 'expand', id: 'q' })
    expect(treegridAction('ArrowRight', rows, 0)).toEqual({ type: 'focus', index: 1 })
    expect(treegridAction('ArrowRight', rows, 1)).toEqual({ type: 'none' })
  })

  it('closes an open summary, or goes to the parent', () => {
    expect(treegridAction('ArrowLeft', rows, 0)).toEqual({ type: 'collapse', id: 'p' })
    expect(treegridAction('ArrowLeft', rows, 2)).toEqual({ type: 'focus', index: 0 })
    expect(treegridAction('ArrowLeft', rows, 4)).toEqual({ type: 'none' })
  })

  it('ignores other keys and missing rows', () => {
    expect(treegridAction('x', rows, 0)).toEqual({ type: 'none' })
    expect(treegridAction('ArrowDown', [], 0)).toEqual({ type: 'none' })
  })
})
