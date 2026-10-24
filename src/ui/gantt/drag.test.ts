import { describe, expect, it } from 'vitest'
import { createWorkCalendar } from '../../core/calendar.ts'
import { MAX_DATE, MIN_DATE, toIsoDate } from '../../core/dates.ts'
import { changed, daysFromPixels, resolveDrag, type DragInput } from './drag.ts'

const d = toIsoDate
const calendar = createWorkCalendar({
  workingDays: [1, 2, 3, 4, 5],
  holidays: [{ date: d('2026-11-18') }],
})

// Mon 2 Nov, three workdays: Mon 2 to Wed 4 November.
const task: Omit<DragInput, 'mode' | 'deltaDays'> = {
  start: d('2026-11-02'),
  end: d('2026-11-04'),
  duration: 3,
  isMilestone: false,
  calendar,
}

describe('daysFromPixels', () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [31, 2],
    [-9, 0],
    [-10, -1],
    [-35, -2],
  ])('%i px at 20 px per day is %i days', (px, days) => {
    expect(daysFromPixels(px, 20)).toBe(days)
  })
})

describe('moving', () => {
  const move = (deltaDays: number, extra: Partial<DragInput> = {}) =>
    resolveDrag({ ...task, mode: 'move', deltaDays, ...extra })

  it('keeps the length and shifts the dates', () => {
    expect(move(2)).toEqual({ start: '2026-11-04', end: '2026-11-06', duration: 3 })
    expect(move(0)).toEqual({ start: '2026-11-02', end: '2026-11-04', duration: 3 })
  })

  it('lands on the next workday when dragged forward onto a day off', () => {
    // Saturday 7 Nov becomes Monday 9 Nov, and the bar runs over the weekend-free days.
    expect(move(5)).toEqual({ start: '2026-11-09', end: '2026-11-11', duration: 3 })
  })

  it('lands on the previous workday when dragged backward onto a day off', () => {
    const friday = { start: d('2026-11-06'), end: d('2026-11-06'), duration: 1 }
    // One day back from Monday 9 Nov is Sunday: it goes to Friday, not forward again.
    expect(move(-1, { ...friday, start: d('2026-11-09'), end: d('2026-11-09') })).toEqual({
      start: '2026-11-06',
      end: '2026-11-06',
      duration: 1,
    })
  })

  it('skips holidays', () => {
    expect(move(16)).toEqual({ start: '2026-11-19', end: '2026-11-23', duration: 3 })
  })

  it('moves a milestone without giving it a length', () => {
    const milestone = {
      start: d('2026-11-04'),
      end: d('2026-11-04'),
      duration: 0,
      isMilestone: true,
    }
    expect(move(3, milestone)).toEqual({ start: '2026-11-09', end: '2026-11-09', duration: 0 })
  })
})

describe('resizing', () => {
  const resize = (deltaDays: number, extra: Partial<DragInput> = {}) =>
    resolveDrag({ ...task, mode: 'resize', deltaDays, ...extra })

  it('changes the length from the right edge and keeps the start', () => {
    expect(resize(1)).toEqual({ start: '2026-11-02', end: '2026-11-05', duration: 4 })
    expect(resize(-1)).toEqual({ start: '2026-11-02', end: '2026-11-03', duration: 2 })
  })

  it('counts workdays, so weekends add no length', () => {
    // Pulled to Sunday 8 Nov: the last workday is Friday 6 Nov.
    expect(resize(4)).toEqual({ start: '2026-11-02', end: '2026-11-06', duration: 5 })
    expect(resize(5)).toEqual({ start: '2026-11-02', end: '2026-11-09', duration: 6 })
    expect(resize(7)).toEqual({ start: '2026-11-02', end: '2026-11-11', duration: 8 })
  })

  it('never goes below one workday', () => {
    expect(resize(-2)).toEqual({ start: '2026-11-02', end: '2026-11-02', duration: 1 })
    expect(resize(-30)).toEqual({ start: '2026-11-02', end: '2026-11-02', duration: 1 })
  })

  it('resizes across a holiday by workdays', () => {
    const across = { start: d('2026-11-16'), end: d('2026-11-17'), duration: 2 }
    expect(resize(2, across)).toEqual({ start: '2026-11-16', end: '2026-11-19', duration: 3 })
  })

  it('treats a milestone as a move, since it has no length', () => {
    const milestone = {
      start: d('2026-11-04'),
      end: d('2026-11-04'),
      duration: 0,
      isMilestone: true,
    }
    expect(resize(1, milestone)).toEqual({ start: '2026-11-05', end: '2026-11-05', duration: 0 })
  })
})

describe('limits', () => {
  it('keeps a move inside the supported dates', () => {
    const far = resolveDrag({ ...task, mode: 'move', deltaDays: 10_000_000 })
    const near = resolveDrag({ ...task, mode: 'move', deltaDays: -10_000_000 })
    expect(far.start).toBe(MAX_DATE)
    expect(near.start).toBe(MIN_DATE)
  })

  it('caps the length of a resize', () => {
    const result = resolveDrag({ ...task, mode: 'resize', deltaDays: 10_000_000 })
    expect(result.duration).toBeLessThanOrEqual(3650)
    expect(result.end <= MAX_DATE).toBe(true)
  })
})

describe('changed', () => {
  it('is true only when the start or length differs', () => {
    const input: DragInput = { ...task, mode: 'move', deltaDays: 0 }
    expect(changed(input, resolveDrag(input))).toBe(false)
    expect(changed(input, resolveDrag({ ...input, deltaDays: 1 }))).toBe(true)
    expect(
      changed(
        { ...input, mode: 'resize' },
        resolveDrag({ ...input, mode: 'resize', deltaDays: 1 }),
      ),
    ).toBe(true)
    // Pulled onto a day off and snapped back to where it was.
    expect(
      changed(
        { ...input, mode: 'resize', start: d('2026-11-06'), end: d('2026-11-06'), duration: 1 },
        resolveDrag({
          ...input,
          mode: 'resize',
          start: d('2026-11-06'),
          end: d('2026-11-06'),
          duration: 1,
          deltaDays: 1,
        }),
      ),
    ).toBe(false)
  })
})
