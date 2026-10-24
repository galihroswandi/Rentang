import { describe, expect, it } from 'vitest'
import { toIsoDate } from '../core/dates.ts'
import { formatLongDate, formatRange, formatShortDate, formatWorkingDays } from './format.ts'

describe('date labels', () => {
  it('formats short and long dates in Indonesian', () => {
    expect(formatShortDate(toIsoDate('2026-11-11'))).toBe('11 Nov')
    expect(formatShortDate(toIsoDate('2026-08-01'))).toBe('1 Agu')
    expect(formatLongDate(toIsoDate('2026-12-09'))).toBe('9 Desember 2026')
  })

  it('throws for a forced non-date', () => {
    expect(() => formatShortDate('kemarin' as never)).toThrow(RangeError)
  })
})

describe('formatWorkingDays', () => {
  it.each([
    [[1, 2, 3, 4, 5], 'Senin sampai Jumat'],
    [[5, 4, 3, 2, 1, 6], 'Senin sampai Sabtu'],
    [[0, 1, 2, 3, 4], 'Minggu sampai Kamis'],
    [[0, 1, 2, 3, 4, 5, 6], 'Setiap hari'],
    [[1, 3, 5], 'Senin, Rabu, Jumat'],
    [[1, 2], 'Senin, Selasa'],
  ])('%j reads %s', (days, text) => {
    expect(formatWorkingDays(days)).toBe(text)
  })
})

describe('formatRange', () => {
  it.each([
    ['2026-10-12', '2026-10-18', '12 – 18 Okt'],
    ['2026-10-26', '2026-11-01', '26 Okt – 1 Nov'],
    ['2026-11-02', '2026-11-02', '2 Nov'],
  ])('%s to %s reads %s', (from, to, text) => {
    expect(formatRange(toIsoDate(from), toIsoDate(to))).toBe(text)
  })
})
