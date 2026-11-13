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
    expect(element.querySelector('a[href="https://contoh.id/a_b"]')).not.toBeNull()
    editor.destroy()
  })

  it('opens an empty file as an empty page', () => {
    const { editor } = load('')
    expect(editor.readable).toBe(true)
    editor.destroy()
  })
})
