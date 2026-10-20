/**
 * "My hours" tests against the real Neon database (same conventions as
 * booking.test.ts: own users/doctor with a unique RUN marker, cleanup of
 * only the rows this file created).
 */
import 'dotenv/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from './db'
import { addDayOff, loadHours, removeDayOff, saveHours } from './hours'
import type { HoursEntry } from './hoursShared'
import { generateSlots } from './slots'
import type { LocalNow } from './urgentWindow'

const RUN = Date.now().toString(36)
const NOW: LocalNow = { date: '2027-07-05', time: '06:00' } // Monday

let seq = 0
const mail = (local: string) => `${local}.${RUN}@hours.mamadoc.test`

type Fixture = {
  doctorUserId: string
  doctorId: string
  otherDoctorUserId: string
  otherDoctorId: string
  patientUserId: string
  allUserIds: string[]
  allDoctorIds: string[]
}
let fx: Fixture

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

  const doctorUser = await mkUser(`d${++seq}`, 'Hours Doctor', 'DOCTOR')
  const otherUser = await mkUser(`d${++seq}`, 'Hours Other Doctor', 'DOCTOR')
  const patientUser = await mkUser(`p${++seq}`, 'Hours Patient', 'PATIENT')
  const doctor = await prisma.doctor.create({
    data: { userId: doctorUser.id, name: doctorUser.name, specialty: 'Antenatal' },
  })
  const other = await prisma.doctor.create({
    data: { userId: otherUser.id, name: otherUser.name, specialty: 'Antenatal' },
  })

  fx = {
    doctorUserId: doctorUser.id,
    doctorId: doctor.id,
    otherDoctorUserId: otherUser.id,
    otherDoctorId: other.id,
    patientUserId: patientUser.id,
    allUserIds: [doctorUser.id, otherUser.id, patientUser.id],
    allDoctorIds: [doctor.id, other.id],
  }
})

afterAll(async () => {
  if (fx) {
    const { allUserIds, allDoctorIds } = fx
    await prisma.timeOff.deleteMany({ where: { doctorId: { in: allDoctorIds } } })
    await prisma.availabilityRule.deleteMany({ where: { doctorId: { in: allDoctorIds } } })
    await prisma.doctor.deleteMany({ where: { id: { in: allDoctorIds } } })
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } })
  }
  await prisma.$disconnect()
})

/** Seven rows, one per weekday; only the passed weekdays are enabled. */
function week(enabled: Partial<Record<number, HoursEntry>> = {}): HoursEntry[] {
  return [0, 1, 2, 3, 4, 5, 6].map(
    (weekday) =>
      enabled[weekday] ?? {
        weekday,
        enabled: false,
        startTime: '09:00',
        endTime: '17:00',
        slotMinutes: 30,
      },
  )
}

