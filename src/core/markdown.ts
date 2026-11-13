/**
 * Markdown to the editor's JSON document (see rich-text.ts), for importing `.md` files.
 *
 * Only what the document editor can hold is produced: paragraphs, headings (level 1 and 2),
 * bullet, numbered and task lists, quotes, callouts (GitHub `> [!NOTE]` alerts), code blocks,
 * dividers and tables, with bold, italic, strike, code and links inside text. Everything else
 * degrades instead of failing: a table's column alignment is dropped, an image becomes a link to it, raw HTML stays as text and a link to anything but http(s), mailto or tel loses its
 * target. The output must satisfy the editor's schema exactly, or the document would open
 * read-only; src/ui/docs/markdown-import.test.ts loads it into the real editor to guard that.
 */
import { plainTextOf, type Json } from './rich-text.ts'

type JsonObject = { [key: string]: Json }

export type MarkdownDocument = {
  /** The document's title: front matter `title`, or a leading `# Heading`; null when it has none. */
  readonly title: string | null
  /** Editor JSON, always a `doc` with at least one block. */
  readonly content: Json
}

/** Blocks nested deeper than this (quotes in quotes, lists in lists) are read as plain text. */
const MAX_DEPTH = 24

/** How far a link's label is searched for its closing bracket. Keeps stray `[` cheap. */
const MAX_LABEL = 500

const CALLOUT_LABELS: Readonly<Record<string, string>> = {
  NOTE: 'Catatan',
  TIP: 'Tips',
  IMPORTANT: 'Penting',
  WARNING: 'Peringatan',
  CAUTION: 'Awas',
}

// ---------------------------------------------------------------------------------------------
// Inline: emphasis, code, links
// ---------------------------------------------------------------------------------------------

type Style = {
  readonly bold: boolean
  readonly italic: boolean
  readonly strike: boolean
  readonly code: boolean
  readonly href: string | null
}

const PLAIN: Style = { bold: false, italic: false, strike: false, code: false, href: null }

/**
 * The marks of a style. The code mark excludes every other mark in the editor, and text that
 * carries it together with another would not pass the editor's content check.
 */
function marksOf(style: Style): JsonObject[] {
  if (style.code) return [{ type: 'code' }]
  const marks: JsonObject[] = []
  if (style.href !== null) marks.push({ type: 'link', attrs: { href: style.href } })
  if (style.bold) marks.push({ type: 'bold' })
  if (style.italic) marks.push({ type: 'italic' })
  if (style.strike) marks.push({ type: 'strike' })
  return marks
}

/** Inline nodes under construction; neighbouring text with the same marks is joined. */
class Inline {
  readonly nodes: JsonObject[] = []
  private lastKey: string | null = null

  text(text: string, style: Style): void {
    if (text === '') return
    const marks = marksOf(style)
    const key = JSON.stringify(marks)
    const last = this.nodes[this.nodes.length - 1]
    if (last && this.lastKey === key && typeof last['text'] === 'string') {
      last['text'] += text
      return
    }
    this.nodes.push(marks.length === 0 ? { type: 'text', text } : { type: 'text', text, marks })
    this.lastKey = key
  }

  hardBreak(): void {
    this.nodes.push({ type: 'hardBreak' })
    this.lastKey = null
  }
}

