/**
 * Booking tests against the real Neon database.
 * Every test creates its own users/doctor with unique emails (RUN marker),
 * uses dates far in the future with a fixed "now", and deletes only the rows
 * it created (all children of the RUN users). Never calls the seed, never
 * wipes tables. 60 s timeout per test (vitest.config.ts).
 */
import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  bookAppointment,
  cancelAppointment,
  markDone,
  setMeetingUrl,
  type BookAppointmentInput,
} from './booking'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  throw new Error('DATABASE_URL is missing from .env — the booking tests need the database.')
}

// This PC has a slow network: a TCP connect to Neon can take ~5 s, which
// trips Prisma's default 5-second connect timeout, and a slow query can hold
// a pool connection past the default 10-second pool wait. Raise both at
// runtime only (.env is never edited): connect_timeout, then pool_timeout.
const withConnect = dbUrl.includes('connect_timeout') ? dbUrl : `${dbUrl}&connect_timeout=30`
const datasourceUrl = withConnect.includes('pool_timeout') ? withConnect : `${withConnect}&pool_timeout=30`
const prisma = new PrismaClient({ datasourceUrl })

// A fixed clock, injected everywhere. All dates below are far in the future,
// so no test can ever depend on (or collide with) today's real date.
const NOW = { date: '2027-05-10', time: '06:00' } // Monday
const LATE_NOW = { date: '2027-05-11', time: '10:00' } // 1 h before an 11:00 visit

const RUN = Date.now().toString(36) // unique marker for this test run
let seq = 0
const mail = (local: string) => `${local}.${RUN}@mamadoc.test`

type Fixture = {
  patientA: string
  p1: string
  p2: string
  p3: string
  doctorA: string
  doctorAUserId: string
  doctor1: string
  doctor1UserId: string
  doctor2: string
  doctor2UserId: string
  allUserIds: string[]
  allDoctorIds: string[]
}
let fx: Fixture

const rulesFor = (doctorId: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    doctorId,
    weekday,
    startTime: '09:00',
    endTime: '16:00',
    slotMinutes: 30,
  }))

beforeAll(async () => {
  const mkUser = (local: string, name: string, role: 'PATIENT' | 'DOCTOR') =>
    prisma.user.create({
      data: {
        email: mail(local),
        name,
        phone: '08000000000',
        passHash: 'test-hash-not-used',
        role,
      },
    })

  const patientA = await mkUser(`pa${++seq}`, 'Test Patient A', 'PATIENT')
  const p1 = await mkUser(`p1${++seq}`, 'Test Patient 1', 'PATIENT')
  const p2 = await mkUser(`p2${++seq}`, 'Test Patient 2', 'PATIENT')
  const p3 = await mkUser(`p3${++seq}`, 'Test Patient 3', 'PATIENT')
  const uA = await mkUser(`ua${++seq}`, 'Test Doctor A', 'DOCTOR')
  const u1 = await mkUser(`u1${++seq}`, 'Test Doctor 1', 'DOCTOR')
  const u2 = await mkUser(`u2${++seq}`, 'Test Doctor 2', 'DOCTOR')

  const docA = await prisma.doctor.create({
    data: { userId: uA.id, name: uA.name, specialty: 'Antenatal' },
  })
  const doc1 = await prisma.doctor.create({
    data: { userId: u1.id, name: u1.name, specialty: 'Antenatal' },
  })
  const doc2 = await prisma.doctor.create({
    data: { userId: u2.id, name: u2.name, specialty: 'Antenatal' },
  })
  await prisma.availabilityRule.createMany({
    data: [...rulesFor(docA.id), ...rulesFor(doc1.id), ...rulesFor(doc2.id)],
  })

  fx = {
    patientA: patientA.id,
    p1: p1.id,
    p2: p2.id,
    p3: p3.id,
    doctorA: docA.id,
    doctorAUserId: uA.id,
    doctor1: doc1.id,
    doctor1UserId: u1.id,
    doctor2: doc2.id,
    doctor2UserId: u2.id,
    allUserIds: [patientA.id, p1.id, p2.id, p3.id, uA.id, u1.id, u2.id],
    allDoctorIds: [docA.id, doc1.id, doc2.id],
  }
})

