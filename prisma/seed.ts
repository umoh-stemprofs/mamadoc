/**
 * MamaDoc seed — step 1 (schema + seed).
 *
 * 2 antenatal doctors with availability rules, 3 patients,
 * booked / cancelled / done visits, and today's queue for one doctor:
 * urgent + normal bookings on the same day (13-mamadoc.md queue demo).
 *
 * The demo password below is documented in README.md only — never printed.
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import {
  AppointmentReason,
  AppointmentStatus,
  PrismaClient,
  Role,
  TriageLevel,
} from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'mamadocdemo1' // README.md only — never printed
const APP_TZ = process.env.APP_TZ || 'Africa/Lagos'

// ---------- calendar-date helpers (dates are APP_TZ calendar dates) ----------
function todayInTz(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ }).format(new Date())
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10)
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
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

function pickTimes(slots: string[], n: number): string[] {
  if (slots.length < n) throw new Error(`Only ${slots.length} slots available; ${n} needed.`)
  const picks: string[] = []
  for (let i = 0; i < n; i++) picks.push(slots[Math.floor((i * slots.length) / n)])
  return picks
}

function findDate(start: string, ok: (weekday: number) => boolean, dir: 1 | -1, max = 10): string {
  let d = start
  for (let i = 0; i < max; i++) {
    if (ok(weekdayOf(d))) return d
    d = addDays(d, dir)
  }
  throw new Error('No weekday with an availability rule found near ' + start)
}

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000)
}

// ---------- types ----------
type PatientRef = { id: string; name: string; email: string }
type DoctorRef = { id: string; userId: string; name: string; email: string }

/**
 * Booking = one database transaction (00-global §4):
 * appointment + notification + simulated email for patient AND doctor.
 * CANCELLED appointments free the slot (slotKey = patientSlotKey = null),
 * which is how the unique constraints allow re-booking later.
 */
async function createAppointment(opts: {
  patient: PatientRef
  doctor: DoctorRef
  date: string
  time: string
  durationMin: number
  status?: AppointmentStatus
  triageLevel: TriageLevel
  reason: AppointmentReason
  symptoms?: string[]
  weeks?: number | null
  severe?: boolean
  createdAt?: Date
  cancelledAt?: Date | null
}): Promise<void> {
  const status = opts.status ?? AppointmentStatus.BOOKED
  const cancelled = status === AppointmentStatus.CANCELLED
  const symptoms = opts.symptoms ?? []
  const weeks = opts.weeks ?? null
  const severe = opts.severe ?? false
  const urgent = opts.triageLevel === TriageLevel.URGENT
  const when = `${opts.date} at ${opts.time}`

  const patientTitle = cancelled ? 'Visit cancelled' : urgent ? 'Visit booked (urgent)' : 'Visit booked'
  const patientBody = cancelled
    ? `Your visit with ${opts.doctor.name} on ${when} was cancelled.`
    : `Visit with ${opts.doctor.name} on ${when} is confirmed.${urgent ? ' Booked. The doctor sees urgent patients first.' : ''}`
  const doctorTitle = cancelled ? 'Visit cancelled' : urgent ? 'URGENT visit booked' : 'Visit booked'
  const doctorBody = cancelled
    ? `The visit with ${opts.patient.name} on ${when} was cancelled.`
    : urgent
      ? `URGENT: ${opts.patient.name} on ${when}. Symptoms: ${symptoms.join(', ') || 'none reported'}. Weeks pregnant: ${weeks ?? 'not sure'}.`
      : `${opts.patient.name} on ${when}.`

  await prisma.$transaction(async (tx) => {
    await tx.appointment.create({
      data: {
        patientId: opts.patient.id,
        doctorId: opts.doctor.id,
        date: opts.date,
        time: opts.time,
        durationMin: opts.durationMin,
        status,
        triageLevel: opts.triageLevel,
        reason: opts.reason,
        symptomsJson: JSON.stringify(symptoms),
        weeks,
        severe,
        slotKey: cancelled ? null : `${opts.doctor.id}|${opts.date}|${opts.time}`,
        patientSlotKey: cancelled ? null : `${opts.patient.id}|${opts.date}|${opts.time}`,
        createdAt: opts.createdAt ?? new Date(),
        cancelledAt: opts.cancelledAt ?? null,
      },
    })

    await tx.notification.createMany({
      data: [
        { userId: opts.patient.id, kind: cancelled ? 'CANCEL' : 'BOOKING', title: patientTitle, body: patientBody },
        { userId: opts.doctor.userId, kind: cancelled ? 'CANCEL' : 'BOOKING', title: doctorTitle, body: doctorBody },
      ],
    })

    await tx.emailOutbox.createMany({
      data: [
        {
          toUserId: opts.patient.id,
          toEmail: opts.patient.email,
          subject: `MamaDoc: ${patientTitle.toLowerCase()} — ${when}`,
          body: `${patientBody}\n\nFor non-emergency visits only. Prototype, not for diagnosis or treatment. In an emergency call ${process.env.EMERGENCY_NUMBER || '112'}.`,
        },
        {
          toUserId: opts.doctor.userId,
          toEmail: opts.doctor.email,
          subject: `MamaDoc: ${doctorTitle.toLowerCase()} — ${when}`,
          body: `${doctorBody}\n\nFor non-emergency visits only. Prototype, not for diagnosis or treatment.`,
        },
      ],
    })
  })
}

