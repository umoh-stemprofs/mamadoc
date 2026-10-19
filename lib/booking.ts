// Booking logic for MamaDoc (00-global §4 · Booking · 13-mamadoc.md).
// Every function takes the Prisma client and "now" (in APP_TZ) as arguments
// and never reads the clock. Expected problems come back as { ok: false,
// error } with one plain sentence — they never throw.

import type { Prisma, PrismaClient } from '@prisma/client'
import { CANCEL_LEAD_HOURS, EMERGENCY_FALLBACK_NUMBER, LEAD_MINUTES, BOOKING_DAYS } from './config'
import { confirmationMessage, doctorNotificationText } from './messages'
import { generateSlots, slotKey, toMinutes } from './slots'
import { filterSlotsForUrgent, type LocalNow } from './urgentWindow'
import { triage, type VisitReason } from './triage'

/** The model delegates these functions need; the real client satisfies it. */
export type BookingDb = Pick<
  PrismaClient,
  'user' | 'doctor' | 'availabilityRule' | 'timeOff' | 'appointment' | 'notification' | 'emailOutbox' | '$transaction'
>

export type BookAppointmentInput = {
  patientId: string
  doctorId: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
  reason: VisitReason
  symptoms: readonly string[] // raw question-2 answers, straight from the form
  weeks: number | null
}

export type BookResult =
  | { ok: true; appointmentId: string; level: 'NORMAL' | 'URGENT'; severe: boolean; message: string }
  | { ok: false; error: string }

export type ActionResult = { ok: true } | { ok: false; error: string }

export type CancelActor = { role: 'PATIENT' | 'DOCTOR'; userId: string }

/**
 * Book a visit.
 * (a) Triage runs here, server-side, from the raw answers — the caller never
 *     sends a level, a severe flag or a queue position.
 * (b) The slot must exist in freshly generated slots (no made-up times).
 * (c) An URGENT result must also fall inside the urgent 3-day window.
 * (d) Appointment + notification + simulated email for patient AND doctor,
 *     in one transaction.
 * (e) Unique conflicts become the specified sentences.
 */