const isAlnum = (ch: string): boolean => /[\p{L}\p{N}]/u.test(ch)
const isSpace = (ch: string): boolean => ch === '' || /\s/u.test(ch)
const isPunct = (ch: string): boolean => /^[!-/:-@[-`{-~]$/.test(ch)

/** Only addresses that are safe and mean something outside the app become links. */
function safeHref(raw: string): string | null {
  const href = raw.trim()
  return /^(?:https?:\/\/[^\s]+|mailto:[^\s]+|tel:[^\s]+)$/i.test(href) ? href : null
}

/** The index just after the code span that opens at `at`, or -1 when it never closes. */
function codeSpanEnd(src: string, at: number): number {
  let n = 0
  while (src.charAt(at + n) === '`') n++
  let k = at + n
  for (;;) {
    k = src.indexOf('`', k)
    if (k === -1) return -1
    let m = 0
    while (src.charAt(k + m) === '`') m++
    if (m === n) return k + m
    k += m
  }
}

type LinkParts = { readonly label: string; readonly dest: string; readonly end: number }

/** A `[label](destination "title")` that starts at `at`, or null if it is not one. */
function readLink(src: string, at: number): LinkParts | null {
  let depth = 1
  let k = at + 1
  const limit = Math.min(src.length, at + MAX_LABEL)
  for (; k < limit && depth > 0; k++) {
    const ch = src.charAt(k)
    if (ch === '\\') k++
    else if (ch === '`') {
      const end = codeSpanEnd(src, k)
      if (end !== -1 && end <= limit) k = end - 1
    } else if (ch === '[') depth++
    else if (ch === ']') depth--
  }
  if (depth !== 0 || src.charAt(k) !== '(') return null
  const label = src.slice(at + 1, k - 1)

  let p = k + 1
  while (src.charAt(p) === ' ') p++
  let dest = ''
  if (src.charAt(p) === '<') {
    const close = src.indexOf('>', p)
    if (close === -1 || src.slice(p, close).includes('\n')) return null
    dest = src.slice(p + 1, close)
    p = close + 1
  } else {
    let parens = 0
    const from = p
    for (; p < src.length; p++) {
      const ch = src.charAt(p)
      if (ch === '\\') p++
      else if (isSpace(ch)) break
      else if (ch === '(') parens++
      else if (ch === ')') {
        if (parens === 0) break
        parens--
      }
    }
    dest = src.slice(from, p)
  }
  while (src.charAt(p) === ' ') p++
  const quote = src.charAt(p)
  if (quote === '"' || quote === "'" || quote === '(') {
    const close = src.indexOf(quote === '(' ? ')' : quote, p + 1)
    if (close === -1) return null
    p = close + 1
    while (src.charAt(p) === ' ') p++
  }
  if (src.charAt(p) !== ')') return null
  return { label, dest, end: p + 1 }
}

/** A bare web address at `at` without the punctuation that ends a sentence. */
function readBareUrl(src: string, at: number): string | null {
  const match = /^https?:\/\/[^\s<>*]+/i.exec(src.slice(at, at + 2048))
  if (!match) return null
  let url = match[0]
  for (;;) {
    const last = url.charAt(url.length - 1)
    const unbalanced = last === ')' && count(url, ')') > count(url, '(')
    if (/[.,;:!?'"\]]/.test(last) || unbalanced) url = url.slice(0, -1)
    else break
  }
  return /^https?:\/\/[^\s]/i.test(url) ? url : null
}

function count(text: string, ch: string): number {
  return text.split(ch).length - 1
}

/**
 * Where the emphasis that opens at `at` with `width` marker characters closes, or -1. A closer
 * must follow a non-space; an underscore does not close inside a word.
 */
function findCloser(src: string, at: number, ch: string, width: number): number {
  for (let j = at + width; j < src.length; j++) {
    const c = src.charAt(j)
    if (c === '\\') {
      j++
      continue
    }
    if (c === '`') {
      const end = codeSpanEnd(src, j)
      if (end !== -1) j = end - 1
      continue
    }
    if (c !== ch) continue
    let run = 0
    while (src.charAt(j + run) === ch) run++
    // Of a longer run the closer is its last `width` characters; the rest close what is inside.
    const at2 = j + run - width
    const closes =
      (width > 1 ? run >= width : run === 1) &&
      at2 > at + width &&
      !isSpace(src.charAt(at2 - 1)) &&
      (ch !== '_' || !isAlnum(src.charAt(at2 + width)))
    if (closes) return at2
    j += run - 1
  }
  return -1
}

function parseInline(src: string, style: Style, out: Inline): void {
  let literal = ''
  const flush = (): void => {
    out.text(literal, style)
    literal = ''
  }
  // A search that found no closer from here finds none from any later opener either.
  const noCloser = new Map<string, number>()
  let i = 0

  while (i < src.length) {
    const ch = src.charAt(i)

    if (ch === '\\') {
      const next = src.charAt(i + 1)
      if (next === '\n') {
        flush()
        out.hardBreak()
        i += 2
      } else if (isPunct(next)) {
        literal += next
        i += 2
      } else {
        literal += ch
        i++
      }
      continue
    }

    if (ch === '\n') {
      const hard = / {2,}$/.test(literal)
      literal = literal.replace(/ +$/, '')
      if (hard) {
        flush()
        out.hardBreak()
      } else literal += ' '
      i++
      while (src.charAt(i) === ' ') i++
      continue
    }

    if (ch === '`') {
      const end = codeSpanEnd(src, i)
      let n = 0
      while (src.charAt(i + n) === '`') n++
      if (end === -1) {
        literal += '`'.repeat(n)
        i += n
        continue
      }
      let code = src.slice(i + n, end - n).replace(/\n/g, ' ')
      if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') {
        code = code.slice(1, -1)
      }
      flush()
      out.text(code, { ...PLAIN, code: true })
      i = end
      continue
    }

    if (ch === '!' && src.charAt(i + 1) === '[') {
      const link = readLink(src, i + 1)
      if (link) {
        flush()
        const href = safeHref(link.dest)
        const alt = link.label.trim() || (href ?? '')
        out.text(alt, href !== null && style.href === null ? { ...style, href } : style)
        i = link.end
        continue
      }
    }

    if (ch === '[') {
      const link = readLink(src, i)
      if (link) {
        flush()
        const href = safeHref(link.dest)
        const label = link.label.trim() === '' ? link.dest : link.label
        const inner = href !== null && style.href === null ? { ...style, href } : style
        parseInline(label, inner, out)
        i = link.end
        continue
      }
    }

    if (ch === '<') {
      const auto = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(src.slice(i, i + 2048))
      if (auto?.[1]) {
        flush()
        const href = safeHref(auto[1])
        out.text(auto[1], href !== null && style.href === null ? { ...style, href } : style)
        i += auto[0].length
        continue
      }
      if (src.startsWith('<!--', i)) {
        const close = src.indexOf('-->', i + 4)
        if (close !== -1) {
          i = close + 3
          continue
        }
      }
    }

    if (
      (ch === 'h' || ch === 'H') &&
      style.href === null &&
      !isAlnum(src.charAt(i - 1)) &&
      /^https?:\/\//i.test(src.slice(i, i + 8))
    ) {
      const url = readBareUrl(src, i)
      if (url !== null) {
        flush()
        out.text(url, { ...style, href: url })
        i += url.length
        continue
      }
    }

    if (ch === '*' || ch === '_' || ch === '~') {
      let run = 0
      while (src.charAt(i + run) === ch) run++
      const widths = ch === '~' ? (run >= 2 ? [2] : []) : [3, 2, 1].filter((w) => w <= run)
      const opensWord = ch !== '_' || !isAlnum(src.charAt(i - 1))
      let used = false
      for (const width of widths) {
        const key = `${ch}${String(width)}`
        const failed = noCloser.get(key)
        if (failed !== undefined && failed <= i) continue
        if (!opensWord || isSpace(src.charAt(i + width))) continue
        const close = findCloser(src, i, ch, width)
        if (close === -1) {
          noCloser.set(key, i)
          continue
        }
        flush()
        const inner: Style =
          ch === '~'
            ? { ...style, strike: true }
            : width === 3
              ? { ...style, bold: true, italic: true }
              : width === 2
                ? { ...style, bold: true }
                : { ...style, italic: true }
        parseInline(src.slice(i + width, close), inner, out)
        i = close + width
        used = true
        break
      }
      if (!used) {
        literal += ch.repeat(run)
        i += run
      }
      continue
    }

    literal += ch
    i++
  }
  flush()
}

/** Inline nodes of a block of text; line breaks inside it are soft unless marked hard. */
function inlineNodes(text: string): JsonObject[] {
  const out = new Inline()
  parseInline(text.replace(/[ \t]+$/, ''), PLAIN, out)
  return out.nodes
}

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------

const BLANK = /^\s*$/
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const QUOTE = /^ {0,3}>/
const LIST = /^( {0,3})([-+*]|\d{1,9}[.)])(?: +(.*)|$)/
const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/
const TABLE_ROW = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/

type ListItemStart = {
  readonly kind: 'bullet' | 'ordered' | 'task'
  /** The number an ordered list item is written with. */
  readonly number: number
  /** Columns before the content of the first line. */
  readonly contentColumn: number
  readonly indent: number
  /** The first line's content, without the marker and the checkbox. */
  readonly text: string
  readonly checked: boolean
}

function matchList(line: string): ListItemStart | null {
  if (RULE.test(line)) return null
  const match = LIST.exec(line)
  if (!match) return null
  const indent = (match[1] ?? '').length
  const marker = match[2] ?? ''
  const rest = match[3] ?? ''
  const gap = line.length - indent - marker.length - rest.length
  // Five spaces or more after the marker is a code block inside the item: one space belongs to
  // the marker, the rest to the content.
  const width = gap >= 5 || rest === '' ? 1 : gap
  const box = /^\[([ xX])\](?:[ \t]+|$)/.exec(rest)
  const bullet = /^[-+*]$/.test(marker)
  return {
    kind: box ? 'task' : bullet ? 'bullet' : 'ordered',
    number: bullet ? 1 : Number.parseInt(marker, 10),
    indent,
    contentColumn: indent + marker.length + width,
    text: box ? rest.slice(box[0].length) : (gap >= 5 ? ' '.repeat(gap - 1) : '') + rest,
    checked: box?.[1] !== undefined && box[1] !== ' ',
  }
}

const indentOf = (line: string): number => line.length - line.trimStart().length

/** A line that cannot continue a paragraph: it starts a block of its own. */
function startsBlock(line: string): boolean {
  if (ATX.test(line) || RULE.test(line) || QUOTE.test(line)) return true
  if (line.trimStart().startsWith('<!--')) return true
  const fence = FENCE.exec(line)
  if (fence && !(fence[2]?.startsWith('`') && fence[3]?.includes('`'))) return true
  const item = matchList(line)
  // Only a list that has content, and an ordered one that starts at 1, may interrupt a paragraph.
  return item !== null && item.text.trim() !== '' && (item.kind !== 'ordered' || item.number === 1)
}

function paragraph(text: string): JsonObject {
  const content = inlineNodes(text)
  return content.length === 0 ? { type: 'paragraph' } : { type: 'paragraph', content }
}

function codeBlock(text: string, language: string | null): JsonObject {
  return text === ''
    ? { type: 'codeBlock', attrs: { language } }
    : { type: 'codeBlock', attrs: { language }, content: [{ type: 'text', text }] }
}

/**
 * The cells of one table row: split at every `|` not written `\|`, with the outer pipes and the
 * spaces around each cell dropped. `\|` is a pipe inside a cell.
 */
function splitRow(line: string): string[] {
  let text = line.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1)
  const cells: string[] = []
  let cell = ''
  for (let at = 0; at < text.length; at++) {
    const ch = text.charAt(at)
    if (ch === '\\' && text.charAt(at + 1) === '|') {
      cell += '|'
      at++
    } else if (ch === '|') {
      cells.push(cell.trim())
      cell = ''
    } else cell += ch
  }
  cells.push(cell.trim())
  return cells
}

