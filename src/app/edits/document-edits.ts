/**
 * Edits to a project's documents, as Immer recipes like the task edits. A document is a flat
 * page: a title, rich-text content and a place in the list. `at` is when the edit happened, an
 * ISO timestamp from the caller, so the recipes stay pure and the store stays testable.
 */
import { isDraft, original, type Draft } from 'immer'
import type { ProjectDocument } from '../../core/model.ts'
import { emptyDocument, type Json } from '../../core/rich-text.ts'
import type { Recipe } from './project-edits.ts'

/** Documents in list order. Sorting is stable, so equal places keep their array order. */
export function documentsInOrder<D extends Pick<ProjectDocument, 'order'>>(
  documents: readonly D[],
): D[] {
  return [...documents].sort((a, b) => a.order - b.order)
}

function renumber(documents: readonly Draft<ProjectDocument>[]): void {
  documents.forEach((document, index) => {
    document.order = index
  })
}

/** A title is one line: line breaks typed or pasted into it become a space. */
function oneLine(title: string): string {
  return title.replace(/\s*[\r\n]+\s*/g, ' ')
}

/** Adds a document at the end of the list: an empty one unless `content` is given. */
export function addDocument(
  id: string,
  at: string,
  title = '',
  content: Json = emptyDocument(),
): Recipe {
  return (draft) => {
    const last = Math.max(-1, ...draft.documents.map((document) => document.order))
    draft.documents.push({
      id,
      title: oneLine(title),
      content,
      order: last + 1,
      updatedAt: at,
    })
  }
}

/** A document read from a file, ready to be added. */
export type ImportedDocument = {
  readonly id: string
  readonly title: string
  readonly content: Json
}

/** Adds several documents in the order given, as one edit, so one undo takes them all back. */
export function importDocuments(documents: readonly ImportedDocument[], at: string): Recipe {
  return (draft) => {
    for (const { id, title, content } of documents) addDocument(id, at, title, content)(draft)
  }
}

/** Sets a document's title as typed; spaces are kept so typing between words works. */
export function renameDocument(id: string, title: string, at: string): Recipe {
  return (draft) => {
    const document = draft.documents.find((candidate) => candidate.id === id)
    const next = oneLine(title)
    if (!document || document.title === next) return
    document.title = next
    document.updatedAt = at
  }
}

/** Replaces a document's content; the same content again changes nothing. */
export function setDocumentContent(id: string, content: Json, at: string): Recipe {
  return (draft) => {
    const document = draft.documents.find((candidate) => candidate.id === id)
    if (!document) return
    // Compare against the stored content: serializing the draft would wrap every node in a proxy.
    const before = isDraft(document) ? original(document).content : document.content
    if (JSON.stringify(before) === JSON.stringify(content)) return
    document.content = content
    document.updatedAt = at
  }
}

/** Removes a document; the ones after it move up. */
export function deleteDocument(id: string): Recipe {
  return (draft) => {
    if (!draft.documents.some((document) => document.id === id)) return
    draft.documents = draft.documents.filter((document) => document.id !== id)
    renumber(documentsInOrder(draft.documents))
  }
}

/** Puts a document right before or after another one, and renumbers the list. */
export function moveDocument(id: string, targetId: string, place: 'before' | 'after'): Recipe {
  return (draft) => {
    const document = draft.documents.find((candidate) => candidate.id === id)
    const target = draft.documents.find((candidate) => candidate.id === targetId)
    if (!document || !target || id === targetId) return
    const others = documentsInOrder(draft.documents).filter((candidate) => candidate.id !== id)
    others.splice(others.indexOf(target) + (place === 'after' ? 1 : 0), 0, document)
    renumber(others)
  }
}