export async function bookAppointment(
  prisma: BookingDb,
  input: BookAppointmentInput,
  now: LocalNow,
): Promise<BookResult> {
  // (a) triage from the raw answers — never trust the caller
  let level: 'NORMAL' | 'URGENT'
  let severe: boolean
  let symptoms: string[]
  try {
    const result = triage({ reason: input.reason, symptoms: input.symptoms, weeks: input.weeks })
    level = result.level
    severe = result.severe
    symptoms = result.symptoms
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  // (b) regenerate the slots for this doctor and reject anything not in them
  const [rules, timeOffs, booked] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { doctorId: input.doctorId } }),
    prisma.timeOff.findMany({ where: { doctorId: input.doctorId } }),
    prisma.appointment.findMany({
      where: { doctorId: input.doctorId, status: 'BOOKED' },
      select: { date: true, time: true },
    }),
  ])
  let slots
  try {
    slots = generateSlots({
      rules,
      timeOffDates: timeOffs.map((t) => t.date),
      bookedKeys: booked.map((a) => slotKey(input.doctorId, a.date, a.time)),
      now,
      fromDate: now.date,
      days: BOOKING_DAYS,
      leadMinutes: LEAD_MINUTES,
    })
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  const wanted = slots.find((s) => s.date === input.date && s.time === input.time)
  if (!wanted) {
    return { ok: false, error: 'That time is not available.' }
  }

  // (c) urgent visits must also fall inside the urgent window
  if (level === 'URGENT') {
    const inUrgentWindow = filterSlotsForUrgent(slots, now).some(
      (s) => s.date === input.date && s.time === input.time,
    )
    if (!inUrgentWindow) {
      return { ok: false, error: 'Urgent visits can only be booked within the next 3 days.' }
    }
  }

  const patient = await prisma.user.findUnique({ where: { id: input.patientId } })
  const doctor = await prisma.doctor.findUnique({
    where: { id: input.doctorId },
    include: { user: true },
  })
  if (!patient) return { ok: false, error: 'That patient does not exist.' }
  if (!doctor) return { ok: false, error: 'That doctor does not exist.' }

  // fast path for the common double-book of the same patient
  const clash = await prisma.appointment.findFirst({
    where: { patientId: input.patientId, date: input.date, time: input.time, status: 'BOOKED' },
    select: { id: true },
  })
  if (clash) return { ok: false, error: 'You already have a visit at this time.' }

  const patientMessage = confirmationMessage(level)
  const doctorMessage = doctorNotificationText({
    level,
    patientName: patient.name,
    date: input.date,
    time: input.time,
    symptoms,
  })
  const subject = `MamaDoc: ${level === 'URGENT' ? 'urgent visit booked' : 'visit booked'} — ${input.date} at ${input.time}`
  const safety = `For non-emergency visits only. Prototype, not for diagnosis or treatment. In an emergency call ${process.env.EMERGENCY_NUMBER || EMERGENCY_FALLBACK_NUMBER}.`

  // (d) one transaction: appointment + 2 notifications + 2 simulated emails
  try {
    const appointmentId = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          patientId: input.patientId,
          doctorId: input.doctorId,
          date: input.date,
          time: input.time,
          durationMin: wanted.durationMin,
          status: 'BOOKED',
          triageLevel: level,
          reason: input.reason,
          symptomsJson: JSON.stringify(symptoms),
          weeks: input.weeks,
          severe,
          slotKey: slotKey(input.doctorId, input.date, input.time),
          patientSlotKey: `${input.patientId}|${input.date}|${input.time}`,
        },
      })
      await tx.notification.createMany({
        data: [
          {
            userId: patient.id,
            kind: 'BOOKING',
            title: level === 'URGENT' ? 'Visit booked (urgent)' : 'Visit booked',
            body: patientMessage,
          },
          {
            userId: doctor.userId,
            kind: 'BOOKING',
            title: level === 'URGENT' ? 'URGENT visit booked' : 'Visit booked',
            body: doctorMessage,
          },
        ],
      })
      await tx.emailOutbox.createMany({
        data: [
          {
            toUserId: patient.id,
            toEmail: patient.email,
            subject,
            body: `${patientMessage}\n\n${safety}`,
          },
          {
            toUserId: doctor.userId,
            toEmail: doctor.user.email,
            subject,
            body: `${doctorMessage}\n\n${safety}`,
          },
        ],
      })
      return appointment.id
    })
    return { ok: true, appointmentId, level, severe, message: patientMessage }
  } catch (e) {
    // (e) unique conflicts from the database constraints
    const target = uniqueConflictTarget(e)
    if (target) {
      if (target.includes('patientSlotKey') || target.includes('patient_date_time')) {
        return { ok: false, error: 'You already have a visit at this time.' }
      }
      if (target.includes('slotKey') || target.includes('doctor_date_time')) {
        return { ok: false, error: 'Someone just took this time. Pick another.' }
      }
      return { ok: false, error: 'That time is not available.' }
    }
    throw e
  }
}

/**
 * Cancel a visit. A patient may cancel only their own visit and only until
 * CANCEL_LEAD_HOURS before it starts; a doctor may cancel their own visits at
 * any time. Cancelling frees the slot (keys are nulled) and notifies both sides.
 */
