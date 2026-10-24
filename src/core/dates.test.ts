import { describe, expect, it } from 'vitest'
import {
  addDays,
  clampDate,
  compareDates,
  dayOfWeek,
  diffDays,
  formatIsoDate,
  fromDayNumber,
  isIsoDate,
  isSupportedDate,
  MAX_DATE,
  maxDate,
  MIN_DATE,
  minDate,
  parseIsoDate,
  toDayNumber,
  toIsoDate,
} from './dates.ts'

const d = toIsoDate

describe('parseIsoDate', () => {
  it('splits a valid date into parts', () => {
    expect(parseIsoDate('2026-11-02')).toEqual({ year: 2026, month: 11, day: 2 })
  })

  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-11-00',
    '0000-01-01',
    '2026-1-02',
    '2026/11/02',
    '2026-11-02T00:00',
    '',
  ])('rejects %j', (text) => {
    expect(parseIsoDate(text)).toBeNull()
    expect(isIsoDate(text)).toBe(false)
  })

  it('knows leap years', () => {
    expect(isIsoDate('2024-02-29')).toBe(true)
    expect(isIsoDate('2000-02-29')).toBe(true)
    expect(isIsoDate('1900-02-29')).toBe(false)
  })
})

describe('formatIsoDate and toIsoDate', () => {
  it('pads parts', () => {
    expect(formatIsoDate({ year: 987, month: 3, day: 4 })).toBe('0987-03-04')
  })

  it('throws for a date that does not exist', () => {
    expect(() => formatIsoDate({ year: 2026, month: 2, day: 30 })).toThrow(RangeError)
    expect(() => formatIsoDate({ year: 2026, month: 1.5, day: 1 })).toThrow(RangeError)
    expect(() => toIsoDate('2026-02-30')).toThrow(RangeError)
  })

  it('throws when a non-date is cast to IsoDate by force', () => {
    expect(() => toDayNumber('nope' as never)).toThrow(RangeError)
  })
})

describe('day numbers', () => {
  it('puts the epoch at zero', () => {
    expect(toDayNumber(d('1970-01-01'))).toBe(0)
    expect(fromDayNumber(-1)).toBe('1969-12-31')
  })

  it('round-trips every day across several centuries', () => {
    for (let n = toDayNumber(d('1899-12-25')); n <= toDayNumber(d('2101-01-05')); n += 1) {
      expect(toDayNumber(fromDayNumber(n))).toBe(n)
    }
  })
})

describe('addDays and diffDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays(d('2026-11-30'), 1)).toBe('2026-12-01')
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29')
    expect(addDays(d('2026-03-01'), -1)).toBe('2026-02-28')
  })

  it('measures signed calendar days', () => {
    expect(diffDays(d('2026-11-02'), d('2026-12-09'))).toBe(37)
    expect(diffDays(d('2026-12-09'), d('2026-11-02'))).toBe(-37)
    expect(diffDays(d('2026-01-01'), d('2027-01-01'))).toBe(365)
  })
})

describe('dayOfWeek', () => {
  it.each([
    ['1970-01-01', 4],
    ['2000-02-29', 2],
    ['2026-11-02', 1],
    ['2026-11-07', 6],
    ['2026-11-08', 0],
    ['1969-12-28', 0],
  ] as const)('%s is weekday %i', (text, weekday) => {
    expect(dayOfWeek(d(text))).toBe(weekday)
  })
})

describe('comparison', () => {
  it('orders dates', () => {
    const early = d('2026-11-02')
    const late = d('2026-11-10')
    expect(compareDates(early, late)).toBe(-1)
    expect(compareDates(late, early)).toBe(1)
    expect(compareDates(early, early)).toBe(0)
    expect(maxDate(early, late)).toBe(late)
    expect(maxDate(late, early)).toBe(late)
    expect(minDate(early, late)).toBe(early)
    expect(minDate(late, early)).toBe(early)
  })
})

describe('supported window', () => {
  it('tells which dates are inside it', () => {
    expect(isSupportedDate(MIN_DATE)).toBe(true)
    expect(isSupportedDate(MAX_DATE)).toBe(true)
    expect(isSupportedDate(d('1969-12-31'))).toBe(false)
    expect(isSupportedDate(d('2101-01-01'))).toBe(false)
  })

  it('clamps to the nearest edge', () => {
    expect(clampDate(d('0001-01-01'))).toBe(MIN_DATE)
    expect(clampDate(d('9999-12-31'))).toBe(MAX_DATE)
    expect(clampDate(d('2026-11-02'))).toBe('2026-11-02')
  })
})