/**
 * A GFM table at `from`: a header row, a delimiter row (`| --- | :-: |`) with as many cells, and
 * body rows up to a blank line or the next block. Rows are padded or cut to the header's width,
 * so the table is always rectangular. Alignment is dropped: the editor has no such setting.
 */
function readTable(lines: string[], from: number): { node: JsonObject; next: number } | null {
  const head = lines[from] ?? ''
  const rule = lines[from + 1] ?? ''
  if (!head.includes('|') || !rule.includes('|') || !TABLE_ROW.test(rule)) return null
  const titles = splitRow(head)
  if (titles.length !== splitRow(rule).length) return null

  const cell = (type: 'tableHeader' | 'tableCell', text: string): JsonObject => ({
    type,
    content: [paragraph(text)],
  })
  const rows: JsonObject[] = [
    { type: 'tableRow', content: titles.map((title) => cell('tableHeader', title)) },
  ]
  let i = from + 2
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (BLANK.test(line) || startsBlock(line)) break
    const cells = splitRow(line)
    rows.push({
      type: 'tableRow',
      content: titles.map((_, column) => cell('tableCell', cells[column] ?? '')),
    })
    i++
  }
  return { node: { type: 'table', content: rows }, next: i }
}

/** Lines of a list item's or quote's body as blocks; never empty. */
function bodyBlocks(lines: string[], depth: number): JsonObject[] {
  const blocks = parseBlocks(lines, depth + 1)
  return blocks.length === 0 ? [{ type: 'paragraph' }] : blocks
}

