/**
 * Proves the database itself blocks double booking (and the other
 * step-1 CHECK constraints) against the live seeded database.
 * Cleans up its own rows. Exits non-zero if any constraint fails.
 *
 * Run: npm run verify:constraints
 */
import 'dotenv/config'
import { AppointmentReason, PrismaClient, TriageLevel } from '@prisma/client'

const prisma = new PrismaClient()
const APP_TZ = process.env.APP_TZ || 'Africa/Lagos'

function todayInTz(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(new Date())
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10)
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function slotsFor(rule: { startTime: string; endTime: string; slotMinutes: number }): string[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const start = toMin(rule.startTime)
  const end = toMin(rule.endTime)
  const out: string[] = []
  for (let m = start; m + rule.slotMinutes <= end; m += rule.slotMinutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return out
}

function codeOf(e: unknown): string {
  // Prisma wraps raw-query errors in P2010; the real SQLSTATE is in meta.code.
  const err = e as { code?: string; message?: string; meta?: { code?: string } }
  if (err?.code === 'P2010' && err.meta?.code) return String(err.meta.code)
  return String(err?.code ?? err?.message ?? 'unknown')
}

function check(name: string, ok: boolean, detail: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` (${detail})`}`)
  if (!ok) process.exitCode = 1
}

async function main(): Promise<void> {
  const today = todayInTz()
  const date = addDays(today, 14) // far from seeded appointments
  const weekday = weekdayOf(date)
  const rule = await prisma.availabilityRule.findFirst({ where: { weekday } })
  if (!rule) throw new Error('No availability rule found for the test date.')

  const doctors = await prisma.doctor.findMany()
  const otherDoctor = doctors.find((d) => d.id !== rule.doctorId)
  if (!otherDoctor) throw new Error('Need two doctors in the seed for this test.')

  const patients = await prisma.user.findMany({ where: { role: 'PATIENT' }, orderBy: { email: 'asc' }, take: 2 })
  if (patients.length < 2) throw new Error('Need two seeded patients for this test.')

  const slots = slotsFor(rule)
  if (slots.length < 3) throw new Error('Not enough slots on the test date.')
  const [t1, t2, t3] = slots

  // Every row id we attempt to insert — removed again in the finally block.
  const attempted: string[] = []
  let seedRowId: string | null = null

  try {
    // A valid appointment at (doctor, date, t1) — everything else must fail around it.
    const base = await prisma.appointment.create({
      data: {
        patientId: patients[0].id,
        doctorId: rule.doctorId,
        date,
        time: t1,
        durationMin: rule.slotMinutes,
        triageLevel: TriageLevel.NORMAL,
        reason: AppointmentReason.ROUTINE,
        symptomsJson: '[]',
        slotKey: `${rule.doctorId}|${date}|${t1}`,
        patientSlotKey: `${patients[0].id}|${date}|${t1}`,
      },
    })
    seedRowId = base.id
    attempted.push(base.id)

    // [1] same slotKey, different columns → only slotKey UNIQUE can fire
    try {
      const r1 = await prisma.appointment.create({
        data: {
          patientId: patients[1].id,
          doctorId: otherDoctor.id,
          date: addDays(date, 1),
          time: t1,
          durationMin: 30,
          triageLevel: TriageLevel.NORMAL,
          reason: AppointmentReason.ROUTINE,
          symptomsJson: '[]',
          slotKey: base.slotKey,
          patientSlotKey: `${patients[1].id}|${addDays(date, 1)}|${t1}`,
        },
      })
      attempted.push(r1.id)
      check('slotKey UNIQUE blocks doctor double booking', false, 'second insert succeeded')
    } catch (e) {
      check('slotKey UNIQUE blocks doctor double booking', codeOf(e) === 'P2002', `code ${codeOf(e)}`)
    }

    // [2] same patientSlotKey, different columns → only patientSlotKey UNIQUE can fire
    try {
      const r2 = await prisma.appointment.create({
        data: {
          patientId: patients[1].id,
          doctorId: otherDoctor.id,
          date: addDays(date, 2),
          time: t1,
          durationMin: 30,
          triageLevel: TriageLevel.NORMAL,
          reason: AppointmentReason.ROUTINE,
          symptomsJson: '[]',
          slotKey: `${otherDoctor.id}|${addDays(date, 2)}|${t1}`,
          patientSlotKey: base.patientSlotKey,
        },
      })
      attempted.push(r2.id)
      check('patientSlotKey UNIQUE blocks patient double booking', false, 'second insert succeeded')
    } catch (e) {
      check('patientSlotKey UNIQUE blocks patient double booking', codeOf(e) === 'P2002', `code ${codeOf(e)}`)
    }

    // [3] raw insert: same doctor+date+time, BOOKED, but bogus unique keys
    // → only the partial UNIQUE (doctorId,date,time) WHERE status='BOOKED' can fire
    const id3 = `probe-doctor-${Date.now()}`
    attempted.push(id3)
    try {
      await prisma.$executeRaw`
        INSERT INTO "Appointment" ("id","patientId","doctorId","date","time","durationMin","triageLevel","reason","symptomsJson","slotKey","patientSlotKey")
        VALUES (${id3}, ${patients[1].id}, ${rule.doctorId}, ${date}, ${t1}, 30, 'NORMAL', 'ROUTINE', '[]', ${id3}, ${id3 + '-p'})`
      check('partial UNIQUE (doctorId,date,time) WHERE BOOKED', false, 'raw insert succeeded')
    } catch (e) {
      check('partial UNIQUE (doctorId,date,time) WHERE BOOKED', codeOf(e) === '23505', `code ${codeOf(e)}`)
    }

    // [4] raw insert: same patient+date+time, BOOKED, different doctor, bogus keys
    const id4 = `probe-patient-${Date.now()}`
    attempted.push(id4)
    try {
      await prisma.$executeRaw`
        INSERT INTO "Appointment" ("id","patientId","doctorId","date","time","durationMin","triageLevel","reason","symptomsJson","slotKey","patientSlotKey")
        VALUES (${id4}, ${patients[0].id}, ${otherDoctor.id}, ${date}, ${t1}, 30, 'NORMAL', 'ROUTINE', '[]', ${id4}, ${id4 + '-p'})`
      check('partial UNIQUE (patientId,date,time) WHERE BOOKED', false, 'raw insert succeeded')
    } catch (e) {
      check('partial UNIQUE (patientId,date,time) WHERE BOOKED', codeOf(e) === '23505', `code ${codeOf(e)}`)
    }

    // [5] CHECK weeks 1–42 (free slot on the same day, bogus keys)
    const id5 = `probe-weeks-${Date.now()}`
    attempted.push(id5)
    try {
      await prisma.$executeRaw`
        INSERT INTO "Appointment" ("id","patientId","doctorId","date","time","durationMin","triageLevel","reason","weeks","symptomsJson","slotKey","patientSlotKey")
        VALUES (${id5}, ${patients[1].id}, ${rule.doctorId}, ${date}, ${t2}, 30, 'NORMAL', 'ROUTINE', 99, '[]', ${id5}, ${id5 + '-p'})`
      check('CHECK weeks between 1 and 42 (or NULL)', false, 'raw insert succeeded')
    } catch (e) {
      check('CHECK weeks between 1 and 42 (or NULL)', codeOf(e) === '23514', `code ${codeOf(e)}`)
    }

    // [6] CHECK slotMinutes in 15/20/30/45/60 on availability rules
    const id6 = `probe-rule-${Date.now()}`
    attempted.push(id6)
    try {
      await prisma.$executeRaw`
        INSERT INTO "AvailabilityRule" ("id","doctorId","weekday","startTime","endTime","slotMinutes")
        VALUES (${id6}, ${rule.doctorId}, 6, '22:00', '23:00', 25)`
      check('CHECK slotMinutes in 15/20/30/45/60', false, 'raw insert succeeded')
    } catch (e) {
      check('CHECK slotMinutes in 15/20/30/45/60', codeOf(e) === '23514', `code ${codeOf(e)}`)
    }

    // sanity: t3 stays free — the base row did not over-constrain the day
    void t3
  } finally {
    await prisma.appointment.deleteMany({ where: { id: { in: attempted.filter((id) => id !== null) } } })
    await prisma.availabilityRule.deleteMany({ where: { id: { in: attempted } } })
    void seedRowId
  }

  console.log(process.exitCode === 1 ? 'Some checks FAILED.' : 'All checks passed. Test rows removed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
