import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Stethoscope,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ConfirmForm } from '@/components/book/ConfirmForm'
import { StepBar } from '@/components/book/StepBar'
import { SafetyNotice } from '@/components/SafetyNotice'
import { requireRole } from '@/lib/auth'
import { BOOKING_DAYS, LEAD_MINUTES } from '@/lib/config'
import { prisma } from '@/lib/db'
import { formatDayMonth, formatShortDate, weekdayShort } from '@/lib/format'
import type { SlotRule } from '@/lib/slots'
import type { LocalNow } from '@/lib/urgentWindow'
import {
  buildDayGrid,
  sanitizeWizardParams,
  summarizeDays,
  wizardStep,
} from '@/lib/wizard'

export const metadata = { title: 'Book a visit' }

/** Everything the steps need, loaded once per request. */
type WizardData = {
  rules: SlotRule[]
  timeOffDates: (doctorId: string) => string[] // only that doctor's days off
  bookedKeys: string[] // "doctorId|date|time" for every BOOKED visit ahead
  bookedTimes: (doctorId: string, date: string) => string[]
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: { doctor?: string; date?: string; time?: string; q?: string }
}) {
  await requireRole('PATIENT')
  const params = sanitizeWizardParams(searchParams)
  const step = wizardStep(params)
  const now = appNow()

  const doctors = await prisma.doctor.findMany({ orderBy: { name: 'asc' } })
  const doctor = params.doctorId
    ? (doctors.find((d) => d.id === params.doctorId) ?? null)
    : null
  // A stale doctor id in the URL falls back a step instead of crashing.
  const effectiveStep: 1 | 2 | 3 | 4 = !doctor ? 1 : step

  const data = await loadWizardData(
    doctors.map((d) => d.id),
    now,
  )

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-ink">Book a visit</h1>
        <p className="mt-1 text-muted">
          Pick a doctor, a day and a time. Nothing is booked until you confirm.
        </p>
      </div>

      <StepBar step={effectiveStep} />

      {effectiveStep === 1 && (
        <StepDoctor doctors={doctors} data={data} now={now} q={params.q} />
      )}
      {effectiveStep === 2 && doctor && (
        <StepDay doctorId={doctor.id} doctorName={doctor.name} data={data} now={now} />
      )}
      {effectiveStep === 3 && doctor && params.date && (
        <StepTime
          doctorId={doctor.id}
          doctorName={doctor.name}
          date={params.date}
          data={data}
          now={now}
        />
      )}
      {effectiveStep === 4 && doctor && params.date && params.time && (
        <StepConfirm
          doctorId={doctor.id}
          doctorName={doctor.name}
          date={params.date}
          time={params.time}
          data={data}
          now={now}
        />
      )}
    </div>
  )
}

// ---------- step 1: choose a doctor ----------

