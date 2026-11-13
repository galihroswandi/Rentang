import { describe, expect, it } from 'vitest'
import { documentFromMarkdown } from '../../core/markdown.ts'
import { createDocumentEditor } from './editor.ts'

/** Everything the importer can produce, in one file. */
const SAMPLE = `---
title: Rencana Peluncuran
---
# Rencana Peluncuran

Paragraf dengan **tebal**, *miring*, ~~coret~~, \`kode\`, dan [tautan](https://contoh.id/a_b).
Baris kedua  
dengan jeda keras. ***Tebal miring*** dan [**tebal di tautan**](https://contoh.id) serta https://contoh.id/x.

## Latar

### Rincian

#### Lebih dalam

- satu
- dua
  - anak dengan **tebal**
    1. cucu
    2. cucu dua
- [ ] tugas
- [x] selesai

3. tiga
4. empat

> kutipan
> - daftar di kutipan

> [!WARNING]
> Jangan lupa **cadangan**.
>
> Kedua.

> [!NOTE]
> - a
> - b

\`\`\`ts
const a = 1
\`\`\`

\`\`\`
\`\`\`

---

| a | b |
|---|---|
| 1 | 2 |

- # judul di item
- \`\`\`
  kode di item
  \`\`\`
-
`

function load(source: string) {
  const element = document.createElement('div')
  document.body.append(element)
  const { content } = documentFromMarkdown(source)
  const editor = createDocumentEditor({
    element,
    content,
    label: 'Isi',
    links: new Map(),
    focusedTask: null,
    onChange: () => undefined,
    onMenu: () => undefined,
    onMenuKey: () => false,
    onMention: () => undefined,
    onTable: () => undefined,
    onFocus: () => undefined,
    onBlur: () => undefined,
  })
  return { editor, element }
}

describe('an imported document in the real editor', () => {
  it('passes the editor content check, so it opens editable', () => {
    const { editor, element } = load(SAMPLE)
    expect(editor.readable).toBe(true)
    expect(element.querySelectorAll('h3').length).toBe(1)
    expect(element.querySelectorAll('li').length).toBeGreaterThan(8)
    expect(element.querySelector('[data-type="callout"]')).not.toBeNull()
    expect(element.querySelector('pre code')).not.toBeNull()
    expect(element.querySelector('hr')).not.toBeNull()
    expect(element.querySelectorAll('table th').length).toBe(2)
    expect(element.querySelectorAll('table td').length).toBe(2)
    expect(element.querySelector('a[href="https://contoh.id/a_b"]')).not.toBeNull()
    editor.destroy()
  })

  it('opens an empty file as an empty page', () => {
    const { editor } = load('')
    expect(editor.readable).toBe(true)
    editor.destroy()
  })
})

describe('tables in the real editor', () => {
  it('adds and removes rows and columns where the caret is', () => {
    const { editor, element } = load('| a | b |\n|---|---|\n| 1 | 2 |')
    editor.focus('start')
    editor.tableAction('row-after')
    expect(element.querySelectorAll('tr').length).toBe(3)
    editor.tableAction('column-after')
    expect(element.querySelectorAll('th').length).toBe(3)
    editor.tableAction('delete-column')
    expect(element.querySelectorAll('th').length).toBe(2)
    // The caret is in the header row, so that is the row that goes.
    editor.tableAction('delete-row')
    expect(element.querySelectorAll('tr').length).toBe(2)
    expect(element.querySelectorAll('th').length).toBe(0)
    editor.tableAction('delete-table')
    expect(element.querySelector('table')).toBeNull()
    editor.destroy()
  })

  it('turns pasted Markdown table text into a table', () => {
    const { editor, element } = load('')
    editor.focus()
    const paste = (html: string) => {
      const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
        clipboardData: { getData: (type: string) => string }
      }
      event.clipboardData = {
        getData: (type) =>
          type === 'text/plain'
            ? '| a | b |\n|---|---|\n| 1 | 2 |'
            : type === 'text/html'
              ? html
              : '',
      }
      element.querySelector('.doc-body')?.dispatchEvent(event)
    }
    paste('<p>bukan tabel</p>')
    expect(element.querySelector('table')).toBeNull()
    paste('')
    expect(element.querySelectorAll('table td').length).toBe(2)
    editor.destroy()
  })
})
