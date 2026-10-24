import { formatIsoDate, type IsoDate } from '../core/dates.ts'

/** Today's date on this computer's clock and time zone. */
export function localToday(): IsoDate {
  const now = new Date()
  return formatIsoDate({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() })
}

/** Milliseconds from `now` to just after the next local midnight. */
export function msUntilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  return next.getTime() - now.getTime()
}

/**
 * Calls `onChange` when the date `read` returns is no longer the one it returned first.
 * A timer to the next midnight does most of it; coming back to the tab or window also
 * rechecks, since timers pause while a computer sleeps or a tab is in the background.
 * Returns a function that stops watching.
 */
export function watchDayChange(read: () => IsoDate, onChange: (date: IsoDate) => void): () => void {
  let known = read()
  let timer: ReturnType<typeof setTimeout> | undefined

  const check = (): void => {
    clearTimeout(timer)
    const current = read()
    if (current !== known) {
      known = current
      onChange(current)
    }
    timer = setTimeout(check, msUntilNextDay(new Date()))
  }
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') check()
  }

  timer = setTimeout(check, msUntilNextDay(new Date()))
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', check)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', check)
  }
}
