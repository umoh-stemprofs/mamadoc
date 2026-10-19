// The urgent booking window: now → end of the day after tomorrow, counted in
// APP_TZ calendar dates (13-mamadoc.md §Logic). Pure: "now" is always an
// argument and this module never reads the real clock or the environment.

import { URGENT_WINDOW_DAYS } from './config'

/** The current moment already expressed in APP_TZ. */
export type LocalNow = {
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
}

export type DatedSlot = {
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

export function addCalendarDays(isoDate: string, days: number): string {
  if (!DATE_RE.test(isoDate)) {
    throw new Error(`Date must look like YYYY-MM-DD, got "${isoDate}".`)
  }
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10)
}

/** The calendar window an urgent patient may book: today .. today + 2. */
export function urgentSlotWindow(nowInTz: LocalNow): { startDate: string; endDate: string } {
  assertNow(nowInTz)
  return {
    startDate: nowInTz.date,
    endDate: addCalendarDays(nowInTz.date, URGENT_WINDOW_DAYS - 1),
  }
}

/** Slots inside the urgent window and strictly after "now". */
export function filterSlotsForUrgent<T extends DatedSlot>(
  slots: readonly T[],
  nowInTz: LocalNow,
): T[] {
  const { startDate, endDate } = urgentSlotWindow(nowInTz)
  return slots.filter(
    (slot) =>
      slot.date >= startDate &&
      slot.date <= endDate &&
      !(slot.date === nowInTz.date && slot.time <= nowInTz.time),
  )
}

/** True when no slot is left for an urgent patient → show the red screen. */
export function needsEmergencyScreen(slots: readonly DatedSlot[], nowInTz: LocalNow): boolean {
  return filterSlotsForUrgent(slots, nowInTz).length === 0
}

/** Emergency screen text; the number is passed in (from EMERGENCY_NUMBER on the server). */
export function emergencyScreenText(emergencyNumber: string): string {
  return `Go to the hospital now. Call ${emergencyNumber}.`
}

function assertNow(now: LocalNow): void {
  if (!DATE_RE.test(now.date)) {
    throw new Error(`Date must look like YYYY-MM-DD, got "${now.date}".`)
  }
  if (!TIME_RE.test(now.time)) {
    throw new Error(`Time must look like HH:mm, got "${now.time}".`)
  }
}