/** A list item holds a paragraph first, then any other blocks. */
function itemBlocks(lines: string[], depth: number): JsonObject[] {
  const blocks = bodyBlocks(lines, depth)
  return blocks[0]?.['type'] === 'paragraph' ? blocks : [{ type: 'paragraph' }, ...blocks]
}

function readList(
  lines: string[],
  from: number,
  depth: number,
): { node: JsonObject; next: number } {
  const first = matchList(lines[from] ?? '')
  const kind = first?.kind ?? 'bullet'
  const items: JsonObject[] = []
  let i = from

  while (i < lines.length) {
    const start = matchList(lines[i] ?? '')
    if (!start || start.kind !== kind) break

    // The item's own lines: what is indented under its marker, blank lines between them, and
    // lines that continue its paragraph without being indented.
    const body = [start.text]
    const reach = start.indent + 2
    let j = i + 1
    while (j < lines.length) {
      const line = lines[j] ?? ''
      if (BLANK.test(line)) {
        let k = j
        while (k < lines.length && BLANK.test(lines[k] ?? '')) k++
        if (k >= lines.length || indentOf(lines[k] ?? '') < reach) break
        while (j < k) {
          body.push('')
          j++
        }
        continue
      }
      if (indentOf(line) >= reach) {
        body.push(line.slice(Math.min(start.contentColumn, indentOf(line))))
        j++
        continue
      }
      const previous = body[body.length - 1] ?? ''
      if (!BLANK.test(previous) && !startsBlock(line) && matchList(line) === null) {
        body.push(line.trimStart())
        j++
        continue
      }
      break
    }

    const content = itemBlocks(body, depth)
    items.push(
      kind === 'task'
        ? { type: 'taskItem', attrs: { checked: start.checked }, content }
        : { type: 'listItem', content },
    )
    i = j

    // Blank lines between items keep the list going when another item of its kind follows.
    let k = i
    while (k < lines.length && BLANK.test(lines[k] ?? '')) k++
    const following = k < lines.length ? matchList(lines[k] ?? '') : null
    if (following?.kind !== kind) break
    i = k
  }

  const content: Json[] = items
  const node: JsonObject =
    kind === 'task'
      ? { type: 'taskList', content }
      : kind === 'ordered'
        ? { type: 'orderedList', attrs: { start: first?.number ?? 1 }, content }
        : { type: 'bulletList', content }
  return { node, next: i }
}

