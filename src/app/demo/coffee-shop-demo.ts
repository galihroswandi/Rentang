/**
 * The public demo: a fictional coffee-shop launch. Dates are shifted by whole weeks so the
 * project is always under way on the day the demo is opened.
 */
import { addDays, dayOfWeek, diffDays, toIsoDate, type IsoDate } from '../../core/dates.ts'
import type { Dependency, Project, ProjectDocument, Task, TaskType } from '../../core/model.ts'
import { TASK_MENTION, type Json } from '../../core/rich-text.ts'

export const DEMO_PROJECT_ID = 'demo-kedai-kopi'

const BASE_MONDAY = toIsoDate('2026-11-02')

type Row = {
  id: string
  name: string
  type?: TaskType
  start: string
  duration: number
  progress: number
  after?: string[]
  parent?: string
  notes?: string
}

const rows: Row[] = [
  { id: '1', name: 'Persiapan', start: '2026-11-02', duration: 7, progress: 0 },
  {
    id: '2',
    name: 'Survei lokasi',
    type: 'DOC',
    start: '2026-11-02',
    duration: 3,
    progress: 100,
    parent: '1',
    notes: 'Bandingkan tiga lokasi. Catat lalu lintas pejalan kaki pagi dan sore.',
  },
  {
    id: '3',
    name: 'Izin usaha',
    type: 'DOC',
    start: '2026-11-05',
    duration: 4,
    progress: 100,
    after: ['2'],
    parent: '1',
  },
  {
    id: '4',
    name: 'Kontrak sewa',
    type: 'REV',
    start: '2026-11-05',
    duration: 3,
    progress: 90,
    after: ['2'],
    parent: '1',
  },
  { id: '5', name: 'Renovasi', start: '2026-11-11', duration: 15, progress: 0 },
  {
    id: '6',
    name: 'Desain interior',
    type: 'DSG',
    start: '2026-11-11',
    duration: 5,
    progress: 50,
    after: ['3'],
    parent: '5',
    notes: 'Nuansa kayu hangat, meja bar enam kursi.',
  },
  {
    id: '7',
    name: 'Pengerjaan ruang',
    type: 'IMP',
    start: '2026-11-18',
    duration: 8,
    progress: 0,
    after: ['6'],
    parent: '5',
  },
  {
    id: '8',
    name: 'Pasang mesin espresso',
    type: 'IMP',
    start: '2026-11-30',
    duration: 2,
    progress: 0,
    after: ['7'],
    parent: '5',
  },
  { id: '9', name: 'Operasional', start: '2026-11-12', duration: 20, progress: 0 },
  {
    id: '10',
    name: 'Rekrut barista',
    type: 'REV',
    start: '2026-11-12',
    duration: 6,
    progress: 10,
    after: ['3'],
    parent: '9',
  },
  {
    id: '11',
    name: 'Pelatihan barista',
    type: 'DOC',
    start: '2026-12-02',
    duration: 3,
    progress: 0,
    after: ['8', '10'],
    parent: '9',
  },
  {
    id: '12',
    name: 'Uji coba menu',
    type: 'FIX',
    start: '2026-12-07',
    duration: 2,
    progress: 0,
    after: ['11'],
    parent: '9',
  },
  { id: '13', name: 'Soft opening', start: '2026-12-09', duration: 0, progress: 0, after: ['12'] },
]

const roles = [
  { id: 'manajer', name: 'Manajer proyek' },
  { id: 'desainer', name: 'Desainer' },
  { id: 'barista', name: 'Barista' },
  { id: 'kontraktor', name: 'Kontraktor' },
]

const people = [
  { id: 'sw', name: 'Sari Wulandari', roleId: 'manajer', tasks: ['2', '3', '4', '10'] },
  { id: 'la', name: 'Laras Anggraini', roleId: 'desainer', tasks: ['6'] },
  { id: 'dp', name: 'Dimas Pratama', roleId: 'barista', tasks: ['11', '12'] },
  { id: 'bs', name: 'Bagas Setiawan', roleId: 'kontraktor', tasks: ['7', '8'] },
  { id: 'rm', name: 'Rina Maharani', roleId: 'barista', tasks: ['11', '12'] },
]

function paragraph(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

// Building blocks for the demo documents, in the editor's JSON shape. A string is plain text;
// `{ task }` mentions a task by id, labelled with its name as the editor would write it.
type Inline = string | { readonly task: string }

function inline(parts: readonly Inline[]): Json[] {
  return parts.map((part) => {
    if (typeof part === 'string') return { type: 'text', text: part }
    const label = rows.find((row) => row.id === part.task)?.name ?? ''
    return { type: TASK_MENTION, attrs: { id: part.task, label, mentionSuggestionChar: '@' } }
  })
}

const block = {
  heading: (text: string): Json => ({
    type: 'heading',
    attrs: { level: 1 },
    content: [{ type: 'text', text }],
  }),
  text: (...parts: Inline[]): Json => ({ type: 'paragraph', content: inline(parts) }),
  checks: (...items: [checked: boolean, ...parts: Inline[]][]): Json => ({
    type: 'taskList',
    content: items.map(([checked, ...parts]) => ({
      type: 'taskItem',
      attrs: { checked },
      content: [{ type: 'paragraph', content: inline(parts) }],
    })),
  }),
  bullets: (...items: string[]): Json => ({
    type: 'bulletList',
    content: items.map((item) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
    })),
  }),
  callout: (...parts: Inline[]): Json => ({ type: 'callout', content: inline(parts) }),
  quote: (text: string): Json => ({
    type: 'blockquote',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }),
}

