import { describe, expect, it } from 'vitest'
import {
  capitalized,
  documentTitle,
  timeAgo,
  titleFromFileName,
  wordsLabel,
} from './document-text.ts'

// Local times, so the expectations hold in any time zone.
const now = new Date(2026, 10, 18, 10, 0)
const at = (...parts: [number, number, number, number?, number?]): string =>
  new Date(parts[0], parts[1], parts[2], parts[3] ?? 0, parts[4] ?? 0).toISOString()

describe('titleFromFileName', () => {
  it('drops a Markdown extension and keeps the rest of the name', () => {
    expect(titleFromFileName('rencana-awal.md')).toBe('rencana-awal')
    expect(titleFromFileName('Catatan Rapat.MARKDOWN')).toBe('Catatan Rapat')
    expect(titleFromFileName('versi 1.2.md')).toBe('versi 1.2')
    expect(titleFromFileName('tanpa-ekstensi')).toBe('tanpa-ekstensi')
  })
})

describe('documentTitle', () => {
  it('names untitled documents', () => {
    expect(documentTitle('  Rencana  ')).toBe('Rencana')
    expect(documentTitle('   ')).toBe('Tanpa judul')
  })
})

describe('timeAgo', () => {
  it('counts minutes and hours on the same day', () => {
    expect(timeAgo(at(2026, 10, 18, 9, 59), now)).toBe('1 menit lalu')
    expect(timeAgo(at(2026, 10, 18, 9, 48), now)).toBe('12 menit lalu')
    expect(timeAgo(at(2026, 10, 18, 7, 30), now)).toBe('2 jam lalu')
  })

  it('treats the last minute and a clock running ahead as just now', () => {
    expect(timeAgo(now.toISOString(), now)).toBe('baru saja')
    expect(timeAgo(at(2026, 10, 18, 12, 0), now)).toBe('baru saja')
  })

  it('counts calendar days, then weeks, then shows the date', () => {
    expect(timeAgo(at(2026, 10, 17, 9, 0), now)).toBe('kemarin')
    expect(timeAgo(at(2026, 10, 14, 23, 0), now)).toBe('4 hari lalu')
    expect(timeAgo(at(2026, 10, 4, 12, 0), now)).toBe('2 minggu lalu')
    expect(timeAgo(at(2026, 9, 12, 12, 0), now)).toBe('12 Okt')
    expect(timeAgo(at(2025, 11, 30, 12, 0), now)).toBe('30 Des 2025')
  })

  it('uses hours just after midnight', () => {
    const early = new Date(2026, 10, 18, 1, 30)
    expect(timeAgo(at(2026, 10, 17, 23, 0), early)).toBe('2 jam lalu')
  })

  it('has nothing to say without a valid timestamp', () => {
    expect(timeAgo(undefined, now)).toBeNull()
    expect(timeAgo('bukan waktu', now)).toBeNull()
  })
})

describe('labels', () => {
  it('capitalizes the first letter and counts words', () => {
    expect(capitalized('kemarin')).toBe('Kemarin')
    expect(capitalized('12 menit lalu')).toBe('12 menit lalu')
    expect(capitalized('')).toBe('')
    expect(wordsLabel(268)).toBe('268 kata')
  })
})
