/**
 * The public demo: a fictional coffee-shop launch. Dates are shifted by whole weeks so the
 * project is always under way on the day the demo is opened.
 */
import { addDays, dayOfWeek, diffDays, toIsoDate, type IsoDate } from '../../core/dates.ts'
import type { Dependency, Project, Task } from '../../core/model.ts'

export const DEMO_PROJECT_ID = 'demo-kedai-kopi'

const BASE_MONDAY = toIsoDate('2026-11-02')

type Row = {
  id: string
  name: string
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
    start: '2026-11-02',
    duration: 3,
    progress: 100,
    parent: '1',
    notes: 'Bandingkan tiga lokasi. Catat lalu lintas pejalan kaki pagi dan sore.',
  },
  {
    id: '3',
    name: 'Izin usaha',
    start: '2026-11-05',
    duration: 4,
    progress: 100,
    after: ['2'],
    parent: '1',
  },
  {
    id: '4',
    name: 'Kontrak sewa',
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
    start: '2026-11-18',
    duration: 8,
    progress: 0,
    after: ['6'],
    parent: '5',
  },
  {
    id: '8',
    name: 'Pasang mesin espresso',
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
    start: '2026-11-12',
    duration: 6,
    progress: 10,
    after: ['3'],
    parent: '9',
  },
  {
    id: '11',
    name: 'Pelatihan barista',
    start: '2026-12-02',
    duration: 3,
    progress: 0,
    after: ['8', '10'],
    parent: '9',
  },
  {
    id: '12',
    name: 'Uji coba menu',
    start: '2026-12-07',
    duration: 2,
    progress: 0,
    after: ['11'],
    parent: '9',
  },
  { id: '13', name: 'Soft opening', start: '2026-12-09', duration: 0, progress: 0, after: ['12'] },
]

function paragraph(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

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
    resources: [
      { id: 'r1', name: 'Sinta (fiktif)' },
      { id: 'r2', name: 'Bayu (fiktif)' },
    ],
    assignments: [
      { id: '6:r1', taskId: '6', resourceId: 'r1' },
      { id: '10:r2', taskId: '10', resourceId: 'r2' },
    ],
    documents: [],
  }
}
