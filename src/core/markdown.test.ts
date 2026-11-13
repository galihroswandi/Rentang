import { describe, expect, it } from 'vitest'
import { documentFromMarkdown } from './markdown.ts'
import { headingsOf, plainTextOf, type Json } from './rich-text.ts'

/** The blocks of a document read from `source`. */
function blocksOf(source: string): Json[] {
  const content = documentFromMarkdown(source).content
  if (typeof content !== 'object' || content === null || Array.isArray(content)) return []
  const blocks = content['content']
  return Array.isArray(blocks) ? blocks : []
}

const text = (value: string, ...marks: Json[]): Json =>
  marks.length === 0 ? { type: 'text', text: value } : { type: 'text', text: value, marks }
const bold: Json = { type: 'bold' }
const italic: Json = { type: 'italic' }
const strike: Json = { type: 'strike' }
const code: Json = { type: 'code' }
const link = (href: string): Json => ({ type: 'link', attrs: { href } })
const paragraph = (...content: Json[]): Json =>
  content.length === 0 ? { type: 'paragraph' } : { type: 'paragraph', content }

/** The inline content of the single paragraph a one-line source reads as. */
function inlineOf(source: string): Json[] {
  const [block] = blocksOf(source)
  const content = typeof block === 'object' && block !== null && !Array.isArray(block) ? block : {}
  return Array.isArray(content['content']) ? content['content'] : []
}

describe('inline', () => {
  it('reads plain text as one text node', () => {
    expect(blocksOf('Halo dunia')).toEqual([paragraph(text('Halo dunia'))])
  })

  it('reads bold, italic and strike, with either marker', () => {
    expect(inlineOf('a **tebal** b __tebal__ c')).toEqual([
      text('a '),
      text('tebal', bold),
      text(' b '),
      text('tebal', bold),
      text(' c'),
    ])
    expect(inlineOf('*miring* dan _miring_')).toEqual([
      text('miring', italic),
      text(' dan '),
      text('miring', italic),
    ])
    expect(inlineOf('~~coret~~')).toEqual([text('coret', strike)])
  })

  it('combines marks in the order the editor expects', () => {
    expect(inlineOf('***keduanya***')).toEqual([text('keduanya', bold, italic)])
    expect(inlineOf('**tebal *miring* lagi**')).toEqual([
      text('tebal ', bold),
      text('miring', bold, italic),
      text(' lagi', bold),
    ])
    expect(inlineOf('[**tebal**](https://contoh.id)')).toEqual([
      text('tebal', link('https://contoh.id'), bold),
    ])
  })

  it('reads code spans and keeps their content as it is', () => {
    expect(inlineOf('jalankan `pnpm **dev**` dulu')).toEqual([
      text('jalankan '),
      text('pnpm **dev**', code),
      text(' dulu'),
    ])
    expect(inlineOf('`` a`b ``')).toEqual([text('a`b', code)])
  })

  it('gives code spans no other mark, not even inside a link or bold text', () => {
    expect(inlineOf('**`x`**')).toEqual([text('x', code)])
    expect(inlineOf('[`x`](https://contoh.id)')).toEqual([text('x', code)])
  })

  it('does not read markers that cannot open or close emphasis', () => {
    expect(inlineOf('2 * 3 * 4')).toEqual([text('2 * 3 * 4')])
    expect(inlineOf('snake_case_name')).toEqual([text('snake_case_name')])
    expect(inlineOf('*tidak ditutup')).toEqual([text('*tidak ditutup')])
    expect(inlineOf('**** dan ~~')).toEqual([text('**** dan ~~')])
  })

  it('reads backslash escapes', () => {
    expect(inlineOf('\\*bukan miring\\* dan \\# bukan judul')).toEqual([
      text('*bukan miring* dan # bukan judul'),
    ])
  })

  it('reads links and drops the title', () => {
    expect(inlineOf('lihat [dokumen](https://contoh.id/a_b "judul") ini')).toEqual([
      text('lihat '),
      text('dokumen', link('https://contoh.id/a_b')),
      text(' ini'),
    ])
    expect(inlineOf('[a](<https://contoh.id/x y>)')).toEqual([text('a')])
    expect(inlineOf('[wiki](https://contoh.id/a_(b))')).toEqual([
      text('wiki', link('https://contoh.id/a_(b)')),
    ])
    expect(inlineOf('[surel](mailto:a@contoh.id)')).toEqual([
      text('surel', link('mailto:a@contoh.id')),
    ])
  })

  it('keeps only the text of links that are not safe or not web addresses', () => {
    expect(inlineOf('[klik](javascript:alert(1))')).toEqual([text('klik')])
    expect(inlineOf('[lain](./lain.md)')).toEqual([text('lain')])
    expect(inlineOf('[](./lain.md)')).toEqual([text('./lain.md')])
  })

  it('reads automatic links and bare web addresses, without the closing punctuation', () => {
    expect(inlineOf('<https://contoh.id/x>')).toEqual([
      text('https://contoh.id/x', link('https://contoh.id/x')),
    ])
    expect(inlineOf('buka https://contoh.id/a_b_c, lalu')).toEqual([
      text('buka '),
      text('https://contoh.id/a_b_c', link('https://contoh.id/a_b_c')),
      text(', lalu'),
    ])
    expect(inlineOf('(lihat https://contoh.id/x)')).toEqual([
      text('(lihat '),
      text('https://contoh.id/x', link('https://contoh.id/x')),
      text(')'),
    ])
    expect(inlineOf('**https://contoh.id**')).toEqual([
      text('https://contoh.id', link('https://contoh.id'), bold),
    ])
  })

  it('turns an image into a link to it, or into its text when the address is not safe', () => {
    expect(inlineOf('![diagram](https://contoh.id/a.png)')).toEqual([
      text('diagram', link('https://contoh.id/a.png')),
    ])
    expect(inlineOf('![diagram](a.png)')).toEqual([text('diagram')])
  })

  it('joins soft line breaks with a space and keeps hard ones', () => {
    expect(blocksOf('satu\ndua')).toEqual([paragraph(text('satu dua'))])
    expect(blocksOf('satu  \ndua')).toEqual([
      paragraph(text('satu'), { type: 'hardBreak' }, text('dua')),
    ])
    expect(blocksOf('satu\\\ndua')).toEqual([
      paragraph(text('satu'), { type: 'hardBreak' }, text('dua')),
    ])
  })

  it('drops inline comments and keeps other HTML as text', () => {
    expect(inlineOf('a <!-- rahasia --> b')).toEqual([text('a  b')])
    expect(inlineOf('a <kbd>x</kbd>')).toEqual([text('a <kbd>x</kbd>')])
  })
})

