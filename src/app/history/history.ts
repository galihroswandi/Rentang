/**
 * Undo and redo for every edit, built on Immer patches: an edit stores the patches that
 * made it and the inverse patches that take it back, never whole copies of the project.
 */
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'
import type { Project } from '../../core/model.ts'
import type { Recipe } from '../edits/project-edits.ts'

enablePatches()

/** Older steps are dropped beyond this many. */
export const HISTORY_LIMIT = 100

export type HistoryEntry = {
  /** What the edit did, for the "Urungkan" message. */
  readonly label: string
  readonly patches: readonly Patch[]
  readonly inverse: readonly Patch[]
  /** Edits in a row with the same key share one step, such as typing in one document. */
  readonly mergeKey?: string
}

export type History = {
  readonly past: readonly HistoryEntry[]
  readonly future: readonly HistoryEntry[]
}

export const EMPTY_HISTORY: History = { past: [], future: [] }

export type Step = {
  readonly project: Project
  readonly history: History
  readonly entry: HistoryEntry
}

/**
 * Applies an edit; null when it changed nothing. With a `mergeKey`, an edit right after one
 * with the same key joins that step instead of adding one, so undo takes back both at once.
 */
export function record(
  project: Project,
  history: History,
  label: string,
  recipe: Recipe,
  mergeKey?: string,
): Step | null {
  const [next, patches, inverse] = produceWithPatches(project, recipe)
  if (patches.length === 0) return null
  const last = history.past.at(-1)
  if (mergeKey !== undefined && last?.mergeKey === mergeKey && history.future.length === 0) {
    return { project: next, ...joinLast(project, history, last, label, patches) }
  }
  const entry: HistoryEntry =
    mergeKey === undefined ? { label, patches, inverse } : { label, patches, inverse, mergeKey }
  return {
    project: next,
    history: { past: [...history.past, entry].slice(-HISTORY_LIMIT), future: [] },
    entry,
  }
}

/**
 * Replaces the last step with one that covers it and the new patches. The patches are worked
 * out again from the state before the last step, so a value changed many times is stored once.
 * When the two cancel out, the step is dropped.
 */
function joinLast(
  project: Project,
  history: History,
  last: HistoryEntry,
  label: string,
  patches: readonly Patch[],
): Pick<Step, 'history' | 'entry'> {
  const before = applyPatches(project, last.inverse)
  const [, joined, inverse] = produceWithPatches(before, (draft) => {
    applyPatches(draft, [...last.patches, ...patches])
  })
  const entry: HistoryEntry = { ...last, label, patches: joined, inverse }
  const past = history.past.slice(0, -1)
  return { history: { past: joined.length === 0 ? past : [...past, entry], future: [] }, entry }
}

export function undo(project: Project, history: History): Step | null {
  const entry = history.past.at(-1)
  if (!entry) return null
  return {
    project: applyPatches(project, entry.inverse),
    history: { past: history.past.slice(0, -1), future: [entry, ...history.future] },
    entry,
  }
}

export function redo(project: Project, history: History): Step | null {
  const entry = history.future[0]
  if (!entry) return null
  return {
    project: applyPatches(project, entry.patches),
    history: { past: [...history.past, entry], future: history.future.slice(1) },
    entry,
  }
}
