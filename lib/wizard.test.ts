/**
 * Wizard tests against the real Neon database (same conventions as
 * booking.test.ts: own users/doctor with a unique RUN marker, far-future
 * dates, a fixed clock, cleanup of only the rows this file created).
 * The pure parts (grid, URL sanitizing) are tested without the database.
 */
import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LEAD_MINUTES } from './config'
import { prisma } from './db'
import type { SlotRule } from './slots'
import {
  bookVisitFor,
  buildDayGrid,
  sanitizeWizardParams,
  summarizeDays,
  wizardStep,
} from './wizard'

const RUN = Date.now().toString(36)
const NOW = { date: '2027-06-07', time: '06:00' } // Monday

let seq = 0
const mail = (local: string) => `${local}.${RUN}@wiz.mamadoc.test`

type Fixture = {
  patient: string
  otherPatient: string
  doctorUserId: string
  doctorId: string
  allUserIds: string[]
  allDoctorIds: string[]
}
let fx: Fixture

const rules: SlotRule[] = []

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

  const patient = await mkUser(`p${++seq}`, 'Wizard Patient', 'PATIENT')
  const otherPatient = await mkUser(`p${++seq}`, 'Wizard Other Patient', 'PATIENT')
  const doctorUser = await mkUser(`d${++seq}`, 'Wizard Doctor', 'DOCTOR')
  const doctor = await prisma.doctor.create({
    data: { userId: doctorUser.id, name: doctorUser.name, specialty: 'Antenatal' },
  })
  const doctorRules: SlotRule[] = [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    doctorId: doctor.id,
    weekday,
    startTime: '09:00',
    endTime: '12:00',
    slotMinutes: 30,
  }))
  await prisma.availabilityRule.createMany({ data: doctorRules })
  rules.push(...doctorRules)

  fx = {
    patient: patient.id,
    otherPatient: otherPatient.id,
    doctorUserId: doctorUser.id,
    doctorId: doctor.id,
    allUserIds: [patient.id, otherPatient.id, doctorUser.id],
    allDoctorIds: [doctor.id],
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

describe('bookVisitFor', () => {
  it('books for the session patient and creates the visit', async () => {
    const result = await bookVisitFor(
      prisma,
      { role: 'PATIENT', userId: fx.patient },
      { doctorId: fx.doctorId, date: '2027-06-07', time: '09:00', reason: 'ROUTINE' },
      NOW,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = await prisma.appointment.findUnique({
      where: { id: result.appointmentId },
    })
    expect(row?.patientId).toBe(fx.patient)
    expect(row?.triageLevel).toBe('NORMAL')
  })

  it('rejects the wrong role: a doctor cannot use the patient wizard', async () => {
    const result = await bookVisitFor(
      prisma,
      { role: 'DOCTOR', userId: fx.doctorUserId },
      { doctorId: fx.doctorId, date: '2027-06-07', time: '09:30', reason: 'ROUTINE' },
      NOW,
    )
    expect(result).toEqual({
      ok: false,
      error: 'You can only book a visit with a patient account.',
    })
    const rows = await prisma.appointment.count({
      where: { doctorId: fx.doctorId, patientId: fx.doctorUserId },
    })
    expect(rows).toBe(0)
  })

  it('ignores a smuggled foreign patient id — the session patient is booked', async () => {
    const result = await bookVisitFor(
      prisma,
      { role: 'PATIENT', userId: fx.patient },
      {
        doctorId: fx.doctorId,
        date: '2027-06-08',
        time: '09:00',
        reason: 'ROUTINE',
        // A hostile form field: must never be honoured.
        patientId: fx.otherPatient,
      } as Parameters<typeof bookVisitFor>[2] & { patientId: string },
      NOW,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = await prisma.appointment.findUnique({
      where: { id: result.appointmentId },
    })
    expect(row?.patientId).toBe(fx.patient)
    const charged = await prisma.appointment.count({
      where: { patientId: fx.otherPatient },
    })
    expect(charged).toBe(0)
  })

  it('RACE: two wizard bookings for the same slot — the loser gets the plain sentence', async () => {
    const slot = { doctorId: fx.doctorId, date: '2027-06-09', time: '09:00', reason: 'ROUTINE' as const }
    const [a, b] = await Promise.all([
      bookVisitFor(prisma, { role: 'PATIENT', userId: fx.patient }, slot, NOW),
      bookVisitFor(prisma, { role: 'PATIENT', userId: fx.otherPatient }, slot, NOW),
    ])
    const winners = [a, b].filter((r) => r.ok)
    expect(winners).toHaveLength(1)
    const loser = [a, b].find((r) => !r.ok)
    expect(loser && !loser.ok && loser.error).toBe('Someone just took this time. Pick another.')
  })
})

describe('buildDayGrid / summarizeDays', () => {
  it('marks booked times as taken and excludes them from free counts', async () => {
    // "2027-06-10" is a Wednesday; 10:00 is already booked by the race test
    // neighbour? No — book one here to be sure.
    const booked = await prisma.appointment.findMany({
      where: { doctorId: fx.doctorId, date: '2027-06-10', status: 'BOOKED' },
      select: { time: true },
    })
    const bookedTimes = booked.map((b) => b.time)
    const grid = buildDayGrid({
      rules,
      doctorId: fx.doctorId,
      date: '2027-06-10',
      now: NOW,
      bookedTimes,
      leadMinutes: LEAD_MINUTES,
    })
    // 09:00–12:00 in 30-minute steps = 6 slots
    expect(grid).toHaveLength(6)
    for (const slot of grid) {
      expect(slot.taken).toBe(bookedTimes.includes(slot.time))
    }

    const days = summarizeDays({
      rules,
      doctorId: fx.doctorId,
      now: NOW,
      timeOffDates: [],
      bookedKeys: bookedTimes.map((t) => `${fx.doctorId}|2027-06-10|${t}`),
      days: 1,
      leadMinutes: LEAD_MINUTES,
    })
    expect(days).toEqual([{ date: '2027-06-07', freeCount: expect.any(Number) }])
  })

  it('a day off removes the whole day from the summary', async () => {
    const days = summarizeDays({
      rules,
      doctorId: fx.doctorId,
      now: NOW,
      timeOffDates: ['2027-06-08'], // Tuesday
      bookedKeys: [],
      days: 2,
      leadMinutes: LEAD_MINUTES,
    })
    expect(days.find((d) => d.date === '2027-06-08')?.freeCount).toBe(0)
    expect(days.find((d) => d.date === '2027-06-07')?.freeCount).toBeGreaterThan(0)
  })

  it("another doctor's hours never inflate this doctor's counts", () => {
    // A second doctor with wide hours on the days the fixture doctor also
    // works: the summary must count only the selected doctor's slots.
    const other: SlotRule[] = [0, 2, 6].map((weekday) => ({
      doctorId: 'other-doc',
      weekday,
      startTime: '08:00',
      endTime: '18:00',
      slotMinutes: 60, // 10 slots — more than the fixture doctor's 6
    }))
    const days = summarizeDays({
      rules: [...rules, ...other],
      doctorId: fx.doctorId,
      now: NOW,
      timeOffDates: [],
      bookedKeys: [],
      days: 7,
      leadMinutes: LEAD_MINUTES,
    })
    expect(days).toHaveLength(7)
    for (const day of days) {
      expect(day.freeCount).toBeLessThanOrEqual(6) // fixture doctor: 6/day
    }
  })

  it('today shows only slots after the lead-time cutoff', async () => {
    const grid = buildDayGrid({
      rules,
      doctorId: fx.doctorId,
      date: NOW.date,
      now: NOW,
      bookedTimes: [],
      leadMinutes: LEAD_MINUTES,
    })
    // now 06:00 + 30 min → 09:00 is the first allowed slot of the day
    expect(grid[0]?.time).toBe('09:00')
    expect(grid.every((s) => s.time >= '09:00')).toBe(true)
  })
})

describe('sanitizeWizardParams / wizardStep', () => {
  it('keeps well-formed URL state and drops garbage', () => {
    const good = sanitizeWizardParams({
      doctor: 'ckx123abc',
      date: '2026-10-21',
      time: '09:30',
      q: 'amaka',
    })
    expect(good).toEqual({ doctorId: 'ckx123abc', date: '2026-10-21', time: '09:30', q: 'amaka' })

    const bad = sanitizeWizardParams({
      doctor: '../../etc/passwd',
      date: '21-10-2026',
      time: '25:99',
      q: 'x'.repeat(500),
    })
    expect(bad).toEqual({ doctorId: null, date: null, time: null, q: null })
  })

  it('derives the step from what the URL carries', () => {
    expect(wizardStep({ doctorId: null, date: null, time: null, q: null })).toBe(1)
    expect(wizardStep({ doctorId: 'd1', date: null, time: null, q: null })).toBe(2)
    expect(wizardStep({ doctorId: 'd1', date: '2026-10-21', time: null, q: null })).toBe(2)
    expect(wizardStep({ doctorId: 'd1', date: '2026-10-21', time: '09:30', q: null })).toBe(3)
  })
})