/** Inline nodes of a block that is to live inside a callout, which holds only inline content. */
function inlineOf(block: JsonObject): Json[] {
  const type = block['type']
  if ((type === 'paragraph' || type === 'heading') && Array.isArray(block['content'])) {
    return block['content']
  }
  const out: Json[] = []
  plainTextOf(block)
    .split('\n')
    .forEach((line, index) => {
      if (index > 0) out.push({ type: 'hardBreak' })
      if (line !== '') out.push({ type: 'text', text: line })
    })
  return out
}

function callout(kind: string, blocks: JsonObject[]): JsonObject {
  const content: Json[] = [
    {
      type: 'text',
      text: CALLOUT_LABELS[kind.toUpperCase()] ?? 'Catatan',
      marks: [{ type: 'bold' }],
    },
  ]
  for (const block of blocks) {
    const nodes = inlineOf(block)
    if (nodes.length === 0) continue
    content.push({ type: 'hardBreak' }, ...nodes)
  }
  return { type: 'callout', content }
}

function readQuote(
  lines: string[],
  from: number,
  depth: number,
): { node: JsonObject; next: number } {
  const quoted: string[] = []
  let i = from
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (QUOTE.test(line)) {
      quoted.push(line.replace(/^ {0,3}> ?/, ''))
    } else if (
      !BLANK.test(line) &&
      !BLANK.test(quoted[quoted.length - 1] ?? '') &&
      !startsBlock(line)
    ) {
      quoted.push(line.trimStart())
    } else break
    i++
  }

  const alert = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/i.exec(quoted[0] ?? '')
  if (alert?.[1]) {
    return { node: callout(alert[1], parseBlocks(quoted.slice(1), depth + 1)), next: i }
  }
  return { node: { type: 'blockquote', content: bodyBlocks(quoted, depth) }, next: i }
}