/** Fictional documents; `daysAgo` sets when each was last changed, relative to the demo's today. */
const documents: { id: string; title: string; daysAgo: number; blocks: Json[] }[] = [
  {
    id: 'doc-rencana',
    title: 'Rencana peluncuran',
    daysAgo: 0,
    blocks: [
      block.heading('Tujuan'),
      block.text(
        'Kedai dibuka untuk umum pada ',
        { task: '13' },
        ' dengan menu inti yang sudah diuji.',
      ),
      block.heading('Keputusan minggu ini'),
      block.checks(
        [true, 'Lokasi B dipilih: dekat kampus, ramai pagi dan sore.'],
        [true, 'Palet kayu hangat untuk interior, disetujui Laras.'],
        [false, 'Pastikan ', { task: '8' }, ' selesai sebelum ', { task: '11' }, '.'],
      ),
      block.callout(
        'Jika ',
        { task: '7' },
        ' molor, soft opening ikut mundur. Cek jalur kritis setiap Senin.',
      ),
      block.heading('Langkah berikutnya'),
      block.text('Gambar kerja dari ', { task: '6' }, ' harus selesai sebelum tim renovasi masuk.'),
    ],
  },
  {
    id: 'doc-rapat',
    title: 'Catatan rapat mingguan',
    daysAgo: 2,
    blocks: [
      block.heading('Hadir'),
      block.text('Sari, Laras, dan Bagas.'),
      block.heading('Hasil'),
      block.checks(
        [true, 'Revisi desain meja bar disetujui.'],
        [false, 'Bagas mengirim jadwal tukang paling lambat Jumat.'],
      ),
      block.text('Tanggal ', { task: '13' }, ' tetap, tidak digeser.'),
    ],
  },
  {
    id: 'doc-pemasok',
    title: 'Daftar pemasok',
    daysAgo: 4,
    blocks: [
      block.heading('Biji kopi'),
      block.text('Tiga pemasok dibandingkan dari rasa, harga per kilogram, dan jadwal kirim.'),
      block.bullets(
        'Pemasok A: arabika, kirim setiap minggu',
        'Pemasok B: robusta, harga paling rendah',
        'Pemasok C: campuran, pesanan minimal 10 kg',
      ),
    ],
  },
  {
    id: 'doc-menu',
    title: 'Menu dan harga',
    daysAgo: 7,
    blocks: [
      block.heading('Menu inti'),
      block.text(
        'Enam minuman inti dan dua kudapan. Harga final ditetapkan setelah ',
        { task: '12' },
        '.',
      ),
      block.bullets('Kopi susu gula aren', 'Americano', 'Cappuccino', 'Teh melati'),
    ],
  },
  {
    id: 'doc-promosi',
    title: 'Ide promosi',
    daysAgo: 14,
    blocks: [
      block.heading('Media sosial'),
      block.text('Unggahan hitung mundur dua minggu sebelum ', { task: '13' }, '.'),
      block.quote('Kopi hangat, kursi nyaman, dekat kampus.'),
    ],
  },
]

export function createDemoProject(today: IsoDate): Project {
  // Two weeks before the Monday of this week, so today falls in the second phase.
  const thisMonday = addDays(today, -((dayOfWeek(today) + 6) % 7))
  const shift = diffDays(BASE_MONDAY, addDays(thisMonday, -14))
  const move = (date: string): IsoDate => addDays(toIsoDate(date), shift)

  const order = new Map<string, number>()
  const tasks = rows.map((row): Task => {
    const key = row.parent ?? ''
    const position = order.get(key) ?? 0
    order.set(key, position + 1)
    return {
      id: row.id,
      name: row.name,
      start: move(row.start),
      duration: row.duration,
      progress: row.progress,
      isMilestone: row.duration === 0,
      order: position,
      ...(row.type === undefined ? {} : { type: row.type }),
      ...(row.parent === undefined ? {} : { parentId: row.parent }),
      ...(row.notes === undefined ? {} : { notes: paragraph(row.notes) }),
    }
  })
  const dependencies = rows.flatMap((row) =>
    (row.after ?? []).map((from): Dependency => ({
      id: `${from}-${row.id}`,
      from,
      to: row.id,
      type: 'finish-to-start',
      lag: 0,
    })),
  )

  return {
    id: DEMO_PROJECT_ID,
    name: 'Peluncuran Kedai Kopi',
    area: 'work',
    calendar: { workingDays: [1, 2, 3, 4, 5], holidays: [] },
    tasks,
    dependencies,
    roles,
    resources: people.map(({ id, name, roleId }) => ({ id, name, roleId })),
    assignments: people.flatMap((person) =>
      person.tasks.map((taskId) => ({
        id: `${taskId}:${person.id}`,
        taskId,
        resourceId: person.id,
      })),
    ),
    documents: documents.map(({ id, title, daysAgo, blocks }, order): ProjectDocument => ({
      id,
      title,
      content: { type: 'doc', content: blocks },
      order,
      updatedAt: `${addDays(today, -daysAgo)}T02:00:00.000Z`,
    })),
  }
}
