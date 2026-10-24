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

/** Applies an edit; null when it changed nothing. */
export function record(
  project: Project,
  history: History,
  label: string,
  recipe: Recipe,
): Step | null {
  const [next, patches, inverse] = produceWithPatches(project, recipe)
  if (patches.length === 0) return null
  const entry = { label, patches, inverse }
  return {
    project: next,
    history: { past: [...history.past, entry].slice(-HISTORY_LIMIT), future: [] },
    entry,
  }
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
