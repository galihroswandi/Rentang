// The fictional "Peluncuran Kedai Kopi" project used by the golden tests.
import { toIsoDate } from '../dates.ts'
import type { Dependency, Project, Task } from '../model.ts'

type Row = [
  id: string,
  name: string,
  start: string,
  duration: number,
  dependsOn: string[],
  parent?: string,
]

const rows: Row[] = [
  ['1', 'Persiapan', '2026-11-02', 7, []],
  ['2', 'Survei lokasi', '2026-11-02', 3, [], '1'],
  ['3', 'Izin usaha', '2026-11-05', 4, ['2'], '1'],
  ['4', 'Kontrak sewa', '2026-11-05', 3, ['2'], '1'],
  ['5', 'Renovasi', '2026-11-11', 15, []],
  ['6', 'Desain interior', '2026-11-11', 5, ['3'], '5'],
  ['7', 'Pengerjaan ruang', '2026-11-18', 8, ['6'], '5'],
  ['8', 'Pasang mesin espresso', '2026-11-30', 2, ['7'], '5'],
  ['9', 'Operasional', '2026-11-12', 20, []],
  ['10', 'Rekrut barista', '2026-11-12', 6, ['3'], '9'],
  ['11', 'Pelatihan barista', '2026-12-02', 3, ['8', '10'], '9'],
  ['12', 'Uji coba menu', '2026-12-07', 2, ['11'], '9'],
  ['13', 'Soft opening', '2026-12-09', 0, ['12'], '9'],
]

export function coffeeShopProject(holidays: string[] = []): Project {
  const siblingOrder = new Map<string, number>()
  const tasks = rows.map(([id, name, start, duration, , parent]): Task => {
    const key = parent ?? ''
    const order = siblingOrder.get(key) ?? 0
    siblingOrder.set(key, order + 1)
    return {
      id,
      name,
      start: toIsoDate(start),
      duration,
      progress: 0,
      isMilestone: duration === 0,
      order,
      ...(parent === undefined ? {} : { parentId: parent }),
    }
  })
  const dependencies = rows.flatMap(([id, , , , dependsOn]) =>
    dependsOn.map((from): Dependency => ({
      id: `${from}-${id}`,
      from,
      to: id,
      type: 'finish-to-start',
      lag: 0,
    })),
  )
  return {
    id: 'kedai-kopi',
    name: 'Peluncuran Kedai Kopi',
    area: 'work',
    calendar: {
      workingDays: [1, 2, 3, 4, 5],
      holidays: holidays.map((date) => ({ date: toIsoDate(date) })),
    },
    tasks,
    dependencies,
    resources: [],
    assignments: [],
    documents: [],
  }
}
