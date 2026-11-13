/**
 * Rich text as Rentang stores it: the editor's JSON document, a tree of nodes that each have a
 * `type` and optionally `attrs`, `content` and, for text, `text`. Core never edits a document
 * the way the editor does. It builds simple ones and reads them: plain text, word count,
 * headings, and which tasks a document mentions. Anything that is not a well-formed node is
 * skipped, so a damaged file still opens.
 */

/** A JSON value, the same shape the project schema accepts for rich text. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

/** Node type of a task mention: `attrs.id` is the task id, `attrs.label` its name when written. */
export const TASK_MENTION = 'taskMention'

type Node = {
  readonly type: string
  readonly attrs?: Readonly<Record<string, unknown>>
  readonly content?: readonly unknown[]
  readonly text?: string
}

export type Heading = {
  /** 1 for "Judul 1", 2 for "Judul 2". */
  readonly level: number
  readonly text: string
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { type?: unknown }).type === 'string'
  )
}

function childrenOf(node: Node): Node[] {
  return Array.isArray(node.content) ? node.content.filter(isNode) : []
}

/** Text and inline nodes sit inside a line; every other node is a block of its own. */
function isInline(node: Node): boolean {
  return node.type === 'text' || node.type === 'hardBreak' || node.type === TASK_MENTION
}

function stringAttr(node: Node, name: string): string | null {
  const value = node.attrs?.[name]
  return typeof value === 'string' ? value : null
}

/** Every node of the tree, parents before their children, in document order. */
function* walk(node: Node): Generator<Node> {
  yield node
  for (const child of childrenOf(node)) yield* walk(child)
}

/** An empty document: one empty paragraph, which is what the editor starts from. */
export function emptyDocument(): Json {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/** Plain text as a document with one paragraph per line; an empty line stays an empty paragraph. */
export function documentFromText(text: string): Json {
  return {
    type: 'doc',
    content: text
      .split(/\r?\n/)
      .map((line) =>
        line === ''
          ? { type: 'paragraph' }
          : { type: 'paragraph', content: [{ type: 'text', text: line }] },
      ),
  }
}

/**
 * The text of a document, one line per block. A mention reads as the task's current name when
 * `nameOf` knows it, else as the name stored when it was written. Plain text (older notes) is
 * returned as it is.
 */
export function plainTextOf(
  content: unknown,
  nameOf: (taskId: string) => string | undefined = () => undefined,
): string {
  if (typeof content === 'string') return content
  if (!isNode(content)) return ''
  const textOf = (node: Node): string => {
    if (node.type === 'text') return typeof node.text === 'string' ? node.text : ''
    if (node.type === 'hardBreak') return '\n'
    if (node.type === TASK_MENTION) {
      const id = stringAttr(node, 'id')
      return (id === null ? undefined : nameOf(id)) ?? stringAttr(node, 'label') ?? ''
    }
    const children = childrenOf(node)
    // The cells of a table row stay on one line, a tab apart.
    if (node.type === 'tableRow') return children.map(textOf).join('\t')
    return children.map(textOf).join(children.some(isInline) ? '' : '\n')
  }
  return textOf(content)
}

/** Words in a text: runs of characters between spaces that hold at least a letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

/** The document's headings in order, for its outline. */
export function headingsOf(content: unknown): Heading[] {
  if (!isNode(content)) return []
  const headings: Heading[] = []
  for (const node of walk(content)) {
    const level = node.attrs?.['level']
    if (node.type === 'heading' && typeof level === 'number') {
      headings.push({ level, text: plainTextOf(node) })
    }
  }
  return headings
}

/** Ids of the tasks a document mentions, each once, in the order they first appear. */
export function mentionedTaskIds(content: unknown): string[] {
  if (!isNode(content)) return []
  const ids = new Set<string>()
  for (const node of walk(content)) {
    const id = node.type === TASK_MENTION ? stringAttr(node, 'id') : null
    if (id !== null && id !== '') ids.add(id)
  }
  return [...ids]
}

/** The documents that mention a task, in their list order. */
export function documentsMentioning<
  D extends { readonly content: unknown; readonly order: number },
>(documents: readonly D[], taskId: string): D[] {
  return documents
    .filter((document) => mentionedTaskIds(document.content).includes(taskId))
    .sort((a, b) => a.order - b.order)
}
