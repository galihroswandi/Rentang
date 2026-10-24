/**
 * Magnet points for horizontal scrolling: the left edges of the header cells (days, week
 * starts, months or quarters, whichever the header shows). Pure functions over a sorted
 * list of positions, so the rules are tested without a browser.
 */

/** Snap points as scroll positions: clamped to the scrollable range and without repeats. */
export function snapPoints(edges: readonly number[], max: number): number[] {
  const limit = Math.max(0, max)
  const points = new Set<number>([0, limit])
  for (const edge of edges) points.add(Math.min(Math.max(edge, 0), limit))
  return [...points].sort((a, b) => a - b)
}

/** The point closest to `position`; the earlier one when it is exactly between two. */
export function nearestSnap(points: readonly number[], position: number): number {
  let best = points[0] ?? 0
  for (const point of points) {
    if (Math.abs(point - position) < Math.abs(best - position)) best = point
  }
  return best
}

/**
 * The next point in a direction: strictly beyond `position` (half a pixel of slack, so a
 * position already resting on a point moves on). Stays on the last point at either end.
 */
export function stepSnap(points: readonly number[], position: number, direction: -1 | 1): number {
  if (direction > 0) {
    return points.find((point) => point > position + 0.5) ?? points.at(-1) ?? position
  }
  return points.findLast((point) => point < position - 0.5) ?? points[0] ?? position
}

/** Whether a wheel event means "sideways": a horizontal swipe, or Shift with the wheel. */
export function isSideways(event: { deltaX: number; deltaY: number; shiftKey: boolean }): boolean {
  return event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
}

/** The sideways amount of a wheel event: Shift turns the wheel's vertical turn into sideways. */
export function sidewaysDelta(event: {
  deltaX: number
  deltaY: number
  shiftKey: boolean
}): number {
  return Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.shiftKey
    ? event.deltaX
    : event.deltaY
}
