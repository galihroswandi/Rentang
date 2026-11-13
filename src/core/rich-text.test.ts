import { describe, expect, it } from 'vitest'
import {
  countWords,
  documentFromText,
  documentsMentioning,
  emptyDocument,
  headingsOf,
  mentionedTaskIds,
  plainTextOf,
  TASK_MENTION,
  type Json,
} from './rich-text.ts'

const text = (value: string): Json => ({ type: 'text', text: value })
const mention = (id: string, label: string): Json => ({
  type: TASK_MENTION,
  attrs: { id, label, mentionSuggestionChar: '@' },
})
const paragraph = (...content: Json[]): Json =>
  content.length === 0 ? { type: 'paragraph' } : { type: 'paragraph', content }
const heading = (level: number, value: string): Json => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
})

const plan: Json = {
  type: 'doc',
  content: [
    heading(1, 'Tujuan'),
    paragraph(
      text('Kedai dibuka pada '),
      mention('13', 'Soft opening'),
      text(' dengan menu inti.'),
    ),
    heading(2, 'Keputusan'),
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [paragraph(text('Lokasi B dipilih'))],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [
            paragraph(
              text('Pastikan '),
              mention('8', 'Pasang mesin espresso'),
              text(' selesai sebelum '),
              mention('11', 'Pelatihan barista'),
            ),
          ],
        },
      ],
    },
    { type: 'callout', content: [text('Jika '), mention('13', 'Soft opening'), text(' mundur')] },
    paragraph(text('Baris satu'), { type: 'hardBreak' }, text('baris dua')),
  ],
}

describe('documents built in core', () => {
  it('starts empty with one paragraph', () => {
    expect(emptyDocument()).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
  })

  it('turns each line of plain text into a paragraph', () => {
    expect(documentFromText('Satu\n\nTiga\r\nEmpat')).toEqual({
      type: 'doc',
      content: [
        paragraph(text('Satu')),
        paragraph(),
        paragraph(text('Tiga')),
        paragraph(text('Empat')),
      ],
    })
  })
})

describe('plainTextOf', () => {
  it('reads blocks as lines and mentions by name', () => {
    expect(plainTextOf(plan).split('\n')).toEqual([
      'Tujuan',
      'Kedai dibuka pada Soft opening dengan menu inti.',
      'Keputusan',
      'Lokasi B dipilih',
      'Pastikan Pasang mesin espresso selesai sebelum Pelatihan barista',
      'Jika Soft opening mundur',
      'Baris satu',
      'baris dua',
    ])
  })

  it("uses a task's current name when it is known", () => {
    const names = new Map([['13', 'Pembukaan']])
    expect(plainTextOf(paragraph(mention('13', 'Soft opening')), (id) => names.get(id))).toBe(
      'Pembukaan',
    )
  })

  it('keeps plain-text notes and skips what is not a node', () => {
    expect(plainTextOf('Catatan lama')).toBe('Catatan lama')
    expect(plainTextOf(undefined)).toBe('')
    expect(plainTextOf(42)).toBe('')
    expect(plainTextOf([plan])).toBe('')
    expect(plainTextOf({ content: [] })).toBe('')
    expect(
      plainTextOf({
        type: 'doc',
        content: [
          'bukan node',
          paragraph(
            { type: 'text' },
            { type: TASK_MENTION },
            { type: TASK_MENTION, attrs: { id: 5 } },
          ),
        ],
      }),
    ).toBe('')
  })

  it('reads the empty document as no text', () => {
    expect(plainTextOf(emptyDocument())).toBe('')
    expect(plainTextOf(documentFromText('Halo\nDunia'))).toBe('Halo\nDunia')
  })
})

describe('countWords', () => {
  it('counts runs with a letter or digit', () => {
    expect(countWords('Kedai dibuka pada 21 Okt — tepat waktu.')).toBe(7)
    expect(countWords('  ')).toBe(0)
    expect(countWords('')).toBe(0)
    expect(countWords('soft-opening, 100%!')).toBe(2)
  })
})

describe('headingsOf', () => {
  it('lists headings with their level in order', () => {
    expect(headingsOf(plan)).toEqual([
      { level: 1, text: 'Tujuan' },
      { level: 2, text: 'Keputusan' },
    ])
  })

  it('skips headings without a level and anything that is not a document', () => {
    expect(
      headingsOf({ type: 'doc', content: [{ type: 'heading', content: [text('x')] }] }),
    ).toEqual([])
    expect(headingsOf('Judul')).toEqual([])
  })
})

describe('mentions', () => {
  it('lists each mentioned task once, in order of first mention', () => {
    expect(mentionedTaskIds(plan)).toEqual(['13', '8', '11'])
    expect(mentionedTaskIds(paragraph(mention('', 'Kosong')))).toEqual([])
    expect(mentionedTaskIds(null)).toEqual([])
  })

  it('finds the documents that mention a task, in list order', () => {
    const documents = [
      { id: 'b', order: 1, content: paragraph(mention('13', 'Soft opening')) },
      { id: 'a', order: 0, content: plan },
      { id: 'c', order: 2, content: emptyDocument() },
    ]
    expect(documentsMentioning(documents, '13').map((document) => document.id)).toEqual(['a', 'b'])
    expect(documentsMentioning(documents, '99')).toEqual([])
  })
})
