/**
 * The document editor: TipTap with the blocks of the "/" menu, task mentions that redraw from
 * the schedule, and a callout block. DocumentEditor.svelte loads this module only when a
 * document opens, so TipTap stays out of the first download. Content goes in and comes out as
 * the editor's JSON (see core/rich-text.ts); the component decides when a change is saved.
 */
import {
  Editor,
  Extension,
  mergeAttributes,
  Node,
  textblockTypeInputRule,
  type Range,
} from '@tiptap/core'
import Mention, { type MentionNodeAttrs } from '@tiptap/extension-mention'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, PluginKey, TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'
import { mount, unmount } from 'svelte'
import { TASK_MENTION, type Json } from '../../core/rich-text.ts'
import Icon from '../icons/Icon.svelte'
import { filterBlocks, type BlockChoice, type BlockKind } from './blocks.ts'
import { findTasks, type TaskLink } from './task-links.ts'

/** A suggestion menu while it is open: what it offers and where the caret is. */
export type EditorMenu =
  | {
      readonly kind: 'blocks'
      readonly items: readonly BlockChoice[]
      readonly rect: () => DOMRect | null
      readonly choose: (item: BlockChoice) => void
    }
  | {
      readonly kind: 'tasks'
      readonly items: readonly TaskLink[]
      readonly rect: () => DOMRect | null
      readonly choose: (item: TaskLink) => void
    }

export type EditorOptions = {
  readonly element: HTMLElement
  readonly content: Json
  /** Accessible name of the writing area. */
  readonly label: string
  /** The project's tasks as links, for the chips and the "@" menu; see showTasks. */
  readonly links: ReadonlyMap<string, TaskLink>
  /** The task whose chips are highlighted, if any. */
  readonly focusedTask: string | null
  /** Every change the person makes; content set from outside is not reported. */
  readonly onChange: (content: Json) => void
  readonly onMenu: (menu: EditorMenu | null) => void
  /** Keys while a menu is open; returns true when the menu used the key. */
  readonly onMenuKey: (event: KeyboardEvent) => boolean
  /** A mention chip was clicked. */
  readonly onMention: (taskId: string) => void
  readonly onFocus: () => void
  readonly onBlur: () => void
}

/** The top-level block under the pointer, for the gutter beside it. */
export type BlockSpot = { readonly pos: number; readonly element: HTMLElement }

export type DocumentEditor = {
  /** False when the stored content could not be read; the editor is then read-only. */
  readonly readable: boolean
  /** Shows other content, such as after an undo, without reporting it as a change. */
  setContent(content: Json): void
  /** New task links or highlight: mention chips draw again from them. */
  showTasks(links: ReadonlyMap<string, TaskLink>, focusedTask: string | null): void
  focus(where?: 'start' | 'end'): void
  /** The nth heading of the document, in order, as shown. */
  headingElement(index: number): HTMLElement | null
  blockAt(x: number, y: number): BlockSpot | null
  /** Adds an empty paragraph after a block and opens the "/" menu in it. */
  addBlockAfter(pos: number): void
  /** Starts dragging a block by its handle; the editor moves it where it is dropped. */
  dragBlock(pos: number, event: DragEvent): void
  /** A drag from the handle ended, dropped or not. */
  endDrag(): void
  destroy(): void
}

const SLASH_KEY = new PluginKey('slash-menu')

/**
 * Headings inside a document. The document title is a level-2 heading on the page, so
 * "Judul 1" is drawn as h3 and "Judul 2" as h4, while the stored levels stay 1 and 2.
 */
