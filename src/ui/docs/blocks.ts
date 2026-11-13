/** The "/" menu: kinds of block a document can hold, and how typing narrows them down. */

/** Names from the icon set (Icon.svelte) that the menu shows. */
export type BlockIcon =
  | 'type'
  | 'heading-1'
  | 'heading-2'
  | 'list'
  | 'list-ordered'
  | 'list-checks'
  | 'text-quote'
  | 'lightbulb'
  | 'table'
  | 'at-sign'

export type BlockKind =
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'bullet-list'
  | 'ordered-list'
  | 'task-list'
  | 'quote'
  | 'callout'
  | 'table'
  | 'mention'

export type BlockChoice = {
  readonly kind: BlockKind
  readonly group: 'Blok dasar' | 'Tautan'
  readonly label: string
  readonly description: string
  /** The shortcut typed at the start of a line, shown on the right; empty when there is none. */
  readonly hint: string
  readonly icon: BlockIcon
  /** Other words that find it. */
  readonly keywords: readonly string[]
}

export const BLOCK_CHOICES: readonly BlockChoice[] = [
  {
    kind: 'paragraph',
    group: 'Blok dasar',
    label: 'Teks',
    description: 'Paragraf biasa',
    hint: '',
    icon: 'type',
    keywords: ['paragraf', 'text'],
  },
  {
    kind: 'heading-1',
    group: 'Blok dasar',
    label: 'Judul 1',
    description: 'Judul bagian',
    hint: '#',
    icon: 'heading-1',
    keywords: ['h1', 'heading'],
  },
  {
    kind: 'heading-2',
    group: 'Blok dasar',
    label: 'Judul 2',
    description: 'Judul subbagian',
    hint: '##',
    icon: 'heading-2',
    keywords: ['h2', 'subjudul', 'heading'],
  },
  {
    kind: 'bullet-list',
    group: 'Blok dasar',
    label: 'Daftar',
    description: 'Daftar berpoin',
    hint: '-',
    icon: 'list',
    keywords: ['poin', 'bullet', 'list'],
  },
  {
    kind: 'ordered-list',
    group: 'Blok dasar',
    label: 'Daftar bernomor',
    description: 'Langkah yang berurutan',
    hint: '1.',
    icon: 'list-ordered',
    keywords: ['nomor', 'angka', 'numbered'],
  },
  {
    kind: 'task-list',
    group: 'Blok dasar',
    label: 'Daftar centang',
    description: 'Langkah kecil yang bisa dicentang',
    hint: '[ ]',
    icon: 'list-checks',
    keywords: ['centang', 'checklist', 'todo'],
  },
  {
    kind: 'quote',
    group: 'Blok dasar',
    label: 'Kutipan',
    description: 'Kutip ucapan atau sumber',
    hint: '>',
    icon: 'text-quote',
    keywords: ['quote', 'kutip'],
  },
  {
    kind: 'callout',
    group: 'Blok dasar',
    label: 'Sorotan',
    description: 'Catatan penting dengan ikon',
    hint: '',
    icon: 'lightbulb',
    keywords: ['callout', 'penting'],
  },
  {
    kind: 'table',
    group: 'Blok dasar',
    label: 'Tabel',
    description: 'Baris dan kolom, tabel Markdown ikut terbaca',
    hint: '',
    icon: 'table',
    keywords: ['table', 'kolom', 'baris', 'grid'],
  },
  {
    kind: 'mention',
    group: 'Tautan',
    label: 'Sebut tugas',
    description: 'Tautkan tugas dari Gantt',
    hint: '@',
    icon: 'at-sign',
    keywords: ['tugas', 'mention', 'tautan', 'task'],
  },
]

/**
 * Choices for what was typed after "/", in menu order: a word of the label or a keyword
 * starting with it. Nothing typed shows them all.
 */
export function filterBlocks(query: string): BlockChoice[] {
  const wanted = query.trim().toLocaleLowerCase('id')
  if (wanted === '') return [...BLOCK_CHOICES]
  return BLOCK_CHOICES.filter((choice) =>
    [...choice.label.toLocaleLowerCase('id').split(/\s+/), ...choice.keywords].some((word) =>
      word.startsWith(wanted),
    ),
  )
}
