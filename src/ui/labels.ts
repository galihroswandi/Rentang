import type { Area } from '../core/model.ts'
import type { TaskStatus } from '../core/summary.ts'

export const AREA_LABELS: Readonly<Record<Area, string>> = {
  work: 'Kerja',
  finance: 'Keuangan',
  career: 'Karir',
}

export const AREA_ORDER: readonly Area[] = ['work', 'finance', 'career']

export const STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  'not-started': 'Belum mulai',
  'in-progress': 'Berjalan',
  done: 'Selesai',
  late: 'Terlambat',
}
