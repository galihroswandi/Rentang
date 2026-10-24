/**
 * Keyboard behaviour of the task table, following the WAI-ARIA treegrid pattern with
 * focus on rows: arrows move and open or close summary tasks, Home/End and Page keys jump.
 */
import type { TaskRow } from './rows.ts'

export type TreegridAction =
  | { readonly type: 'focus'; readonly index: number }
  | { readonly type: 'expand'; readonly id: string }
  | { readonly type: 'collapse'; readonly id: string }
  | { readonly type: 'none' }

const NONE: TreegridAction = { type: 'none' }

export function treegridAction(
  key: string,
  rows: readonly TaskRow[],
  index: number,
  pageSize = 10,
): TreegridAction {
  const row = rows[index]
  if (!row) return NONE
  const focus = (target: number): TreegridAction => ({
    type: 'focus',
    index: Math.min(rows.length - 1, Math.max(0, target)),
  })

  switch (key) {
    case 'ArrowDown':
      return focus(index + 1)
    case 'ArrowUp':
      return focus(index - 1)
    case 'Home':
      return focus(0)
    case 'End':
      return focus(rows.length - 1)
    case 'PageDown':
      return focus(index + pageSize)
    case 'PageUp':
      return focus(index - pageSize)
    case 'ArrowRight':
      if (!row.isSummary) return NONE
      return row.expanded ? focus(index + 1) : { type: 'expand', id: row.id }
    case 'ArrowLeft': {
      if (row.isSummary && row.expanded) return { type: 'collapse', id: row.id }
      const parent = rows.findIndex((candidate) => candidate.id === row.parentId)
      return parent === -1 ? NONE : focus(parent)
    }
    default:
      return NONE
  }
}