describe('saveHours', () => {
  it('hours save loads back: what is saved is exactly what comes back', async () => {
    const saved = week({
      1: { weekday: 1, enabled: true, startTime: '08:00', endTime: '13:00', slotMinutes: 30 },
      4: { weekday: 4, enabled: true, startTime: '10:00', endTime: '14:00', slotMinutes: 60 },
    })
    const result = await saveHours(prisma, fx.doctorUserId, saved)
    expect(result).toEqual({ ok: true })

    const loaded = await loadHours(prisma, fx.doctorId)
    expect(loaded).toHaveLength(2)
    expect(loaded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ weekday: 1, startTime: '08:00', endTime: '13:00', slotMinutes: 30 }),
        expect.objectContaining({ weekday: 4, startTime: '10:00', endTime: '14:00', slotMinutes: 60 }),
      ]),
    )

    // and the slot generator agrees with the saved hours (2027-07-05 is the
    // Monday the weekday-1 rule covers; the lead cutoff is 06:00 < 08:00)
    const slots = generateSlots({
      rules: loaded,
      now: NOW,
      fromDate: '2027-07-05', // Monday
      days: 1,
      leadMinutes: 0,
    })
    expect(slots[0]?.time).toBe('08:00')
    expect(slots.every((s) => s.date === '2027-07-05')).toBe(true)

    // switching every day off empties the week again
    const cleared = await saveHours(prisma, fx.doctorUserId, week())
    expect(cleared).toEqual({ ok: true })
    expect(await loadHours(prisma, fx.doctorId)).toHaveLength(0)
  })

  it('rejects invalid rows with one plain sentence', async () => {
    const endBeforeStart = await saveHours(prisma, fx.doctorUserId, week({
      1: { weekday: 1, enabled: true, startTime: '13:00', endTime: '09:00', slotMinutes: 30 },
    }))
    expect(endBeforeStart.ok).toBe(false)
    if (!endBeforeStart.ok) {
      expect(endBeforeStart.error).toMatch(/^[^.!?]+[.!?]$/)
    }

    const badSlot = await saveHours(prisma, fx.doctorUserId, week({
      1: { weekday: 1, enabled: true, startTime: '09:00', endTime: '16:00', slotMinutes: 17 },
    }))
    expect(badSlot).toEqual({
      ok: false,
      error: 'Slot length must be 15, 20, 30, 45 or 60 minutes.',
    })

    const doesNotFit = await saveHours(prisma, fx.doctorUserId, week({
      1: { weekday: 1, enabled: true, startTime: '09:00', endTime: '16:11', slotMinutes: 30 },
    }))
    expect(doesNotFit.ok).toBe(false)
    if (!doesNotFit.ok) expect(doesNotFit.error).toMatch(/does not fit/)
  })

  it('refuses a non-doctor actor', async () => {
    const result = await saveHours(prisma, fx.patientUserId, week())
    expect(result).toEqual({ ok: false, error: 'That doctor account does not exist.' })
  })

  it('one doctor saving never touches another doctor’s rules', async () => {
    await saveHours(prisma, fx.otherDoctorUserId, week({
      2: { weekday: 2, enabled: true, startTime: '09:00', endTime: '15:00', slotMinutes: 30 },
    }))
    await saveHours(prisma, fx.doctorUserId, week({
      1: { weekday: 1, enabled: true, startTime: '08:00', endTime: '12:00', slotMinutes: 30 },
    }))
    const others = await loadHours(prisma, fx.otherDoctorId)
    expect(others).toHaveLength(1)
    expect(others[0]?.weekday).toBe(2)
    // reset for later tests
    await saveHours(prisma, fx.otherDoctorUserId, week())
    await saveHours(prisma, fx.doctorUserId, week())
  })
})

describe('addDayOff / removeDayOff', () => {
  it('adds a day off with a reason and loads it back', async () => {
    const added = await addDayOff(prisma, fx.doctorUserId, '2027-07-10', 'Training')
    expect(added).toEqual({ ok: true })
    const row = await prisma.timeOff.findFirst({
      where: { doctorId: fx.doctorId, date: '2027-07-10' },
    })
    expect(row?.reason).toBe('Training')
  })

  it('a duplicate date is one plain sentence', async () => {
    const again = await addDayOff(prisma, fx.doctorUserId, '2027-07-10', 'Again')
    expect(again).toEqual({ ok: false, error: 'You already marked that day off.' })
  })

  it('rejects an invalid date', async () => {
    const bad = await addDayOff(prisma, fx.doctorUserId, '10/07/2027', 'Nope')
    expect(bad).toEqual({ ok: false, error: 'Pick a valid date for the day off.' })
  })

  it('another doctor cannot remove this doctor’s day off', async () => {
    const target = await prisma.timeOff.findFirst({
      where: { doctorId: fx.doctorId, date: '2027-07-10' },
    })
    const refused = await removeDayOff(prisma, fx.otherDoctorUserId, target!.id)
    expect(refused).toEqual({ ok: false, error: 'That day off does not exist.' })
    const still = await prisma.timeOff.findUnique({ where: { id: target!.id } })
    expect(still).not.toBeNull()
  })

  it('the owning doctor removes their day off', async () => {
    const target = await prisma.timeOff.findFirst({
      where: { doctorId: fx.doctorId, date: '2027-07-10' },
    })
    const removed = await removeDayOff(prisma, fx.doctorUserId, target!.id)
    expect(removed).toEqual({ ok: true })
    const gone = await prisma.timeOff.findUnique({ where: { id: target!.id } })
    expect(gone).toBeNull()
  })

  it('a patient cannot add days off', async () => {
    const result = await addDayOff(prisma, fx.patientUserId, '2027-07-11', 'Nope')
    expect(result).toEqual({ ok: false, error: 'That doctor account does not exist.' })
  })
})