describe('headings', () => {
  it('reads a leading level-1 heading as the title and moves the others up', () => {
    const doc = documentFromMarkdown('# Rencana\n\n## Latar\n\n### Rincian\n\n#### Lebih dalam')
    expect(doc.title).toBe('Rencana')
    expect(headingsOf(doc.content)).toEqual([
      { level: 1, text: 'Latar' },
      { level: 2, text: 'Rincian' },
      { level: 2, text: 'Lebih dalam' },
    ])
  })

  it('keeps every level when the leading heading is not the only level-1 heading', () => {
    const doc = documentFromMarkdown('# Rencana\n\n## Latar\n\n# Bagian dua')
    expect(doc.title).toBe('Rencana')
    expect(headingsOf(doc.content)).toEqual([
      { level: 2, text: 'Latar' },
      { level: 1, text: 'Bagian dua' },
    ])
  })

  it('has no title when the document does not start with a level-1 heading', () => {
    const doc = documentFromMarkdown('Pengantar\n\n# Judul\n\n## Anak')
    expect(doc.title).toBeNull()
    expect(headingsOf(doc.content)).toEqual([
      { level: 1, text: 'Judul' },
      { level: 2, text: 'Anak' },
    ])
  })

  it('reads headings underlined with = and -', () => {
    expect(
      headingsOf(documentFromMarkdown('Awal\n\nSatu\n===\n\nDua\n---\n\nisi').content),
    ).toEqual([
      { level: 1, text: 'Satu' },
      { level: 2, text: 'Dua' },
    ])
  })

  it('removes closing hashes and needs a space after the opening ones', () => {
    expect(headingsOf(documentFromMarkdown('## Judul ##\n\n#bukan judul').content)).toEqual([
      { level: 2, text: 'Judul' },
    ])
    expect(blocksOf('#bukan judul')).toEqual([paragraph(text('#bukan judul'))])
    expect(blocksOf('####### tujuh')).toEqual([paragraph(text('####### tujuh'))])
  })

  it('reads inline marks inside headings', () => {
    expect(blocksOf('## Fase **satu**')).toEqual([
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [text('Fase '), text('satu', bold)],
      },
    ])
  })

  it('uses the front matter title and drops a first heading that repeats it', () => {
    const doc = documentFromMarkdown(
      '---\ntitle: "Rapat Mingguan"\ntags: [a]\n---\n# Rapat Mingguan\n\nisi',
    )
    expect(doc.title).toBe('Rapat Mingguan')
    expect(blocksOf('---\ntitle: X\n---\n# Lain\n\nisi')).toHaveLength(2)
  })

  it('leaves a `---` block that never closes as it is', () => {
    expect(documentFromMarkdown('---\ntitle: X').title).toBeNull()
  })

  it('turns a title that spans lines into one line', () => {
    expect(documentFromMarkdown('Satu\ndua\n===').title).toBe('Satu dua')
  })
})