afterAll(async () => {
  if (fx) {
    const { allUserIds, allDoctorIds } = fx
    await prisma.notification.deleteMany({ where: { userId: { in: allUserIds } } })
    await prisma.emailOutbox.deleteMany({ where: { toUserId: { in: allUserIds } } })
    await prisma.appointment.deleteMany({ where: { doctorId: { in: allDoctorIds } } })
    await prisma.timeOff.deleteMany({ where: { doctorId: { in: allDoctorIds } } })
    await prisma.availabilityRule.deleteMany({ where: { doctorId: { in: allDoctorIds } } })
    await prisma.doctor.deleteMany({ where: { id: { in: allDoctorIds } } })
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } })
  }
  await prisma.$disconnect()
})

const base = (over: Partial<BookAppointmentInput> = {}): BookAppointmentInput => ({
  patientId: fx.p1,
  doctorId: fx.doctor1,
  date: '2027-05-10',
  time: '09:00',
  reason: 'ROUTINE',
  symptoms: [],
  weeks: 20,
  ...over,
})

describe('bookAppointment', () => {
  it('a normal booking creates the appointment and four message rows', async () => {
    const result = await bookAppointment(
      prisma,
      base({ patientId: fx.patientA, doctorId: fx.doctorA, time: '10:00' }),
      NOW,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.level).toBe('NORMAL')
    expect(result.message).toBe('Booked.')

    const appointment = await prisma.appointment.findUnique({
      where: { id: result.appointmentId },
    })
    expect(appointment).toMatchObject({
      patientId: fx.patientA,
      doctorId: fx.doctorA,
      date: '2027-05-10',
      time: '10:00',
      durationMin: 30,
      status: 'BOOKED',
      triageLevel: 'NORMAL',
      reason: 'ROUTINE',
      weeks: 20,
      severe: false,
      symptomsJson: '[]',
      slotKey: `${fx.doctorA}|2027-05-10|10:00`,
      patientSlotKey: `${fx.patientA}|2027-05-10|10:00`,
    })

    // exactly 2 notifications + 2 simulated emails (patient and doctor each)
    const notifications = await prisma.notification.findMany({
      where: { userId: { in: [fx.patientA, fx.doctorAUserId] } },
    })
    expect(notifications).toHaveLength(2)
    const emails = await prisma.emailOutbox.findMany({
      where: { toUserId: { in: [fx.patientA, fx.doctorAUserId] } },
    })
    expect(emails).toHaveLength(2)
    expect(emails.map((e) => e.toUserId).sort()).toEqual(
      [fx.patientA, fx.doctorAUserId].sort(),
    )
  })

  it('rejects an urgent booking outside the urgent 3-day window', async () => {
    // NOW is 2027-05-10 → urgent window ends 2027-05-12; 2027-05-14 is too far.
    const result = await bookAppointment(
      prisma,
      base({ date: '2027-05-14', time: '09:00', symptoms: ['Bad headache'] }),
      NOW,
    )
    expect(result).toEqual({
      ok: false,
      error: 'Urgent visits can only be booked within the next 3 days.',
    })
    const rows = await prisma.appointment.count({
      where: { doctorId: fx.doctor1, date: '2027-05-14' },
    })
    expect(rows).toBe(0)
  })

  it('rejects a time that is not in the generated slots', async () => {
    const outsideHours = await bookAppointment(
      prisma,
      base({ time: '23:30' }),
      NOW,
    )
    expect(outsideHours).toEqual({ ok: false, error: 'That time is not available.' })

    const pastToday = await bookAppointment(prisma, base({ time: '09:15' }), NOW)
    expect(pastToday).toEqual({ ok: false, error: 'That time is not available.' })

    // a day off removes the whole day
    await prisma.timeOff.create({ data: { doctorId: fx.doctor1, date: '2027-05-12' } })
    const dayOff = await bookAppointment(
      prisma,
      base({ date: '2027-05-12', time: '09:00' }),
      NOW,
    )
    expect(dayOff).toEqual({ ok: false, error: 'That time is not available.' })
  })

  it('RACE: two bookings for the same slot — exactly one succeeds', async () => {
    const slot = { date: '2027-05-13', time: '09:00' }
    const [a, b] = await Promise.all([
      bookAppointment(prisma, base({ patientId: fx.p1, ...slot }), NOW),
      bookAppointment(prisma, base({ patientId: fx.p2, ...slot }), NOW),
    ])
    const winners = [a, b].filter((r) => r.ok)
    expect(winners).toHaveLength(1)
    const loser = [a, b].find((r) => !r.ok)
    expect(loser && !loser.ok && loser.error).toBe('Someone just took this time. Pick another.')
    const rows = await prisma.appointment.count({
      where: { doctorId: fx.doctor1, date: slot.date, time: slot.time, status: 'BOOKED' },
    })
    expect(rows).toBe(1)
  })

  it('RACE: same patient, same time, two doctors — exactly one succeeds', async () => {
    const slot = { date: '2027-05-13', time: '10:00' }
    const [a, b] = await Promise.all([
      bookAppointment(prisma, base({ patientId: fx.p3, doctorId: fx.doctor1, ...slot }), NOW),
      bookAppointment(prisma, base({ patientId: fx.p3, doctorId: fx.doctor2, ...slot }), NOW),
    ])
    const winners = [a, b].filter((r) => r.ok)
    expect(winners).toHaveLength(1)
    const loser = [a, b].find((r) => !r.ok)
    expect(loser && !loser.ok && loser.error).toMatch(
      /You already have a visit at this time\.|Someone just took this time\. Pick another\./,
    )
  })

  it('the caller cannot force the triage level or the severe flag', async () => {
    // (1) caller claims URGENT but answers with no symptom → NORMAL
    const forcedUrgent = {
      ...base({ patientId: fx.p2, time: '10:00' }),
      level: 'URGENT',
      severe: true,
      position: 3,
      queuePosition: 1,
    } as unknown as BookAppointmentInput
    const r1 = await bookAppointment(prisma, forcedUrgent, NOW)
    expect(r1.ok).toBe(true)
    if (r1.ok) {
      expect(r1.level).toBe('NORMAL')
      expect(r1.severe).toBe(false)
      const row = await prisma.appointment.findUnique({ where: { id: r1.appointmentId } })
      expect(row?.triageLevel).toBe('NORMAL')
      expect(row?.severe).toBe(false)
    }

    // (2) caller claims NORMAL but answers with a severe symptom → URGENT + severe
    const forcedNormal = {
      ...base({ patientId: fx.p2, time: '11:00', symptoms: ['Bleeding'] }),
      level: 'NORMAL',
      severe: false,
    } as unknown as BookAppointmentInput
    const r2 = await bookAppointment(prisma, forcedNormal, NOW)
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.level).toBe('URGENT')
      expect(r2.severe).toBe(true)
      const row = await prisma.appointment.findUnique({ where: { id: r2.appointmentId } })
      expect(row?.triageLevel).toBe('URGENT')
      expect(row?.severe).toBe(true)
      expect(row?.symptomsJson).toBe(JSON.stringify(['Bleeding']))
    }

    // the doctor's urgent notification says URGENT and lists the symptoms
    const urgentNote = await prisma.notification.findFirst({
      where: { userId: fx.doctor1UserId, body: { contains: 'Bleeding' } },
    })
    expect(urgentNote?.body).toContain('URGENT')
    expect(urgentNote?.body).toContain('Bleeding')
  })

  it('rejects invalid raw answers with one plain sentence', async () => {
    const badWeeks = await bookAppointment(prisma, base({ weeks: 0 }), NOW)
    expect(badWeeks.ok).toBe(false)
    if (!badWeeks.ok) expect(badWeeks.error).toMatch(/^[^.!?]+[.!?]$/)

    const badSymptom = await bookAppointment(
      prisma,
      base({ symptoms: ['Fever'] }),
      NOW,
    )
    expect(badSymptom.ok).toBe(false)
    if (!badSymptom.ok) expect(badSymptom.error).toMatch(/^[^.!?]+[.!?]$/)
  })
})

