// "My hours" logic (00-global §4 · Availability · S-D-AVAIL).
// The doctor is always looked up from the session userId, never from a form
// field, so a doctor can only ever edit their own rules and days off. Every
// validation failure is one plain sentence.
import type { PrismaClient } from '@prisma/client'
import type { HoursEntry } from './hoursShared'
import { validateRules, type SlotRule } from './slots'

/** The model delegates these functions need; the real client satisfies it. */
export type HoursDb = Pick<
  PrismaClient,
  'doctor' | 'availabilityRule' | 'timeOff' | '$transaction'
>

export type HoursResult = { ok: true } | { ok: false; error: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Replace this doctor's weekly rules with the seven grid rows.
 * Rows come straight from the form: enabled days become one rule each,
 * disabled days are removed. validateRules gives the plain-sentence errors
 * (overlap, end before start, slot length that does not fit).
 */
export async function saveHours(
  db: HoursDb,
  doctorUserId: string,
  entries: readonly HoursEntry[],
): Promise<HoursResult> {
  const doctor = await db.doctor.findUnique({ where: { userId: doctorUserId } })
  if (!doctor) return { ok: false, error: 'That doctor account does not exist.' }

  const rules: SlotRule[] = entries
    .filter((entry) => entry.enabled)
    .map((entry) => ({
      doctorId: doctor.id,
      weekday: entry.weekday,
      startTime: entry.startTime,
      endTime: entry.endTime,
      slotMinutes: entry.slotMinutes,
    }))
  try {
    validateRules(rules)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  // The weekly grid owns the whole week: in one transaction, drop this
  // doctor's old rules and write the enabled rows back. Only this doctor's
  // rows are touched.
  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { doctorId: doctor.id } }),
    ...(rules.length > 0
      ? [db.availabilityRule.createMany({ data: rules })]
      : []),
  ])
  return { ok: true }
}

/** This doctor's current rules, in Monday-first display order. */
export async function loadHours(db: HoursDb, doctorId: string): Promise<SlotRule[]> {
  return db.availabilityRule.findMany({
    where: { doctorId },
    orderBy: { weekday: 'asc' },
  })
}

/**
 * Add one day off for this doctor. The date must be a bare calendar date;
 * a duplicate date becomes the unique-constraint sentence.
 */
export async function addDayOff(
  db: HoursDb,
  doctorUserId: string,
  date: string,
  reason: string,
): Promise<HoursResult> {
  const doctor = await db.doctor.findUnique({ where: { userId: doctorUserId } })
  if (!doctor) return { ok: false, error: 'That doctor account does not exist.' }
  if (!DATE_RE.test(date)) {
    return { ok: false, error: 'Pick a valid date for the day off.' }
  }
  try {
    await db.timeOff.create({
      data: { doctorId: doctor.id, date, reason: reason.trim() || null },
    })
  } catch (e) {
    if (isUniqueConflict(e)) {
      return { ok: false, error: 'You already marked that day off.' }
    }
    throw e
  }
  return { ok: true }
}

/** Remove one of THIS doctor's days off. A foreign id changes nothing. */
export async function removeDayOff(
  db: HoursDb,
  doctorUserId: string,
  timeOffId: string,
): Promise<HoursResult> {
  const doctor = await db.doctor.findUnique({ where: { userId: doctorUserId } })
  if (!doctor) return { ok: false, error: 'That doctor account does not exist.' }
  const result = await db.timeOff.deleteMany({
    where: { id: timeOffId, doctorId: doctor.id },
  })
  if (result.count === 0) {
    return { ok: false, error: 'That day off does not exist.' }
  }
  return { ok: true }
}

function isUniqueConflict(e: unknown): boolean {
  const err = e as { code?: string; meta?: unknown }
  const meta = JSON.stringify(err?.meta ?? {})
  return err?.code === 'P2002' || (err?.code === 'P2010' && meta.includes('23505'))
}