function parseBlocks(lines: string[], depth: number): JsonObject[] {
  const blocks: JsonObject[] = []
  const nest = depth < MAX_DEPTH
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (BLANK.test(line)) {
      i++
      continue
    }

    const fence = FENCE.exec(line)
    const marker = fence?.[2] ?? ''
    const info = (fence?.[3] ?? '').trim()
    if (fence && !(marker.startsWith('`') && info.includes('`'))) {
      const lead = (fence[1] ?? '').length
      const closing = new RegExp(
        `^ {0,3}${marker.charAt(0) === '`' ? '`' : '~'}{${String(marker.length)},}[ \\t]*$`,
      )
      const code: string[] = []
      i++
      while (i < lines.length && !closing.test(lines[i] ?? '')) {
        const row = lines[i] ?? ''
        code.push(row.slice(Math.min(lead, indentOf(row))))
        i++
      }
      i++
      blocks.push(codeBlock(code.join('\n'), info.split(/\s+/)[0] || null))
      continue
    }

    if (line.trimStart().startsWith('<!--')) {
      while (i < lines.length && !(lines[i] ?? '').includes('-->')) i++
      i++
      continue
    }

    const atx = ATX.exec(line)
    if (atx) {
      const text = (atx[2] ?? '').replace(/(?:^|[ \t]+)#+$/, '')
      const content = inlineNodes(text)
      blocks.push({
        type: 'heading',
        // The depth as written; levels are fixed once the whole document has been read.
        attrs: { level: (atx[1] ?? '#').length },
        ...(content.length > 0 ? { content } : {}),
      })
      i++
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'horizontalRule' })
      i++
      continue
    }

    if (nest && QUOTE.test(line)) {
      const { node, next } = readQuote(lines, i, depth)
      blocks.push(node)
      i = next
      continue
    }

    if (nest && matchList(line)) {
      const { node, next } = readList(lines, i, depth)
      blocks.push(node)
      i = next
      continue
    }

    const table = readTable(lines, i)
    if (table) {
      blocks.push(table.node)
      i = table.next
      continue
    }

    // A paragraph, or a heading underlined with = or -.
    const text = [line.trimStart()]
    i++
    let level = 0
    while (i < lines.length) {
      const next = lines[i] ?? ''
      if (BLANK.test(next)) break
      if (/^ {0,3}=+[ \t]*$/.test(next)) level = 1
      else if (/^ {0,3}-+[ \t]*$/.test(next)) level = 2
      if (level > 0) {
        i++
        break
      }
      if (startsBlock(next)) break
      text.push(next.trimStart())
      i++
    }
    if (level > 0) {
      const content = inlineNodes(text.join(' '))
      blocks.push({
        type: 'heading',
        attrs: { level },
        ...(content.length > 0 ? { content } : {}),
      })
    } else blocks.push(paragraph(text.join('\n')))
  }
  return blocks
}

