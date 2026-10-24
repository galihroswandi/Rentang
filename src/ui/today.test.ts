import { afterEach, describe, expect, it, vi } from 'vitest'
import { localToday, msUntilNextDay, watchDayChange } from './today.ts'

afterEach(() => {
  vi.useRealTimers()
})

describe('msUntilNextDay', () => {
  it('counts to one second past the next local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 10, 2, 23, 59, 0))).toBe(61_000)
    expect(msUntilNextDay(new Date(2026, 10, 2, 0, 0, 0))).toBe(86_401_000)
  })

  it('crosses a month and a year end', () => {
    expect(msUntilNextDay(new Date(2026, 11, 31, 23, 59, 59))).toBe(2_000)
  })
})

describe('watchDayChange', () => {
  it('reports the new date after midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 2, 23, 59, 0))
    const changes: string[] = []
    const stop = watchDayChange(localToday, (date) => changes.push(date))
    vi.advanceTimersByTime(30_000)
    expect(changes).toEqual([])
    vi.advanceTimersByTime(40_000)
    expect(changes).toEqual(['2026-11-03'])
    stop()
  })

  it('rechecks when the window gets focus, and stops when disposed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 2, 12, 0, 0))
    const changes: string[] = []
    const stop = watchDayChange(localToday, (date) => changes.push(date))
    // The clock jumps ahead, as after a sleeping computer wakes, without the timer firing.
    vi.setSystemTime(new Date(2026, 10, 5, 8, 0, 0))
    window.dispatchEvent(new Event('focus'))
    expect(changes).toEqual(['2026-11-05'])
    stop()
    vi.setSystemTime(new Date(2026, 10, 9, 8, 0, 0))
    window.dispatchEvent(new Event('focus'))
    vi.advanceTimersByTime(86_400_000 * 2)
    expect(changes).toEqual(['2026-11-05'])
  })
})