describe('cancelAppointment', () => {
  it('cancel frees the slot so it can be booked again', async () => {
    const booked = await bookAppointment(
      prisma,
      base({ patientId: fx.p2, date: '2027-05-11', time: '09:00' }),
      NOW,
    )
    expect(booked.ok).toBe(true)
    if (!booked.ok) return

    const cancelled = await cancelAppointment(
      prisma,
      booked.appointmentId,
      { role: 'PATIENT', userId: fx.p2 },
      NOW,
    )
    expect(cancelled).toEqual({ ok: true })

    const row = await prisma.appointment.findUnique({ where: { id: booked.appointmentId } })
    expect(row?.status).toBe('CANCELLED')
    expect(row?.slotKey).toBeNull()
    expect(row?.patientSlotKey).toBeNull()
    expect(row?.cancelledAt).not.toBeNull()

    // the slot is free again
    const rebooked = await bookAppointment(
      prisma,
      base({ patientId: fx.p1, date: '2027-05-11', time: '09:00' }),
      NOW,
    )
    expect(rebooked.ok).toBe(true)

    // both sides are notified of the cancellation
    const notes = await prisma.notification.count({
      where: { userId: { in: [fx.p2, fx.doctor1UserId] }, kind: 'CANCEL' },
    })
    expect(notes).toBe(2)
  })

  it('a patient cannot cancel another patient’s visit', async () => {
    const booked = await bookAppointment(
      prisma,
      base({ patientId: fx.p3, date: '2027-05-11', time: '10:00' }),
      NOW,
    )
    expect(booked.ok).toBe(true)
    if (!booked.ok) return
    const refused = await cancelAppointment(
      prisma,
      booked.appointmentId,
      { role: 'PATIENT', userId: fx.p1 },
      NOW,
    )
    expect(refused).toEqual({ ok: false, error: 'You can only cancel your own visit.' })
  })

  it('a patient cannot cancel less than 2 hours before the visit', async () => {
    const booked = await bookAppointment(
      prisma,
      base({ patientId: fx.p3, date: '2027-05-11', time: '11:00' }),
      NOW,
    )
    expect(booked.ok).toBe(true)
    if (!booked.ok) return

    // 1 hour before start → refused
    const refused = await cancelAppointment(
      prisma,
      booked.appointmentId,
      { role: 'PATIENT', userId: fx.p3 },
      LATE_NOW,
    )
    expect(refused.ok).toBe(false)
    if (!refused.ok) {
      expect(refused.error).toBe('You can only cancel a visit up to 2 hours before it starts.')
    }

    // the doctor of that visit cancels anyway → allowed at any time
    const byDoctor = await cancelAppointment(
      prisma,
      booked.appointmentId,
      { role: 'DOCTOR', userId: fx.doctor1UserId },
      LATE_NOW,
    )
    expect(byDoctor).toEqual({ ok: true })
    const row = await prisma.appointment.findUnique({ where: { id: booked.appointmentId } })
    expect(row?.status).toBe('CANCELLED')
  })

  it('a doctor cannot cancel another doctor’s visit', async () => {
    const booked = await bookAppointment(
      prisma,
      base({ patientId: fx.p1, date: '2027-05-11', time: '13:00' }),
      NOW,
    )
    expect(booked.ok).toBe(true)
    if (!booked.ok) return
    const refused = await cancelAppointment(
      prisma,
      booked.appointmentId,
      { role: 'DOCTOR', userId: fx.doctor2UserId },
      NOW,
    )
    expect(refused).toEqual({ ok: false, error: 'You can only cancel your own visits.' })
  })
})