export async function cancelAppointment(
  prisma: BookingDb,
  id: string,
  actor: CancelActor,
  now: LocalNow,
): Promise<ActionResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { patient: true, doctor: { include: { user: true } } },
  })
  if (!appointment) return { ok: false, error: 'That visit does not exist.' }
  if (appointment.status === 'CANCELLED') return { ok: false, error: 'That visit is already cancelled.' }

  const ownsVisit =
    actor.role === 'PATIENT'
      ? appointment.patientId === actor.userId
      : appointment.doctor.userId === actor.userId
  if (!ownsVisit) {
    return {
      ok: false,
      error:
        actor.role === 'PATIENT'
          ? 'You can only cancel your own visit.'
          : 'You can only cancel your own visits.',
    }
  }

  if (actor.role === 'PATIENT') {
    // latest cancel = start − CANCEL_LEAD_HOURS, compared in APP_TZ wall clock
    const nowMinutes = dayNumber(now.date) * 1440 + toMinutes(now.time)
    const startMinutes = dayNumber(appointment.date) * 1440 + toMinutes(appointment.time)
    if (nowMinutes > startMinutes - CANCEL_LEAD_HOURS * 60) {
      return {
        ok: false,
        error: `You can only cancel a visit up to ${CANCEL_LEAD_HOURS} hours before it starts.`,
      }
    }
  }

  const when = `${appointment.date} at ${appointment.time}`
  const patientBody = `Your visit with ${appointment.doctor.name} on ${when} was cancelled.`
  const doctorBody = `The visit with ${appointment.patient.name} on ${when} was cancelled.`
  const subject = `MamaDoc: visit cancelled — ${when}`

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'CANCELLED',
        slotKey: null,
        patientSlotKey: null,
        cancelledAt: wallClockToUtc(now),
      },
    })
    await tx.notification.createMany({
      data: [
        { userId: appointment.patientId, kind: 'CANCEL', title: 'Visit cancelled', body: patientBody },
        { userId: appointment.doctor.userId, kind: 'CANCEL', title: 'Visit cancelled', body: doctorBody },
      ],
    })
    await tx.emailOutbox.createMany({
      data: [
        { toUserId: appointment.patientId, toEmail: appointment.patient.email, subject, body: patientBody },
        { toUserId: appointment.doctor.userId, toEmail: appointment.doctor.user.email, subject, body: doctorBody },
      ],
    })
  })
  return { ok: true }
}

/** Doctor "Mark done" — the doctor of that visit only. */
export async function markDone(
  prisma: BookingDb,
  id: string,
  doctorUserId: string,
): Promise<ActionResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { doctor: { include: { user: true } } },
  })
  if (!appointment) return { ok: false, error: 'That visit does not exist.' }
  if (appointment.doctor.userId !== doctorUserId) {
    return { ok: false, error: 'You can only update your own visits.' }
  }
  if (appointment.status === 'CANCELLED') {
    return { ok: false, error: 'A cancelled visit cannot be marked done.' }
  }
  await prisma.appointment.update({ where: { id }, data: { status: 'DONE' } })
  return { ok: true }
}

/** Doctor "Add meeting link" — the doctor of that visit only, https only. */
export async function setMeetingUrl(
  prisma: BookingDb,
  id: string,
  doctorUserId: string,
  url: string,
): Promise<ActionResult> {
  if (!url.startsWith('https://')) {
    return { ok: false, error: 'The meeting link must start with https://.' }
  }
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { doctor: { include: { user: true } } },
  })
  if (!appointment) return { ok: false, error: 'That visit does not exist.' }
  if (appointment.doctor.userId !== doctorUserId) {
    return { ok: false, error: 'You can only update your own visits.' }
  }
  await prisma.appointment.update({ where: { id }, data: { meetingUrl: url } })
  return { ok: true }
}

// ---------- helpers ----------

/** Which unique constraint fired, if any (P2002, or raw 23505 wrapped in P2010). */
function uniqueConflictTarget(e: unknown): string | null {
  const err = e as { code?: string; meta?: unknown }
  const meta = JSON.stringify(err?.meta ?? {})
  if (err?.code === 'P2002') return meta
  if (err?.code === 'P2010' && meta.includes('23505')) return meta
  return null
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** APP_TZ wall clock → real UTC instant (cancelledAt column). */
function wallClockToUtc(now: LocalNow): Date {
  const timeZone = process.env.APP_TZ || 'Africa/Lagos'
  const naive = Date.parse(`${now.date}T${now.time}:00Z`)
  const offset1 = tzOffsetMs(naive, timeZone)
  const offset2 = tzOffsetMs(naive - offset1, timeZone)
  return new Date(naive - offset2)
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - utcMs
}