describe('lists', () => {
  it('reads bullet lists with any marker', () => {
    expect(blocksOf('- a\n* b\n+ c')).toEqual([
      {
        type: 'bulletList',
        content: ['a', 'b', 'c'].map((value) => ({
          type: 'listItem',
          content: [paragraph(text(value))],
        })),
      },
    ])
  })

  it('reads numbered lists and keeps the number they start at', () => {
    expect(blocksOf('3. tiga\n4) empat')).toEqual([
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [
          { type: 'listItem', content: [paragraph(text('tiga'))] },
          { type: 'listItem', content: [paragraph(text('empat'))] },
        ],
      },
    ])
  })

  it('reads task lists with their checked state', () => {
    expect(blocksOf('- [ ] belum\n- [x] sudah\n- [X] juga')).toEqual([
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('belum'))] },
          { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('sudah'))] },
          { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('juga'))] },
        ],
      },
    ])
  })

  it('starts a new list when the kind of item changes', () => {
    const kinds = blocksOf('- a\n- [ ] b\n1. c').map((block) =>
      typeof block === 'object' && block !== null && !Array.isArray(block) ? block['type'] : null,
    )
    expect(kinds).toEqual(['bulletList', 'taskList', 'orderedList'])
  })

  it('nests lists by indentation, however deep the indent is', () => {
    const [list] = blocksOf('1. satu\n  - anak\n    - cucu\n2. dua\n\t- tab')
    expect(plainTextOf(list)).toBe('satu\nanak\ncucu\ndua\ntab')
    expect(headingsOf(list)).toEqual([])
    const outer = list as { type: string; content: { content: Json[] }[] }
    expect(outer.type).toBe('orderedList')
    expect(outer.content).toHaveLength(2)
    expect(outer.content[0]?.content.map((node) => (node as { type: string }).type)).toEqual([
      'paragraph',
      'bulletList',
    ])
  })

  it('keeps blank lines between items and paragraphs inside an item', () => {
    const [list] = blocksOf('- a\n\n  tambahan\n\n- b')
    const items = (list as { content: { content: { type: string }[] }[] }).content
    expect(items).toHaveLength(2)
    expect(items[0]?.content.map((node) => node.type)).toEqual(['paragraph', 'paragraph'])
  })

  it('continues an item with a line that is not indented', () => {
    expect(plainTextOf(blocksOf('- satu\nlanjut')[0])).toBe('satu lanjut')
  })

  it('opens an item with an empty paragraph when it starts with another block', () => {
    const [list] = blocksOf('- # judul\n- ```\n  kode\n  ```')
    const items = (list as { content: { content: { type: string }[] }[] }).content
    expect(items[0]?.content.map((node) => node.type)).toEqual(['paragraph', 'heading'])
    expect(items[1]?.content.map((node) => node.type)).toEqual(['paragraph', 'codeBlock'])
  })

  it('reads an empty item', () => {
    expect(blocksOf('-')).toEqual([
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph()] }] },
    ])
  })

  it('does not read a divider as a list', () => {
    expect(blocksOf('- - -')).toEqual([{ type: 'horizontalRule' }])
  })

  it('lets a list interrupt a paragraph, but only a numbered list that starts at 1', () => {
    expect(blocksOf('teks\n- a').map((b) => (b as { type: string }).type)).toEqual([
      'paragraph',
      'bulletList',
    ])
    expect(blocksOf('teks\n2. a').map((b) => (b as { type: string }).type)).toEqual(['paragraph'])
  })
})