// ---------- main ----------
async function main(): Promise<void> {
  const today = todayInTz()

  // 1. wipe in child-first order so re-seeding always works
  await prisma.$transaction([
    prisma.accessLog.deleteMany(),
    prisma.loginAttempt.deleteMany(),
    prisma.emailOutbox.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.healthFile.deleteMany(),
    prisma.healthProfile.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.timeOff.deleteMany(),
    prisma.availabilityRule.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.user.deleteMany(),
  ])

  // 2. users (demo password hashed here, documented in README only)
  const passHash = await bcrypt.hash(DEMO_PASSWORD, 10)

  const uDrObi = await prisma.user.create({
    data: { email: 'amaka.obi@mamadoc.demo', name: 'Dr. Amaka Obi', phone: '08031234567', passHash, role: Role.DOCTOR },
  })
  const uDrYusuf = await prisma.user.create({
    data: { email: 'zainab.yusuf@mamadoc.demo', name: 'Dr. Zainab Yusuf', phone: '08051234567', passHash, role: Role.DOCTOR },
  })
  const uChioma = await prisma.user.create({
    data: { email: 'chioma.eze@mamadoc.demo', name: 'Chioma Eze', phone: '08061234567', passHash, role: Role.PATIENT },
  })
  const uFatima = await prisma.user.create({
    data: { email: 'fatima.bello@mamadoc.demo', name: 'Fatima Bello', phone: '08071234567', passHash, role: Role.PATIENT },
  })
  const uNgozi = await prisma.user.create({
    data: { email: 'ngozi.okafor@mamadoc.demo', name: 'Ngozi Okafor', phone: '08081234567', passHash, role: Role.PATIENT },
  })

  // 3. doctors + weekly availability (every weekday of the week is covered)
  const docObi = await prisma.doctor.create({
    data: { userId: uDrObi.id, name: uDrObi.name, specialty: 'Antenatal' },
  })
  const docYusuf = await prisma.doctor.create({
    data: { userId: uDrYusuf.id, name: uDrYusuf.name, specialty: 'Antenatal' },
  })

  const rules = [
    // Dr. Obi — Mon–Fri
    { doctorId: docObi.id, weekday: 1, startTime: '09:00', endTime: '16:00', slotMinutes: 30 },
    { doctorId: docObi.id, weekday: 2, startTime: '09:00', endTime: '16:00', slotMinutes: 30 },
    { doctorId: docObi.id, weekday: 3, startTime: '09:00', endTime: '16:00', slotMinutes: 30 },
    { doctorId: docObi.id, weekday: 4, startTime: '09:00', endTime: '16:00', slotMinutes: 30 },
    { doctorId: docObi.id, weekday: 5, startTime: '10:00', endTime: '15:00', slotMinutes: 45 },
    // Dr. Yusuf — Sun, Tue, Thu, Sat
    { doctorId: docYusuf.id, weekday: 0, startTime: '10:00', endTime: '14:00', slotMinutes: 30 },
    { doctorId: docYusuf.id, weekday: 2, startTime: '09:00', endTime: '15:00', slotMinutes: 30 },
    { doctorId: docYusuf.id, weekday: 4, startTime: '09:00', endTime: '15:00', slotMinutes: 30 },
    { doctorId: docYusuf.id, weekday: 6, startTime: '10:00', endTime: '16:00', slotMinutes: 60 },
  ]
  await prisma.availabilityRule.createMany({ data: rules })

  // one day off for Dr. Yusuf (first Yusuf working day from today + 3)
  let offDate = addDays(today, 3)
  while (![0, 2, 4, 6].includes(weekdayOf(offDate))) offDate = addDays(offDate, 1)
  await prisma.timeOff.create({ data: { doctorId: docYusuf.id, date: offDate } })

  const obi: DoctorRef = { id: docObi.id, userId: docObi.userId, name: docObi.name, email: uDrObi.email }
  const yusuf: DoctorRef = { id: docYusuf.id, userId: docYusuf.userId, name: docYusuf.name, email: uDrYusuf.email }
  const chioma: PatientRef = { id: uChioma.id, name: uChioma.name, email: uChioma.email }
  const fatima: PatientRef = { id: uFatima.id, name: uFatima.name, email: uFatima.email }
  const ngozi: PatientRef = { id: uNgozi.id, name: uNgozi.name, email: uNgozi.email }

  const ruleAt = (doctorId: string, weekday: number) => {
    const r = rules.find((x) => x.doctorId === doctorId && x.weekday === weekday)
    if (!r) throw new Error(`No rule for doctor ${doctorId} on weekday ${weekday}`)
    return r
  }
  const obiWd = (wd: number) => [1, 2, 3, 4, 5].includes(wd)
  const yusufWd = (wd: number) => [0, 2, 4, 6].includes(wd)

  // 4. today's queue — 2 urgent + 3 normal, same doctor, same day.
  // createdAt is staggered so the queue must sort: urgent by createdAt
  // (not by time), normal by time (not by createdAt).
  const todayWd = weekdayOf(today)
  const queueDoc = obiWd(todayWd) ? obi : yusuf
  const queueRule = ruleAt(queueDoc.id, todayWd)
  const q = pickTimes(slotsFor(queueRule), 5) // q[0] < q[1] < ... by construction

  await createAppointment({
    // urgent created first but with a LATER time than the second urgent
    patient: chioma, doctor: queueDoc, date: today, time: q[2], durationMin: queueRule.slotMinutes,
    triageLevel: TriageLevel.URGENT, reason: AppointmentReason.PROBLEM,
    symptoms: ['Bad headache', 'Swollen face or hands'], weeks: 28, createdAt: minutesAgo(240),
  })
  await createAppointment({
    // urgent created second, EARLIER time — still sorted after urgent #1
    patient: ngozi, doctor: queueDoc, date: today, time: q[0], durationMin: queueRule.slotMinutes,
    triageLevel: TriageLevel.URGENT, reason: AppointmentReason.ROUTINE,
    symptoms: ['Blurry eyes'], weeks: 34, createdAt: minutesAgo(210),
  })
  await createAppointment({
    patient: fatima, doctor: queueDoc, date: today, time: q[1], durationMin: queueRule.slotMinutes,
    triageLevel: TriageLevel.NORMAL, reason: AppointmentReason.ROUTINE, weeks: null, createdAt: minutesAgo(120),
  })
  await createAppointment({
    // Normal + "Has a problem" (Q1 never changes the level)
    patient: ngozi, doctor: queueDoc, date: today, time: q[3], durationMin: queueRule.slotMinutes,
    triageLevel: TriageLevel.NORMAL, reason: AppointmentReason.PROBLEM, weeks: 34, createdAt: minutesAgo(180),
  })
  await createAppointment({
    patient: chioma, doctor: queueDoc, date: today, time: q[4], durationMin: queueRule.slotMinutes,
    triageLevel: TriageLevel.NORMAL, reason: AppointmentReason.ROUTINE, weeks: 28, createdAt: minutesAgo(60),
  })

  // 5. history: done, cancelled, and one upcoming booked visit
  const dDone = findDate(addDays(today, -3), obiWd, -1)
  const rDone = ruleAt(obi.id, weekdayOf(dDone))
  await createAppointment({
    patient: fatima, doctor: obi, date: dDone, time: slotsFor(rDone)[1], durationMin: rDone.slotMinutes,
    status: AppointmentStatus.DONE, triageLevel: TriageLevel.NORMAL, reason: AppointmentReason.ROUTINE, weeks: null,
  })

  const dDoneUrgent = findDate(addDays(today, -6), yusufWd, -1)
  const rDoneUrgent = ruleAt(yusuf.id, weekdayOf(dDoneUrgent))
  await createAppointment({
    patient: chioma, doctor: yusuf, date: dDoneUrgent, time: slotsFor(rDoneUrgent)[0], durationMin: rDoneUrgent.slotMinutes,
    status: AppointmentStatus.DONE, triageLevel: TriageLevel.URGENT, reason: AppointmentReason.PROBLEM,
    symptoms: ['Bleeding'], weeks: 27, severe: true,
  })

  const dCancelPast = findDate(addDays(today, -2), obiWd, -1)
  const rCancelPast = ruleAt(obi.id, weekdayOf(dCancelPast))
  await createAppointment({
    patient: ngozi, doctor: obi, date: dCancelPast, time: slotsFor(rCancelPast)[2], durationMin: rCancelPast.slotMinutes,
    status: AppointmentStatus.CANCELLED, triageLevel: TriageLevel.NORMAL, reason: AppointmentReason.ROUTINE, weeks: 33,
    createdAt: minutesAgo(3 * 24 * 60), cancelledAt: minutesAgo(2 * 24 * 60),
  })

  const dCancelFuture = findDate(addDays(today, 3), yusufWd, 1)
  const rCancelFuture = ruleAt(yusuf.id, weekdayOf(dCancelFuture))
  await createAppointment({
    patient: fatima, doctor: yusuf, date: dCancelFuture, time: slotsFor(rCancelFuture)[1], durationMin: rCancelFuture.slotMinutes,
    status: AppointmentStatus.CANCELLED, triageLevel: TriageLevel.NORMAL, reason: AppointmentReason.ROUTINE, weeks: null,
    createdAt: minutesAgo(24 * 60), cancelledAt: minutesAgo(20 * 60),
  })

  const dNext = findDate(addDays(today, 2), obiWd, 1)
  const rNext = ruleAt(obi.id, weekdayOf(dNext))
  await createAppointment({
    patient: chioma, doctor: obi, date: dNext, time: slotsFor(rNext)[3], durationMin: rNext.slotMinutes,
    triageLevel: TriageLevel.NORMAL, reason: AppointmentReason.ROUTINE, weeks: 28,
  })

  // 6. summary (no secrets printed)
  const userCount = await prisma.user.count()
  const ruleCount = await prisma.availabilityRule.count()
  const offCount = await prisma.timeOff.count()
  const statusCounts = await prisma.appointment.groupBy({ by: ['status'], _count: true })
  const notifCount = await prisma.notification.count()
  const emailCount = await prisma.emailOutbox.count()

  const countFor = (s: AppointmentStatus) =>
    statusCounts.find((c) => c.status === s)?._count ?? 0

  console.log('MamaDoc seed complete.')
  console.log(`  users            ${userCount} (2 doctors, 3 patients)`)
  console.log(`  availability     ${ruleCount} rules, ${offCount} day off`)
  console.log(
    `  appointments     ${await prisma.appointment.count()}` +
      ` (BOOKED ${countFor(AppointmentStatus.BOOKED)}, DONE ${countFor(AppointmentStatus.DONE)},` +
      ` CANCELLED ${countFor(AppointmentStatus.CANCELLED)})`,
  )
  console.log(`  notifications    ${notifCount}`)
  console.log(`  simulated emails ${emailCount}`)

  const queueRows = await prisma.appointment.findMany({
    where: { doctorId: queueDoc.id, date: today, status: AppointmentStatus.BOOKED },
    include: { patient: true },
  })
  const ordered = [
    ...queueRows.filter((a) => a.triageLevel === TriageLevel.URGENT)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    ...queueRows.filter((a) => a.triageLevel === TriageLevel.NORMAL)
      .sort((a, b) => a.time.localeCompare(b.time)),
  ]
  console.log('')
  console.log(`Today's queue — ${queueDoc.name} (${today}):`)
  ordered.forEach((a, i) => {
    const flag = a.triageLevel === TriageLevel.URGENT ? 'URGENT ' : 'NORMAL '
    const problem = a.reason === AppointmentReason.PROBLEM ? ' · has a problem' : ''
    console.log(`  ${i + 1}. [${flag}] ${a.time} — ${a.patient.name}${problem}`)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