describe('markDone and setMeetingUrl', () => {
  let visitId: string

  beforeAll(async () => {
    // 2027-05-15 (Saturday) — not blocked by the day-off test above
    const booked = await bookAppointment(
      prisma,
      base({ patientId: fx.p2, date: '2027-05-15', time: '13:00' }),
      NOW,
    )
    expect(booked.ok).toBe(true)
    if (booked.ok) visitId = booked.appointmentId
  })

  it('refuses another doctor for both actions', async () => {
    const done = await markDone(prisma, visitId, fx.doctor2UserId)
    expect(done).toEqual({ ok: false, error: 'You can only update your own visits.' })
    const link = await setMeetingUrl(prisma, visitId, fx.doctor2UserId, 'https://meet.example/x')
    expect(link).toEqual({ ok: false, error: 'You can only update your own visits.' })
  })

  it('refuses an http:// link', async () => {
    const link = await setMeetingUrl(prisma, visitId, fx.doctor1UserId, 'http://meet.example/x')
    expect(link).toEqual({ ok: false, error: 'The meeting link must start with https://.' })
    const row = await prisma.appointment.findUnique({ where: { id: visitId } })
    expect(row?.meetingUrl).toBeNull()
  })

  it('the owning doctor sets an https link and marks the visit done', async () => {
    const link = await setMeetingUrl(prisma, visitId, fx.doctor1UserId, 'https://meet.example/abc')
    expect(link).toEqual({ ok: true })
    const done = await markDone(prisma, visitId, fx.doctor1UserId)
    expect(done).toEqual({ ok: true })
    const row = await prisma.appointment.findUnique({ where: { id: visitId } })
    expect(row?.meetingUrl).toBe('https://meet.example/abc')
    expect(row?.status).toBe('DONE')
  })
})
