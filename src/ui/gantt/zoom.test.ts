import { describe, expect, it } from 'vitest'
import { toIsoDate } from '../../core/dates.ts'
import { scrollAfterZoom } from './zoom.ts'

const d = toIsoDate

describe('scrollAfterZoom', () => {
  const start = d('2026-01-01')

  it('keeps the middle date in the middle when days get narrower', () => {
    // 100 days in: middle of a 600 px view at 20 px a day is scrollLeft 2000 + 300.
    const before = { start, dayWidth: 20, scrollLeft: 1700 }
    const left = scrollAfterZoom(before, { start, dayWidth: 5 }, 600)
    // Same moment (day 100) at 5 px a day is x 500, so the view starts 300 px before it.
    expect(left).toBe(200)
  })

  it('keeps the middle date in the middle when days get wider', () => {
    const before = { start, dayWidth: 5, scrollLeft: 200 }
    expect(scrollAfterZoom(before, { start, dayWidth: 20 }, 600)).toBe(1700)
  })

  it('keeps a fraction of a day instead of jumping to its centre', () => {
    // The middle of 200 px at scrollLeft 82 is (82 + 100) / 8 = day 22, three quarters in.
    const before = { start, dayWidth: 8, scrollLeft: 82 }
    expect(scrollAfterZoom(before, { start, dayWidth: 40 }, 200)).toBe(22.75 * 40 - 100)
  })

  it('follows a chart whose first day moved', () => {
    const before = { start, dayWidth: 10, scrollLeft: 500 }
    const left = scrollAfterZoom(before, { start: d('2025-01-01'), dayWidth: 10 }, 400)
    // Middle is day 70 of 2026; 2025 has 365 days before it.
    expect(left).toBe((365 + 70) * 10 - 200)
  })

  it('never scrolls before the start', () => {
    const before = { start, dayWidth: 20, scrollLeft: 0 }
    expect(scrollAfterZoom(before, { start, dayWidth: 5 }, 800)).toBe(0)
  })
})