describe('other blocks', () => {
  it('reads fenced code with its language and without reading its content', () => {
    expect(blocksOf('```ts extra\nconst a = **1**\n\n  # x\n```\nsesudah')).toEqual([
      {
        type: 'codeBlock',
        attrs: { language: 'ts' },
        content: [text('const a = **1**\n\n  # x')],
      },
      paragraph(text('sesudah')),
    ])
  })

  it('reads an empty or unclosed fence, and a longer fence that holds a shorter one', () => {
    expect(blocksOf('```\n```')).toEqual([{ type: 'codeBlock', attrs: { language: null } }])
    expect(blocksOf('~~~\nisi')).toEqual([
      { type: 'codeBlock', attrs: { language: null }, content: [text('isi')] },
    ])
    expect(blocksOf('````\n```\nx\n```\n````')).toEqual([
      { type: 'codeBlock', attrs: { language: null }, content: [text('```\nx\n```')] },
    ])
  })

  it('reads dividers', () => {
    expect(blocksOf('***\n\n___\n\n- - -')).toEqual([
      { type: 'horizontalRule' },
      { type: 'horizontalRule' },
      { type: 'horizontalRule' },
    ])
  })

  it('reads quotes, with blocks inside and lazy lines', () => {
    expect(blocksOf('> satu\nlanjut\n>\n> - a')).toEqual([
      {
        type: 'blockquote',
        content: [
          paragraph(text('satu lanjut')),
          { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('a'))] }] },
        ],
      },
    ])
    expect(blocksOf('>')).toEqual([{ type: 'blockquote', content: [paragraph()] }])
  })

  it('reads GitHub alerts as callouts with a label', () => {
    expect(blocksOf('> [!WARNING]\n> Jangan lupa **cadangan**.\n>\n> Kedua kalinya.')).toEqual([
      {
        type: 'callout',
        content: [
          text('Peringatan', bold),
          { type: 'hardBreak' },
          text('Jangan lupa '),
          text('cadangan', bold),
          text('.'),
          { type: 'hardBreak' },
          text('Kedua kalinya.'),
        ],
      },
    ])
    expect(blocksOf('> [!tip]')).toEqual([{ type: 'callout', content: [text('Tips', bold)] }])
  })

  it('flattens a list inside a callout to lines', () => {
    expect(plainTextOf(blocksOf('> [!NOTE]\n> - a\n> - b')[0])).toBe('Catatan\na\nb')
  })

  it('reads a table as a header row and body rows', () => {
    const cell = (type: string, value: string) => ({
      type,
      content: [value === '' ? { type: 'paragraph' } : paragraph(text(value))],
    })
    expect(blocksOf('| a | b |\n|---|:-:|\n| 1 | 2 |\n\nsesudah')).toEqual([
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell('tableHeader', 'a'), cell('tableHeader', 'b')] },
          { type: 'tableRow', content: [cell('tableCell', '1'), cell('tableCell', '2')] },
        ],
      },
      paragraph(text('sesudah')),
    ])
  })

  it('makes every row as wide as the header, reads escaped pipes and works without outer pipes', () => {
    const rows = (source: string) => plainTextOf(blocksOf(source)[0]).split('\n')
    expect(rows('a | b\n--|--\n1\n1 | 2 | 3\n x \\| y | ')).toEqual([
      'a\tb',
      '1\t',
      '1\t2',
      'x | y\t',
    ])
  })

  it('reads inline marks in cells', () => {
    const table = blocksOf('| **a** |\n|---|\n| `b` |')[0]
    expect(plainTextOf(table)).toBe('a\nb')
    expect(JSON.stringify(table)).toContain('"bold"')
  })

  it('does not take a header with a different number of cells for a table', () => {
    expect(blocksOf('| a | b |\n|---|\n| 1 | 2 |')[0]).toEqual(
      paragraph(text('| a | b | |---| | 1 | 2 |')),
    )
  })

  it('ends a table at the next block', () => {
    const blocks = blocksOf('| a |\n|---|\n| 1 |\n# Judul')
    expect(blocks.map((block) => (block as { type: string }).type)).toEqual(['table', 'heading'])
  })

  it('drops HTML comments, also over several lines', () => {
    expect(blocksOf('a\n\n<!-- satu\ndua -->\n\nb')).toEqual([
      paragraph(text('a')),
      paragraph(text('b')),
    ])
    expect(blocksOf('<!-- sebaris -->\nteks')).toEqual([paragraph(text('teks'))])
  })
})

describe('the document', () => {
  it('always holds at least one block', () => {
    for (const source of ['', '\n\n', '<!-- x -->', '# Hanya judul']) {
      expect(documentFromMarkdown(source).content).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      })
    }
  })

  it('reads Windows and old Mac line ends and a byte order mark', () => {
    expect(blocksOf('﻿a\r\n\r\nb\rc')).toEqual([paragraph(text('a')), paragraph(text('b c'))])
  })

  it('reads text with a leading tab as indentation, not as a character', () => {
    expect(plainTextOf(blocksOf('- a\n\t- b')[0])).toBe('a\nb')
  })

  it('stops nesting at a fixed depth instead of overflowing the stack', () => {
    const deep = `${'>'.repeat(5000)} dalam`
    expect(() => documentFromMarkdown(deep)).not.toThrow()
    expect(plainTextOf(documentFromMarkdown(deep).content)).toContain('dalam')
    const nested = Array.from({ length: 3000 }, (_, level) => `${' '.repeat(level)}- a`).join('\n')
    expect(() => documentFromMarkdown(nested)).not.toThrow()
  })

  it('stays quick on input made of unmatched markers', () => {
    const started = performance.now()
    documentFromMarkdown('*a '.repeat(30_000))
    documentFromMarkdown('[a '.repeat(30_000))
    documentFromMarkdown('`a '.repeat(30_000))
    expect(performance.now() - started).toBeLessThan(3000)
  })
})
