import { describe, expect, it } from 'vitest'
import { createWorkCalendar } from './calendar.ts'
import { toIsoDate } from './dates.ts'

const d = toIsoDate
const mondayToFriday = [1, 2, 3, 4, 5]

describe('createWorkCalendar', () => {
  const calendar = createWorkCalendar({
    workingDays: mondayToFriday,
    holidays: [{ date: d('2026-11-18') }],
  })

  it('treats weekends and holidays as days off', () => {
    expect(calendar.isWorkday(d('2026-11-17'))).toBe(true)
    expect(calendar.isWorkday(d('2026-11-18'))).toBe(false)
    expect(calendar.isWorkday(d('2026-11-21'))).toBe(false)
    expect(calendar.isWorkday(d('2026-11-22'))).toBe(false)
  })

  it('snaps to the nearest workday on or after, and on or before', () => {
    expect(calendar.nextWorkday(d('2026-11-17'))).toBe('2026-11-17')
    expect(calendar.nextWorkday(d('2026-11-18'))).toBe('2026-11-19')
    expect(calendar.nextWorkday(d('2026-11-21'))).toBe('2026-11-23')
    expect(calendar.previousWorkday(d('2026-11-22'))).toBe('2026-11-20')
    expect(calendar.previousWorkday(d('2026-11-18'))).toBe('2026-11-17')
  })

  it('adds workdays forward and backward, skipping days off', () => {
    expect(calendar.addWorkdays(d('2026-11-16'), 0)).toBe('2026-11-16')
    expect(calendar.addWorkdays(d('2026-11-16'), 1)).toBe('2026-11-17')
    expect(calendar.addWorkdays(d('2026-11-17'), 1)).toBe('2026-11-19')
    expect(calendar.addWorkdays(d('2026-11-19'), 2)).toBe('2026-11-23')
    expect(calendar.addWorkdays(d('2026-11-23'), -2)).toBe('2026-11-19')
    expect(calendar.addWorkdays(d('2026-11-19'), -1)).toBe('2026-11-17')
  })

  it('counts workdays in a half-open range, signed', () => {
    expect(calendar.workdaysBetween(d('2026-11-16'), d('2026-11-16'))).toBe(0)
    expect(calendar.workdaysBetween(d('2026-11-16'), d('2026-11-23'))).toBe(4)
    expect(calendar.workdaysBetween(d('2026-11-23'), d('2026-11-16'))).toBe(-4)
  })

  it('is the inverse of addWorkdays between workdays', () => {
    const start = d('2026-11-02')
    for (let count = -30; count <= 30; count++) {
      const moved = calendar.addWorkdays(start, count)
      expect(calendar.workdaysBetween(start, moved)).toBe(count)
    }
  })

  it('supports a custom work week', () => {
    const sundayToThursday = createWorkCalendar({ workingDays: [0, 1, 2, 3, 4], holidays: [] })
    expect(sundayToThursday.isWorkday(d('2026-11-08'))).toBe(true)
    expect(sundayToThursday.isWorkday(d('2026-11-06'))).toBe(false)
    expect(sundayToThursday.addWorkdays(d('2026-11-05'), 1)).toBe('2026-11-08')
  })

  it('refuses a calendar without working weekdays', () => {
    expect(() => createWorkCalendar({ workingDays: [], holidays: [] })).toThrow(RangeError)
    expect(() => createWorkCalendar({ workingDays: [7, -1], holidays: [] })).toThrow(RangeError)
  })
})
