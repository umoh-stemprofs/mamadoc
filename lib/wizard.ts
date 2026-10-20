// Booking wizard logic (00-global §4 · Booking · 13-mamadoc.md).
// Pure where it can be: the grid builders take rules, days off and booked
// times as arguments and never touch the clock or the database.
// bookVisitFor is the single entry point the wizard action uses — it
// re-checks the actor's role and always books for the session patient.
import type { PrismaClient } from '@prisma/client'
import { bookAppointment, type BookAppointmentInput, type BookResult, type BookingDb } from './booking'
import { generateSlots, splitRule, toMinutes, weekdayOf, type SlotRule } from './slots'
import { addCalendarDays, type LocalNow } from './urgentWindow'
import type { VisitReason } from './triage'

/** Who is acting, straight from the verified session — never from a form. */
export type WizardActor = { role: 'PATIENT' | 'DOCTOR'; userId: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

export type WizardParams = {
  doctorId: string | null
  date: string | null
  time: string | null
  q: string | null
}

function one(value: string | string[] | undefined, maxLength: number): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

/**
 * Sanitize the wizard's URL state. Anything malformed is dropped, so an
 * invalid step is simply shown again — never trusted, never crashes.
 */
export function sanitizeWizardParams(params: {
  doctor?: string | string[]
  date?: string | string[]
  time?: string | string[]
  q?: string | string[]
}): WizardParams {
  const doctorId = one(params.doctor, 64)
  const date = one(params.date, 10)
  const time = one(params.time, 5)
  const q = one(params.q, 80)
  return {
    doctorId: doctorId && /^[\w-]+$/.test(doctorId) ? doctorId : null,
    date: date && DATE_RE.test(date) ? date : null,
    time: time && TIME_RE.test(time) ? time : null,
    q,
  }
}

/** Which step the URL asks for: 1 doctor · 2 day · 3 time · 4 confirm. */
export function wizardStep(params: WizardParams): 1 | 2 | 3 | 4 {
  if (!params.doctorId) return 1
  if (!params.date) return 2
  if (!params.time) return 3
  return 4
}

export type BookForWizardInput = {
  doctorId: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
  reason: VisitReason
  symptoms?: readonly string[] // question 2 (added with the question screens)
  weeks?: number | null // question 3 (added with the question screens)
}

/** One time button on the time grid: booked ones are shown, but disabled. */
export type DaySlot = { time: string; taken: boolean }

/**
 * The full time grid for one date: every slot the doctor's rules produce
 * (minus the lead-time cutoff and any day off), each marked free or taken.
 * Taken slots are shown disabled with "Taken" — they are never bookable.
 */
export function buildDayGrid(opts: {
  rules: readonly SlotRule[]
  doctorId: string
  date: string
  now: LocalNow
  bookedTimes: Iterable<string>
  leadMinutes: number
  timeOffDates?: readonly string[]
}): DaySlot[] {
  const { doctorId, date, now } = opts
  if (opts.timeOffDates?.includes(date)) return []
  const weekday = weekdayOf(date)
  const booked = new Set(opts.bookedTimes)
  const cutoff = toMinutes(now.time) + opts.leadMinutes

  const seen = new Set<string>()
  const grid: DaySlot[] = []
  for (const rule of opts.rules) {
    if (rule.doctorId !== doctorId || rule.weekday !== weekday) continue
    for (const time of splitRule(rule)) {
      if (seen.has(time)) continue
      seen.add(time)
      if (date === now.date && toMinutes(time) < cutoff) continue
      grid.push({ time, taken: booked.has(time) })
    }
  }
  return grid.sort((a, b) => a.time.localeCompare(b.time))
}

/**
 * One entry per upcoming day: how many free (untaken, in-hours) slots THIS
 * doctor has. The rules may cover every doctor (step 1 needs them all), so
 * they are filtered to the selected doctor before counting.
 */
export function summarizeDays(opts: {
  rules: readonly SlotRule[]
  doctorId: string
  now: LocalNow
  timeOffDates: readonly string[]
  bookedKeys: Iterable<string>
  days: number
  leadMinutes: number
}): { date: string; freeCount: number }[] {
  const slots = generateSlots({
    rules: opts.rules.filter((r) => r.doctorId === opts.doctorId),
    timeOffDates: opts.timeOffDates,
    bookedKeys: opts.bookedKeys,
    now: opts.now,
    fromDate: opts.now.date,
    days: opts.days,
    leadMinutes: opts.leadMinutes,
  })
  const counts = new Map<string, number>()
  for (let i = 0; i < opts.days; i++) {
    counts.set(addCalendarDays(opts.now.date, i), 0)
  }
  for (const slot of slots) {
    counts.set(slot.date, (counts.get(slot.date) ?? 0) + 1)
  }
  return [...counts.entries()].map(([date, freeCount]) => ({ date, freeCount }))
}

/**
 * Book from the wizard. The actor must be a PATIENT and the visit is always
 * booked for the actor's own patient id — no form field can point it at
 * somebody else. Everything else (slot exists, no double booking, unique
 * conflicts) is enforced by bookAppointment.
 */
export async function bookVisitFor(
  db: BookingDb,
  actor: WizardActor,
  input: BookForWizardInput,
  now: LocalNow,
): Promise<BookResult> {
  if (actor.role !== 'PATIENT') {
    return { ok: false, error: 'You can only book a visit with a patient account.' }
  }
  const payload: BookAppointmentInput = {
    patientId: actor.userId,
    doctorId: input.doctorId,
    date: input.date,
    time: input.time,
    reason: input.reason,
    symptoms: input.symptoms ?? [],
    weeks: input.weeks ?? null,
  }
  return bookAppointment(db, payload, now)
}
