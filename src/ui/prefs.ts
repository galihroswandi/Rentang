/**
 * View preferences that belong to this browser, not to the project file: list mode,
 * visible columns, zoom, critical-path highlight and table width. Stored in
 * localStorage, which may be unavailable; every read falls back to the default.
 */
import type { Zoom } from './gantt/layout.ts'

export type ColumnKey = 'resource' | 'start' | 'end' | 'duration' | 'progress'
export type Columns = Readonly<Record<ColumnKey, boolean>>

export const DEFAULT_COLUMNS: Columns = {
  resource: false,
  start: true,
  end: true,
  duration: false,
  progress: true,
}

const PREFIX = 'rentang.'

function read<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    return valid(value) ? value : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage may be full or blocked; the preference then lasts for this visit only.
  }
}

const isOneOf =
  <T extends string>(...options: T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && (options as string[]).includes(value)

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

const isColumns = (value: unknown): value is Columns =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(DEFAULT_COLUMNS).every(
    (key) => typeof (value as Record<string, unknown>)[key] === 'boolean',
  )

const isWidth = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

export const prefs = {
  listMode: () => read<'table' | 'cards'>('listMode', 'table', isOneOf('table', 'cards')),
  setListMode: (mode: 'table' | 'cards') => {
    write('listMode', mode)
  },
  columns: () => read('columns', DEFAULT_COLUMNS, isColumns),
  setColumns: (columns: Columns) => {
    write('columns', columns)
  },
  zoom: () => read<Zoom>('zoom', 'week', isOneOf('day', 'week', 'month')),
  setZoom: (zoom: Zoom) => {
    write('zoom', zoom)
  },
  critical: () => read('critical', false, isBoolean),
  setCritical: (on: boolean) => {
    write('critical', on)
  },
  tableWidth: (projectId: string) => read<number | null>(`tableWidth.${projectId}`, null, isWidth),
  setTableWidth: (projectId: string, width: number) => {
    write(`tableWidth.${projectId}`, Math.round(width))
  },
}
