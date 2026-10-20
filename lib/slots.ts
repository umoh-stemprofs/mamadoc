// Pure slot generation for MamaDoc (00-global §4 · Availability and slots).
// No clock, no database: "now" and every other input is an argument. Dates are
// "YYYY-MM-DD" and times "HH:mm" in APP_TZ; the weekday is worked out from the
// date string itself (0 = Sunday), never from the machine's time zone.

import { BOOKING_DAYS, LEAD_MINUTES } from './config'
import { addCalendarDays, type LocalNow } from './urgentWindow'

/** One availability rule for one weekday of one doctor. */
export type SlotRule = {
  doctorId: string
  weekday: number // 0 = Sunday … 6 = Saturday
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  slotMinutes: number // 15 | 20 | 30 | 45 | 60
}

/** A bookable slot. Slots are generated, never stored. */
export type Slot = {
  doctorId: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
  durationMin: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const ALLOWED_SLOT_MINUTES = [15, 20, 30, 45, 60]

/** Every validation failure carries exactly one plain sentence. */
export class SlotsError extends Error {}

export function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

/** The booking key: "doctorId|date|time". */
export function slotKey(doctorId: string, date: string, time: string): string {
  return `${doctorId}|${date}|${time}`
}

/** Weekday of a calendar date string (0 = Sunday), independent of any clock. */
export function weekdayOf(isoDate: string): number {
  if (!DATE_RE.test(isoDate)) {
    throw new SlotsError(`Date must look like YYYY-MM-DD, got "${isoDate}".`)
  }
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * One doctor's rules for a weekday must not overlap (two different doctors
 * may well work the same weekday), end must be after start, the slot length
 * must be one of 15/20/30/45/60 and must fit exactly.
 */
export function validateRules(rules: readonly SlotRule[]): void {
  const byDoctorWeekday = new Map<string, SlotRule[]>()
  for (const rule of rules) {
    if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) {
      throw new SlotsError(`Weekday must be a number from 0 to 6, got "${rule.weekday}".`)
    }
    if (!TIME_RE.test(rule.startTime) || !TIME_RE.test(rule.endTime)) {
      throw new SlotsError(`Times must look like HH:mm, got "${rule.startTime}" and "${rule.endTime}".`)
    }
    if (!ALLOWED_SLOT_MINUTES.includes(rule.slotMinutes)) {
      throw new SlotsError('Slot length must be 15, 20, 30, 45 or 60 minutes.')
    }
    const start = toMinutes(rule.startTime)
    const end = toMinutes(rule.endTime)
    if (end <= start) {
      throw new SlotsError(
        `End time (${rule.endTime}) must be after start time (${rule.startTime}).`,
      )
    }
    if ((end - start) % rule.slotMinutes !== 0) {
      throw new SlotsError(
        `The ${rule.slotMinutes}-minute slot length does not fit between ${rule.startTime} and ${rule.endTime}.`,
      )
    }
    const dayKey = `${rule.doctorId}|${rule.weekday}`
    const list = byDoctorWeekday.get(dayKey) ?? []
    for (const other of list) {
      const otherStart = toMinutes(other.startTime)
      const otherEnd = toMinutes(other.endTime)
      if (start < otherEnd && otherStart < end) {
        throw new SlotsError(
          `Availability rules on weekday ${rule.weekday} overlap: ${rule.startTime}-${rule.endTime} and ${other.startTime}-${other.endTime}.`,
        )
      }
    }
    list.push(rule)
    byDoctorWeekday.set(dayKey, list)
  }
}

/** Split one rule into its slot start times. */
export function splitRule(rule: SlotRule): string[] {
  const start = toMinutes(rule.startTime)
  const end = toMinutes(rule.endTime)
  const out: string[] = []
  for (let m = start; m + rule.slotMinutes <= end; m += rule.slotMinutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return out
}

/**
 * Generate the free slots: split each weekday's rules into slots, skip days
 * off, skip booked slots, and skip anything earlier than now + leadMinutes.
 */
export function generateSlots(opts: {
  rules: readonly SlotRule[]
  timeOffDates?: readonly string[]
  bookedKeys?: Iterable<string>
  now: LocalNow
  fromDate?: string
  days?: number
  leadMinutes?: number
}): Slot[] {
  const { rules, now } = opts
  validateRules(rules)
  const fromDate = opts.fromDate ?? now.date
  const days = opts.days ?? BOOKING_DAYS
  const leadMinutes = opts.leadMinutes ?? LEAD_MINUTES
  const daysOff = new Set(opts.timeOffDates ?? [])
  const booked = new Set(opts.bookedKeys ?? [])
  const cutoff = toMinutes(now.time) + leadMinutes // today's earliest allowed start

  const out: Slot[] = []
  for (let i = 0; i < days; i++) {
    const date = addCalendarDays(fromDate, i)
    if (date < now.date) continue // never generate the past
    if (daysOff.has(date)) continue
    const weekday = weekdayOf(date)
    for (const rule of rules) {
      if (rule.weekday !== weekday) continue
      for (const time of splitRule(rule)) {
        if (booked.has(slotKey(rule.doctorId, date, time))) continue
        if (date === now.date && toMinutes(time) < cutoff) continue
        out.push({ doctorId: rule.doctorId, date, time, durationMin: rule.slotMinutes })
      }
    }
  }
  return out
}
