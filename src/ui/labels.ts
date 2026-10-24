import type { Area } from '../core/model.ts'
import type { Zoom } from './gantt/layout.ts'
import type { TypeKey } from './table/rows.ts'

export const AREA_LABELS: Readonly<Record<Area, string>> = {
  work: 'Kerja',
  finance: 'Keuangan',
  career: 'Karir',
}

export const AREA_ORDER: readonly Area[] = ['work', 'finance', 'career']

export const TYPE_LABELS: Readonly<Record<TypeKey, string>> = {
  IMP: 'Implementasi',
  DOC: 'Dokumentasi',
  DSG: 'Desain',
  BUG: 'Bug',
  FIX: 'Perbaikan',
  REV: 'Review',
  MS: 'Milestone',
}

export const ZOOM_LABELS: Readonly<Record<Zoom, string>> = {
  detail: 'Detail',
  day: 'Hari',
  week: 'Minggu',
  month: 'Bulan',
  quarter: 'Kuartal',
  year: 'Tahun',
}
