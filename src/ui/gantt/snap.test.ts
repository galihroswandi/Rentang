import { describe, expect, it } from 'vitest'
import { isSideways, nearestSnap, sidewaysDelta, snapPoints, stepSnap } from './snap.ts'

describe('snapPoints', () => {
  it('clamps to the scrollable range, adds both ends and drops repeats', () => {
    expect(snapPoints([20, 40, 60, 60, 500, -10], 100)).toEqual([0, 20, 40, 60, 100])
    expect(snapPoints([], 50)).toEqual([0, 50])
    expect(snapPoints([30], -5)).toEqual([0])
  })
})

describe('nearestSnap', () => {
  const points = [0, 20, 40, 100]

  it('pulls a position to the closest point', () => {
    expect(nearestSnap(points, 0)).toBe(0)
    expect(nearestSnap(points, 9)).toBe(0)
    expect(nearestSnap(points, 11)).toBe(20)
    expect(nearestSnap(points, 33)).toBe(40)
    expect(nearestSnap(points, 75)).toBe(100)
    expect(nearestSnap(points, 400)).toBe(100)
    expect(nearestSnap(points, -30)).toBe(0)
  })

  it('takes the earlier point when exactly in between, and copes with no points', () => {
    expect(nearestSnap(points, 10)).toBe(0)
    expect(nearestSnap([], 10)).toBe(0)
  })
})

describe('stepSnap', () => {
  const points = [0, 20, 40, 100]

  it('moves to the next point in each direction', () => {
    expect(stepSnap(points, 0, 1)).toBe(20)
    expect(stepSnap(points, 20, 1)).toBe(40)
    expect(stepSnap(points, 25, 1)).toBe(40)
    expect(stepSnap(points, 40, -1)).toBe(20)
    expect(stepSnap(points, 25, -1)).toBe(20)
  })

  it('stays at the ends', () => {
    expect(stepSnap(points, 100, 1)).toBe(100)
    expect(stepSnap(points, 0, -1)).toBe(0)
    expect(stepSnap([], 7, 1)).toBe(7)
    expect(stepSnap([], 7, -1)).toBe(7)
  })
})

describe('wheel direction', () => {
  it('treats a horizontal swipe or Shift with the wheel as sideways', () => {
    expect(isSideways({ deltaX: 40, deltaY: 3, shiftKey: false })).toBe(true)
    expect(isSideways({ deltaX: 0, deltaY: 100, shiftKey: true })).toBe(true)
    expect(isSideways({ deltaX: 0, deltaY: 100, shiftKey: false })).toBe(false)
    expect(isSideways({ deltaX: 5, deltaY: 100, shiftKey: false })).toBe(false)
  })

  it('reads the sideways amount from the right axis', () => {
    expect(sidewaysDelta({ deltaX: 40, deltaY: 3, shiftKey: false })).toBe(40)
    expect(sidewaysDelta({ deltaX: 0, deltaY: 100, shiftKey: true })).toBe(100)
    expect(sidewaysDelta({ deltaX: -30, deltaY: 2, shiftKey: true })).toBe(-30)
  })
})