function StepDoctor({
  doctors,
  data,
  now,
  q,
}: {
  doctors: { id: string; name: string; specialty: string }[]
  data: WizardData
  now: LocalNow
  q: string | null
}) {
  const query = (q ?? '').toLowerCase()
  const filtered = doctors.filter(
    (d) =>
      !query ||
      d.name.toLowerCase().includes(query) ||
      d.specialty.toLowerCase().includes(query),
  )

  return (
    <section className="flex flex-col gap-4" aria-labelledby="choose-doctor">
      <h2 id="choose-doctor" className="text-xl font-semibold leading-7 text-ink">
        Choose a doctor
      </h2>

      <form method="get" action="/book" className="relative">
        <label htmlFor="doctor-search" className="sr-only">
          Search doctors by name
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id="doctor-search"
          type="search"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by name"
          className="block min-h-[48px] w-full rounded-input border border-line bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </form>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
          <Stethoscope className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-2 font-medium text-ink">No doctor matches that search.</p>
          <p className="mt-1 text-sm text-muted">Try a shorter search.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((d) => (
            <li key={d.id}>
              <Link
                href={`/book?doctor=${d.id}`}
                className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition hover:bg-bg"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-base font-bold text-accent"
                  aria-hidden="true"
                >
                  {initials(d.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{d.name}</span>
                  <span className="block text-sm text-muted">{d.specialty}</span>
                  <NextFreeNote doctorId={d.id} data={data} now={now} />
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NextFreeNote({
  doctorId,
  data,
  now,
}: {
  doctorId: string
  data: WizardData
  now: LocalNow
}) {
  const days = summarizeDays({
    rules: data.rules,
    doctorId,
    now,
    timeOffDates: data.timeOffDates(doctorId),
    bookedKeys: data.bookedKeys,
    days: BOOKING_DAYS,
    leadMinutes: LEAD_MINUTES,
  })
  const next = days.find((s) => s.freeCount > 0)
  return (
    <span className="mt-1 block text-sm font-medium text-accent">
      {next
        ? `Next free: ${formatShortDate(next.date)}`
        : 'No free times in the next 14 days'}
    </span>
  )
}

// ---------- step 2: choose a day ----------

function StepDay({
  doctorId,
  doctorName,
  data,
  now,
}: {
  doctorId: string
  doctorName: string
  data: WizardData
  now: LocalNow
}) {
  const days = summarizeDays({
    rules: data.rules,
    doctorId,
    now,
    timeOffDates: data.timeOffDates(doctorId),
    bookedKeys: data.bookedKeys,
    days: BOOKING_DAYS,
    leadMinutes: LEAD_MINUTES,
  })

  return (
    <section className="flex flex-col gap-4" aria-labelledby="choose-day">
      <div>
        <h2 id="choose-day" className="text-xl font-semibold leading-7 text-ink">
          Choose a day
        </h2>
        <p className="mt-1 text-muted">With {doctorName}, the next 14 days.</p>
      </div>

      {days.every((d) => d.freeCount === 0) ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
          <CalendarDays className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-2 font-medium text-ink">No free times in the next 14 days.</p>
          <p className="mt-1 text-sm text-muted">Try another doctor.</p>
          <Link
            href="/book"
            className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-bg"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to doctors
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {days.map((day) => {
              const free = day.freeCount > 0
              const label = (
                <>
                  <span className="block text-sm font-medium text-ink">
                    {weekdayShort(day.date)}
                  </span>
                  <span className="block text-base font-semibold tabular-nums text-ink">
                    {formatDayMonth(day.date)}
                  </span>
                  <span
                    className={`block text-xs ${free ? 'text-muted' : 'font-medium text-warning'}`}
                  >
                    {free ? `${day.freeCount} free` : 'No times'}
                  </span>
                </>
              )
              return (
                <li key={day.date}>
                  {free ? (
                    <Link
                      href={`/book?doctor=${doctorId}&date=${day.date}`}
                      className="flex min-h-[88px] flex-col items-center justify-center rounded-card border border-line bg-surface px-2 py-3 text-center shadow-card transition hover:bg-bg"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="flex min-h-[88px] flex-col items-center justify-center rounded-card border border-line bg-bg px-2 py-3 text-center opacity-60"
                    >
                      {label}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <Link
            href="/book"
            className="inline-flex min-h-[48px] items-center gap-2 self-start text-sm font-medium text-accent"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to doctors
          </Link>
        </>
      )}
    </section>
  )
}

// ---------- step 3: choose a time ----------

function StepTime({
  doctorId,
  doctorName,
  date,
  data,
  now,
}: {
  doctorId: string
  doctorName: string
  date: string
  data: WizardData
  now: LocalNow
}) {
  const isDayOff = data.timeOffDates(doctorId).includes(date)
  const grid = buildDayGrid({
    rules: data.rules,
    doctorId,
    date,
    now,
    bookedTimes: data.bookedTimes(doctorId, date),
    leadMinutes: LEAD_MINUTES,
    timeOffDates: data.timeOffDates(doctorId),
  })

  return (
    <section className="flex flex-col gap-4" aria-labelledby="choose-time">
      <div>
        <h2 id="choose-time" className="text-xl font-semibold leading-7 text-ink">
          Choose a time
        </h2>
        <p className="mt-1 text-muted">
          {doctorName} · {formatShortDate(date)}
        </p>
      </div>

      {grid.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
          <Clock3 className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-2 font-medium text-ink">
            {isDayOff ? 'That day is a day off.' : 'No times on that day.'}
          </p>
          <p className="mt-1 text-sm text-muted">Pick another day.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {grid.map((slot) => (
            <li key={slot.time}>
              {slot.taken ? (
                <span
                  aria-disabled="true"
                  className="flex min-h-[48px] w-full flex-col items-center justify-center rounded-input border border-line bg-bg px-2 text-center opacity-60"
                >
                  <span className="text-sm font-medium tabular-nums text-muted">
                    {slot.time}
                  </span>
                  <span className="text-xs text-muted">Taken</span>
                </span>
              ) : (
                <Link
                  href={`/book?doctor=${doctorId}&date=${date}&time=${slot.time}`}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-input border border-line bg-surface text-sm font-semibold tabular-nums text-ink shadow-card transition hover:bg-bg"
                >
                  {slot.time}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`/book?doctor=${doctorId}`}
        className="inline-flex min-h-[48px] items-center gap-2 self-start text-sm font-medium text-accent"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to days
      </Link>
    </section>
  )
}

// ---------- step 4: check and confirm ----------

function StepConfirm({
  doctorId,
  doctorName,
  date,
  time,
  data,
  now,
}: {
  doctorId: string
  doctorName: string
  date: string
  time: string
  data: WizardData
  now: LocalNow
}) {
  const grid = buildDayGrid({
    rules: data.rules,
    doctorId,
    date,
    now,
    bookedTimes: data.bookedTimes(doctorId, date),
    leadMinutes: LEAD_MINUTES,
    timeOffDates: data.timeOffDates(doctorId),
  })
  const slot = grid.find((s) => s.time === time)

  // A stale or just-taken time in the URL falls back a step (the booking
  // action re-checks again at submit time).
  if (!slot || slot.taken) redirect(`/book?doctor=${doctorId}&date=${date}`)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="confirm-visit">
      <h2 id="confirm-visit" className="text-xl font-semibold leading-7 text-ink">
        Check and confirm
      </h2>

      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <dl className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted">Doctor</dt>
              <dd className="font-medium text-ink">{doctorName}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted">Day</dt>
              <dd className="font-medium text-ink">{formatShortDate(date)}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <dt className="text-sm text-muted">Time</dt>
              <dd className="font-medium tabular-nums text-ink">{time}</dd>
            </div>
          </div>
        </dl>
      </div>

      <ConfirmForm doctorId={doctorId} date={date} time={time} notice={<SafetyNotice />} />

      <Link
        href={`/book?doctor=${doctorId}&date=${date}`}
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-bg"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Go back
      </Link>
    </section>
  )
}

// ---------- data loading ----------

/** Load rules, days off and booked slots once for the whole request. */
async function loadWizardData(
  doctorIds: string[],
  now: LocalNow,
): Promise<WizardData> {
  if (doctorIds.length === 0) {
    return {
      rules: [],
      timeOffDates: () => [],
      bookedKeys: [],
      bookedTimes: () => [],
    }
  }
  const [rules, offs, booked] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { doctorId: { in: doctorIds } } }),
    prisma.timeOff.findMany({ where: { doctorId: { in: doctorIds } } }),
    prisma.appointment.findMany({
      where: {
        doctorId: { in: doctorIds },
        status: 'BOOKED',
        date: { gte: now.date },
      },
      select: { doctorId: true, date: true, time: true },
    }),
  ])

  const byDoctorDay = new Map<string, string[]>()
  const offByDoctor = new Map<string, string[]>()
  for (const o of offs) {
    const list = offByDoctor.get(o.doctorId) ?? []
    list.push(o.date)
    offByDoctor.set(o.doctorId, list)
  }
  const bookedKeys: string[] = []
  for (const a of booked) {
    bookedKeys.push(`${a.doctorId}|${a.date}|${a.time}`)
    const key = `${a.doctorId}|${a.date}`
    const list = byDoctorDay.get(key) ?? []
    list.push(a.time)
    byDoctorDay.set(key, list)
  }

  return {
    rules,
    timeOffDates: (doctorId) => offByDoctor.get(doctorId) ?? [],
    bookedKeys,
    bookedTimes: (doctorId, date) => byDoctorDay.get(`${doctorId}|${date}`) ?? [],
  }
}

/** The current moment in APP_TZ — never the server's clock zone. */
function appNow(): LocalNow {
  const timeZone = process.env.APP_TZ || 'Africa/Lagos'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  }
}

function initials(name: string): string {
  return name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