const DocumentHeading = Node.create({
  name: 'heading',
  content: 'inline*',
  group: 'block',
  defining: true,
  addAttributes() {
    return { level: { default: 1, rendered: false } }
  },
  parseHTML() {
    return [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 1 } },
      { tag: 'h3', attrs: { level: 1 } },
      { tag: 'h4', attrs: { level: 2 } },
      { tag: 'h5', attrs: { level: 2 } },
      { tag: 'h6', attrs: { level: 2 } },
    ]
  },
  renderHTML({ node, HTMLAttributes }) {
    const level: unknown = node.attrs['level']
    return [level === 2 ? 'h4' : 'h3', HTMLAttributes, 0]
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Alt-1': () => this.editor.commands.toggleNode(this.name, 'paragraph', { level: 1 }),
      'Mod-Alt-2': () => this.editor.commands.toggleNode(this.name, 'paragraph', { level: 2 }),
    }
  },
  addInputRules() {
    return [
      textblockTypeInputRule({ find: /^#\s$/, type: this.type, getAttributes: { level: 1 } }),
      textblockTypeInputRule({ find: /^##\s$/, type: this.type, getAttributes: { level: 2 } }),
    ]
  },
})

/** A highlighted note with a light bulb, for what must not be missed. */
const Callout = Node.create({
  name: 'callout',
  content: 'inline*',
  group: 'block',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout', role: 'note' }), 0]
  },
  addNodeView() {
    return () => {
      const dom = document.createElement('div')
      dom.className = 'callout'
      dom.dataset['type'] = 'callout'
      dom.setAttribute('role', 'note')
      const icon = document.createElement('span')
      icon.className = 'callout-icon'
      icon.contentEditable = 'false'
      const bulb = mount(Icon, { target: icon, props: { name: 'lightbulb', size: 18 } })
      const contentDOM = document.createElement('div')
      contentDOM.className = 'callout-text'
      dom.append(icon, contentDOM)
      return {
        dom,
        contentDOM,
        destroy: () => {
          void unmount(bulb)
        },
      }
    }
  },
})

/**
 * Alt+Shift with an arrow moves the block holding the caret past its neighbour, the keyboard's
 * way to do what dragging the handle does. The caret moves with it.
 */
const MoveBlock = Extension.create({
  name: 'moveBlock',
  addKeyboardShortcuts() {
    const move = (direction: -1 | 1) => (): boolean => {
      const { state, view } = this.editor
      const { selection } = state
      const { $from } = selection
      if ($from.depth === 0) return false
      const index = $from.index(0)
      const node = state.doc.child(index)
      const from = $from.before(1)
      // A selection across several blocks is left alone.
      if (selection.to > from + node.nodeSize) return false
      const neighbour = index + direction
      // At either end there is nowhere to go, but the keys still belong to this command.
      if (neighbour < 0 || neighbour >= state.doc.childCount) return true
      const other = state.doc.child(neighbour)
      const start = direction === -1 ? from - other.nodeSize : from + other.nodeSize
      const tr = state.tr.delete(from, from + node.nodeSize).insert(start, node)
      const anchor = tr.doc.resolve(start + selection.anchor - from)
      const head = tr.doc.resolve(start + selection.head - from)
      view.dispatch(tr.setSelection(TextSelection.between(anchor, head)).scrollIntoView())
      return true
    }
    return { 'Alt-Shift-ArrowUp': move(-1), 'Alt-Shift-ArrowDown': move(1) }
  },
})

/** Turns the current line into the chosen block; the "/" and what was typed after it go. */
function applyBlock(editor: Editor, range: Range, kind: BlockKind): void {
  const chain = editor.chain().focus().deleteRange(range)
  switch (kind) {
    case 'paragraph':
      chain.setParagraph()
      break
    case 'heading-1':
      chain.setNode('heading', { level: 1 })
      break
    case 'heading-2':
      chain.setNode('heading', { level: 2 })
      break
    case 'bullet-list':
      chain.toggleBulletList()
      break
    case 'ordered-list':
      chain.toggleOrderedList()
      break
    case 'task-list':
      chain.toggleTaskList()
      break
    case 'quote':
      chain.toggleBlockquote()
      break
    case 'callout':
      chain.setNode('callout')
      break
    case 'mention':
      chain.insertContent('@')
      break
  }
  chain.run()
}

function taskIdOf(node: ProseMirrorNode): string {
  const id: unknown = node.attrs['id']
  return typeof id === 'string' ? id : ''
}

function labelOf(node: ProseMirrorNode): string {
  const label: unknown = node.attrs['label']
  return typeof label === 'string' ? label : ''
}

export function createDocumentEditor(options: EditorOptions): DocumentEditor {
  const redraws = new Set<() => void>()
  // What the chips show; replaced by showTasks when the schedule or highlight changes.
  const tasks = { links: options.links, focused: options.focusedTask }
  // Cleared while the editor is created when the stored content does not fit its schema.
  const status = { readable: true }

  /** Each suggestion menu tells the component what it shows, and hands keys to it. */
  const menuRenderer =
    <I, S>(describe: (props: SuggestionProps<I, S>) => EditorMenu) =>
    () => ({
      onStart: (props: SuggestionProps<I, S>) => {
        options.onMenu(describe(props))
      },
      onUpdate: (props: SuggestionProps<I, S>) => {
        options.onMenu(describe(props))
      },
      // Escape is the suggestion's own: it closes the menu and calls onExit.
      onKeyDown: ({ event }: { event: KeyboardEvent }) =>
        event.key !== 'Escape' && options.onMenuKey(event),
      onExit: () => {
        options.onMenu(null)
      },
    })

  const TaskMention = Mention.extend({
    name: TASK_MENTION,
    addNodeView() {
      return ({ node }) => {
        let current = node
        const dom = document.createElement('span')
        dom.className = 'mention'
        dom.contentEditable = 'false'
        const chip = document.createElement('span')
        chip.className = 'mention-type mono'
        const name = document.createElement('span')
        name.className = 'mention-name'
        const meta = document.createElement('span')
        meta.className = 'mention-meta mono'
        dom.append(chip, name, meta)

        const draw = (): void => {
          const id = taskIdOf(current)
          const link = tasks.links.get(id)
          dom.dataset['taskId'] = id
          dom.classList.toggle('is-missing', link === undefined)
          dom.classList.toggle('is-focused', tasks.focused === id)
          chip.hidden = link?.type == null
          chip.textContent = link?.type ?? ''
          chip.dataset['type'] = link?.type ?? ''
          name.textContent = link?.name ?? labelOf(current)
          meta.textContent = link ? link.meta : 'dihapus'
          dom.title = link ? `Tampilkan ${link.name} di samping` : 'Tugas ini sudah dihapus'
        }
        const open = (event: MouseEvent): void => {
          event.preventDefault()
          options.onMention(taskIdOf(current))
        }
        draw()
        redraws.add(draw)
        dom.addEventListener('click', open)
        return {
          dom,
          update: (updated) => {
            if (updated.type !== current.type) return false
            current = updated
            draw()
            return true
          },
          ignoreMutation: () => true,
          destroy: () => {
            redraws.delete(draw)
            dom.removeEventListener('click', open)
          },
        }
      }
    },
  }).configure({
    deleteTriggerWithBackspace: true,
    renderText: ({ node }) => tasks.links.get(taskIdOf(node))?.name ?? labelOf(node),
    renderHTML: ({ node }) => [
      'span',
      { 'data-type': TASK_MENTION, 'data-id': taskIdOf(node), 'data-label': labelOf(node) },
      tasks.links.get(taskIdOf(node))?.name ?? labelOf(node),
    ],
    suggestion: {
      char: '@',
      allowSpaces: true,
      items: ({ query }) => findTasks(tasks.links.values(), query),
      render: menuRenderer<TaskLink, MentionNodeAttrs>((props) => ({
        kind: 'tasks',
        items: props.items,
        rect: () => props.clientRect?.() ?? null,
        choose: (link) => {
          props.command({ id: link.id, label: link.name })
        },
      })),
    },
  })

  const SlashMenu = Extension.create({
    name: 'slashMenu',
    addProseMirrorPlugins() {
      return [
        Suggestion<BlockChoice, BlockChoice>({
          editor: this.editor,
          pluginKey: SLASH_KEY,
          char: '/',
          items: ({ query }) => filterBlocks(query),
          command: ({ editor, range, props }) => {
            applyBlock(editor, range, props.kind)
          },
          render: menuRenderer<BlockChoice, BlockChoice>((props) => ({
            kind: 'blocks',
            items: props.items,
            rect: () => props.clientRect?.() ?? null,
            choose: (choice) => {
              props.command(choice)
            },
          })),
        }),
      ]
    },
  })

  const editor = new Editor({
    element: options.element,
    content: options.content as object,
    enableContentCheck: true,
    onContentError: () => {
      status.readable = false
    },
    extensions: [
      StarterKit.configure({
        heading: false,
        link: { openOnClick: false, autolink: true },
      }),
      DocumentHeading,
      Callout,
      TaskList,
      TaskItem.configure({
        nested: true,
        a11y: {
          checkboxLabel: (node, checked) =>
            `${checked ? 'Selesai' : 'Belum selesai'}: ${node.textContent || 'langkah kosong'}`,
        },
      }),
      Placeholder.configure({
        placeholder: ({ editor: current, node }) => {
          if (current.isEmpty) return 'Mulai menulis, atau ketik / untuk memilih jenis blok'
          if (node.type.name === 'heading') return 'Judul'
          return 'Ketik / untuk blok, @ untuk menyebut tugas'
        },
      }),
      TaskMention,
      SlashMenu,
      MoveBlock,
    ],
    editorProps: {
      attributes: {
        class: 'doc-body',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': options.label,
      },
    },
    onUpdate: ({ editor: current }) => {
      options.onChange(current.getJSON() as Json)
    },
    onFocus: () => {
      options.onFocus()
    },
    onBlur: () => {
      options.onBlur()
    },
  })
  if (!status.readable) editor.setEditable(false)

  return {
    get readable() {
      return status.readable
    },
    setContent(content) {
      // Not an undo step inside the editor either: the app's own history covers it.
      editor
        .chain()
        .command(({ tr }) => {
          tr.setMeta('addToHistory', false)
          return true
        })
        .setContent(content as object, { emitUpdate: false })
        .run()
    },
    showTasks(links, focusedTask) {
      tasks.links = links
      tasks.focused = focusedTask
      for (const draw of redraws) draw()
    },
    focus(where = 'end') {
      editor.commands.focus(where)
    },
    headingElement(index) {
      // In document order, the same order core's headingsOf reads them.
      const headings = editor.view.dom.querySelectorAll<HTMLElement>('h3, h4')
      return headings[index] ?? null
    },
    blockAt(x, y) {
      const found = editor.view.posAtCoords({ left: x, top: y })
      if (!found) return null
      // Inside text the block is the outermost node around it; between blocks, a leaf such
      // as a divider is the node the point is in.
      const $pos = editor.state.doc.resolve(found.pos)
      const pos = $pos.depth >= 1 ? $pos.before(1) : found.inside >= 0 ? found.inside : null
      if (pos === null) return null
      const element = editor.view.nodeDOM(pos)
      return element instanceof HTMLElement ? { pos, element } : null
    },
    addBlockAfter(pos) {
      const node = editor.state.doc.nodeAt(pos)
      if (!node) return
      const after = pos + node.nodeSize
      editor
        .chain()
        .insertContentAt(after, { type: 'paragraph' })
        .command(({ tr }) => {
          tr.setSelection(TextSelection.create(tr.doc, after + 1))
          return true
        })
        .insertContent('/')
        .focus()
        .run()
    },
    dragBlock(pos, event) {
      const { view } = editor
      const selection = NodeSelection.create(view.state.doc, pos)
      const element = view.nodeDOM(pos)
      view.dispatch(view.state.tr.setSelection(selection))
      view.dragging = { slice: selection.content(), move: true }
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', selection.node.textContent)
        if (element instanceof HTMLElement) event.dataTransfer.setDragImage(element, 0, 0)
      }
    },
    endDrag() {
      // A drop inside the editor has already cleared it; one outside has not.
      setTimeout(() => {
        editor.view.dragging = null
      }, 50)
    },
    destroy() {
      redraws.clear()
      editor.destroy()
    },
  }
}
