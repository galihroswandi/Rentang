import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { projectSchema, type Project, type ProjectDocument } from '../../core/model.ts'
import { documentFromText, emptyDocument } from '../../core/rich-text.ts'
import { coffeeShopProject } from '../../core/test-utils/coffee-shop.ts'
import {
  addDocument,
  importDocuments,
  deleteDocument,
  documentsInOrder,
  moveDocument,
  renameDocument,
  setDocumentContent,
} from './document-edits.ts'
import type { Recipe } from './project-edits.ts'

const AT = '2026-11-11T09:30:00.000Z'
const LATER = '2026-11-11T09:45:00.000Z'

function apply(project: Project, ...recipes: Recipe[]): Project {
  const next = recipes.reduce((current, recipe) => produce(current, recipe), project)
  const valid = projectSchema.safeParse(next)
  if (!valid.success) throw new Error(valid.error.message)
  return next
}

/** The coffee-shop project with three documents, a, b and c, in that order. */
function withDocuments(): Project {
  return apply(
    coffeeShopProject(),
    addDocument('a', AT, 'Rencana'),
    addDocument('b', AT, 'Rapat'),
    addDocument('c', AT, 'Pemasok'),
  )
}

const titles = (project: Project): string[] =>
  documentsInOrder(project.documents).map((document) => document.title)
const documentOf = (project: Project, id: string): ProjectDocument | undefined =>
  project.documents.find((document) => document.id === id)

describe('importDocuments', () => {
  const content = documentFromText('Isi dari berkas')

  it('adds the documents with their content at the end of the list, in order', () => {
    const project = apply(
      withDocuments(),
      importDocuments(
        [
          { id: 'x', title: 'Satu', content },
          { id: 'y', title: 'Dua\ngaris', content: emptyDocument() },
        ],
        AT,
      ),
    )
    expect(titles(project)).toEqual(['Rencana', 'Rapat', 'Pemasok', 'Satu', 'Dua garis'])
    expect(documentOf(project, 'x')).toEqual({
      id: 'x',
      title: 'Satu',
      content,
      order: 3,
      updatedAt: AT,
    })
    expect(documentOf(project, 'y')?.order).toBe(4)
  })

  it('adds nothing for an empty list', () => {
    const project = withDocuments()
    expect(apply(project, importDocuments([], AT))).toBe(project)
  })
})

describe('addDocument', () => {
  it('adds an empty document at the end of the list', () => {
    const project = withDocuments()
    expect(titles(project)).toEqual(['Rencana', 'Rapat', 'Pemasok'])
    expect(documentOf(project, 'c')).toEqual({
      id: 'c',
      title: 'Pemasok',
      content: emptyDocument(),
      order: 2,
      updatedAt: AT,
    })
  })

  it('goes after the highest place even when places have gaps', () => {
    const gapped = produce(withDocuments(), (draft) => {
      const last = draft.documents.find((document) => document.id === 'c')
      if (last) last.order = 7
    })
    expect(documentOf(apply(gapped, addDocument('d', AT)), 'd')).toMatchObject({
      order: 8,
      title: '',
    })
  })
})

describe('renameDocument', () => {
  it('keeps the title as typed but on one line, and stamps the change', () => {
    const project = apply(withDocuments(), renameDocument('a', 'Rencana \n peluncuran ', LATER))
    expect(documentOf(project, 'a')).toMatchObject({
      title: 'Rencana peluncuran ',
      updatedAt: LATER,
    })
  })

  it('changes nothing for the same title or an unknown document', () => {
    const project = withDocuments()
    expect(produce(project, renameDocument('a', 'Rencana', LATER))).toBe(project)
    expect(produce(project, renameDocument('x', 'Baru', LATER))).toBe(project)
  })
})

describe('setDocumentContent', () => {
  it('replaces the content and stamps the change', () => {
    const content = documentFromText('Halo')
    const project = apply(withDocuments(), setDocumentContent('b', content, LATER))
    expect(documentOf(project, 'b')).toMatchObject({ content, updatedAt: LATER })
  })

  it('changes nothing when the content is the same or the document is unknown', () => {
    const project = withDocuments()
    expect(produce(project, setDocumentContent('b', emptyDocument(), LATER))).toBe(project)
    expect(produce(project, setDocumentContent('x', emptyDocument(), LATER))).toBe(project)
  })

  it('works on a document added in the same edit', () => {
    const project = apply(coffeeShopProject(), (draft) => {
      addDocument('n', AT)(draft)
      setDocumentContent('n', documentFromText('Isi'), LATER)(draft)
    })
    expect(documentOf(project, 'n')?.content).toEqual(documentFromText('Isi'))
  })
})

describe('deleteDocument', () => {
  it('removes a document and closes up the list', () => {
    const project = apply(withDocuments(), deleteDocument('a'))
    expect(titles(project)).toEqual(['Rapat', 'Pemasok'])
    expect(project.documents.map((document) => document.order)).toEqual([0, 1])
  })

  it('changes nothing for an unknown document', () => {
    const project = withDocuments()
    expect(produce(project, deleteDocument('x'))).toBe(project)
  })
})

describe('moveDocument', () => {
  it('puts a document before or after another one', () => {
    expect(titles(apply(withDocuments(), moveDocument('c', 'a', 'before')))).toEqual([
      'Pemasok',
      'Rencana',
      'Rapat',
    ])
    expect(titles(apply(withDocuments(), moveDocument('a', 'b', 'after')))).toEqual([
      'Rapat',
      'Rencana',
      'Pemasok',
    ])
  })

  it('changes nothing when the place stays the same or a document is unknown', () => {
    const project = withDocuments()
    expect(produce(project, moveDocument('a', 'b', 'before'))).toBe(project)
    expect(produce(project, moveDocument('a', 'a', 'after'))).toBe(project)
    expect(produce(project, moveDocument('x', 'a', 'after'))).toBe(project)
    expect(produce(project, moveDocument('a', 'x', 'after'))).toBe(project)
  })
})
