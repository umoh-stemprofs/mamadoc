// Shared shapes for the doctor's weekly hours grid (S-D-AVAIL).
// Kept separate from lib/hours.ts so pages, actions and tests agree on the
// exact entry shape without pulling in Prisma.
export type HoursEntry = {
  weekday: number // 0 = Sunday … 6 = Saturday
  enabled: boolean
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  slotMinutes: number // 15 | 20 | 30 | 45 | 60
}

/** Weekday numbers in Monday-first display order (0 = Sunday sits last). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const WEEKDAY_NAMES: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

/** Start of the work day shown for a day that is switched off. */
export const OFF_DEFAULTS = { startTime: '09:00', endTime: '17:00', slotMinutes: 30 } as const
