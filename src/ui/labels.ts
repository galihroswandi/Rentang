import type { Area, TaskType } from '../core/model.ts'
import type { Zoom } from './gantt/layout.ts'

export const AREA_LABELS: Readonly<Record<Area, string>> = {
  work: 'Kerja',
  finance: 'Keuangan',
  career: 'Karir',
}

export const AREA_ORDER: readonly Area[] = ['work', 'finance', 'career']

export const TYPE_LABELS: Readonly<Record<TaskType, string>> = {
  IMP: 'Implementasi',
  DOC: 'Dokumentasi',
  DSG: 'Desain',
  BUG: 'Bug',
  FIX: 'Perbaikan',
  REV: 'Review',
}

export const ZOOM_LABELS: Readonly<Record<Zoom, string>> = {
  detail: 'Detail',
  day: 'Hari',
  week: 'Minggu',
  month: 'Bulan',
  quarter: 'Kuartal',
  year: 'Tahun',
}