// ---------------------------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------------------------

/** Leading tabs count as four spaces, so indentation compares in one unit. */
function expandTabs(line: string): string {
  return line.replace(/^[ \t]+/, (lead) => lead.replace(/\t/g, '    '))
}

/** The `title` of a leading `---` block, and the lines after it; none if the block never closes. */
function splitFrontMatter(lines: string[]): { title: string | null; body: string[] } {
  if ((lines[0] ?? '').trimEnd() !== '---') return { title: null, body: lines }
  for (let end = 1; end < Math.min(lines.length, 200); end++) {
    const line = (lines[end] ?? '').trimEnd()
    if (line !== '---' && line !== '...') continue
    let title: string | null = null
    for (const row of lines.slice(1, end)) {
      const match = /^title:[ \t]*(.*?)[ \t]*$/.exec(row)
      if (match) title = (match[1] ?? '').replace(/^(["'])(.*)\1$/, '$2')
    }
    return { title: title === '' ? null : title, body: lines.slice(end + 1) }
  }
  return { title: null, body: lines }
}

function headingDepths(nodes: readonly Json[], found: number[] = []): number[] {
  for (const node of nodes) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) continue
    const attrs = node['attrs']
    const level =
      node['type'] === 'heading' && typeof attrs === 'object' && attrs !== null
        ? (attrs as JsonObject)['level']
        : undefined
    if (typeof level === 'number') found.push(level)
    if (Array.isArray(node['content'])) headingDepths(node['content'], found)
  }
  return found
}

/** Turns the depths headings were written with (1-6) into the editor's two levels. */
function setLevels(nodes: readonly Json[], shift: number): void {
  for (const node of nodes) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) continue
    const attrs = node['attrs']
    if (node['type'] === 'heading' && typeof attrs === 'object' && attrs !== null) {
      const heading = attrs as JsonObject
      const depth = typeof heading['level'] === 'number' ? heading['level'] : 1
      heading['level'] = depth - shift <= 1 ? 1 : 2
    }
    if (Array.isArray(node['content'])) setLevels(node['content'], shift)
  }
}

/**
 * Reads a Markdown file. A leading `# Heading` (or a front matter `title`) becomes the title and
 * is left out of the content; when that heading is the only level-1 heading, the headings
 * below it move up a level, so `##` becomes "Judul 1" and `###` "Judul 2".
 */
export function documentFromMarkdown(source: string): MarkdownDocument {
  const lines = (source.charCodeAt(0) === 0xfeff ? source.slice(1) : source)
    .split(/\r\n|\r|\n/)
    .map(expandTabs)
  const { title: metaTitle, body } = splitFrontMatter(lines)
  const blocks = parseBlocks(body, 0)

  let title = metaTitle
  let shift = 0
  const first = blocks[0]
  if (first?.['type'] === 'heading') {
    const attrs = first['attrs']
    const depth = typeof attrs === 'object' && attrs !== null ? (attrs as JsonObject)['level'] : 0
    const text = plainTextOf(first).trim()
    if (depth === 1 && (metaTitle === null || metaTitle.trim() === text)) {
      title = metaTitle ?? text
      blocks.shift()
      if (!headingDepths(blocks).includes(1)) shift = 1
    }
  }
  setLevels(blocks, shift)

  const cleaned = title?.replace(/\s*[\r\n]+\s*/g, ' ').trim() ?? ''
  return {
    title: cleaned === '' ? null : cleaned,
    content: { type: 'doc', content: blocks.length > 0 ? blocks : [{ type: 'paragraph' }] },
  }
}
