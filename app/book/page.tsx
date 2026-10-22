import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  Repeat2,
  Search,
  Stethoscope,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ConfirmForm } from '@/components/book/ConfirmForm'
import { SafetyNotice } from '@/components/SafetyNotice'
import { requireRole } from '@/lib/auth'
import { BOOKING_DAYS, LEAD_MINUTES } from '@/lib/config'
import { prisma } from '@/lib/db'
import { formatDayMonth, formatShortDate, weekdayShort } from '@/lib/format'
import { doctorPhoto } from '@/lib/photos'
import { weekdayOf, type SlotRule } from '@/lib/slots'
import type { LocalNow } from '@/lib/urgentWindow'
import { addCalendarDays } from '@/lib/urgentWindow'
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
  const effectiveStep: 1 | 2 | 3 = !doctor ? 1 : step

  const data = await loadWizardData(
    doctors.map((d) => d.id),
    now,
  )

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      {effectiveStep === 1 && (
        <StepDoctor doctors={doctors} data={data} now={now} q={params.q} />
      )}
      {effectiveStep === 2 && doctor && (
        <StepDayTime
          doctorId={doctor.id}
          doctorName={doctor.name}
          selectedDate={params.date}
          selectedTime={params.time}
          data={data}
          now={now}
        />
      )}
      {effectiveStep === 3 && doctor && params.date && params.time && (
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
    <>
      <section className="rounded-panel bg-accent p-6 text-center text-white shadow-dialog md:p-8">
        <span className="inline-flex items-center rounded-full bg-white px-4 py-1 text-sm font-extrabold text-accent">
          Step 1 of 3
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
          Pick Your Doctor
        </h1>
        <p className="mt-2 text-lg font-semibold opacity-95">
          Tap the doctor you want to see.
        </p>
      </section>

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
          className="block min-h-[56px] w-full rounded-input border-[1.5px] border-[#d1d5db] bg-surface py-3 pl-11 pr-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </form>

      {filtered.length === 0 ? (
        <div className="rounded-card border-2 border-lav bg-surface p-8 text-center shadow-card">
          <Stethoscope className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-2 text-lg font-bold text-ink">No doctor matches that search.</p>
          <p className="mt-1 text-muted">Try a shorter search.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {filtered.map((d) => {
            const photo = doctorPhoto(d.name)
            return (
              <li key={d.id}>
                <Link
                  href={`/book?doctor=${d.id}`}
                  className="group block rounded-card border-2 border-lav bg-surface p-5 shadow-card transition hover:shadow-dialog md:p-6"
                >
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- approved Google-hosted mockup portrait
                      <img
                        src={photo}
                        alt={`Portrait of ${d.name}`}
                        className="h-28 w-28 shrink-0 rounded-card object-cover shadow-md ring-4 ring-accent-soft"
                      />
                    ) : (
                      <span
                        className="flex h-28 w-28 shrink-0 items-center justify-center rounded-card bg-accent/10 text-3xl font-extrabold text-accent"
                        aria-hidden="true"
                      >
                        {initials(d.name)}
                      </span>
                    )}
                    <div className="flex-1 text-center sm:text-left">
                      <h2 className="text-2xl font-extrabold text-ink">{d.name}</h2>
                      <p className="text-lg font-bold text-accent">{d.specialty}</p>
                      <NextFreeNote doctorId={d.id} data={data} now={now} />
                    </div>
                  </div>
                  <span className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-lav-high text-lg font-extrabold text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    Pick {d.name}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
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
    <span
      className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${
        next ? 'bg-[#006e2d] text-white' : 'bg-warning-bg text-warning'
      }`}
    >
      {next && (
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
      )}
      {next
        ? `Next free: ${formatShortDate(next.date)}`
        : 'No free times in the next 14 days'}
    </span>
  )
}

// ---------- step 2: pick day and time ----------

function StepDayTime({
  doctorId,
  doctorName,
  selectedDate,
  selectedTime,
  data,
  now,
}: {
  doctorId: string
  doctorName: string
  selectedDate: string | null
  selectedTime: string | null
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
  const isDayOff = selectedDate
    ? data.timeOffDates(doctorId).includes(selectedDate)
    : false
  const grid = selectedDate
    ? buildDayGrid({
        rules: data.rules,
        doctorId,
        date: selectedDate,
        now,
        bookedTimes: data.bookedTimes(doctorId, selectedDate),
        leadMinutes: LEAD_MINUTES,
        timeOffDates: data.timeOffDates(doctorId),
      })
    : []
  const ready = Boolean(selectedDate && selectedTime)
  const photo = doctorPhoto(doctorName)
  const tomorrow = addCalendarDays(now.date, 1)

  return (
    <>
      {/* Selected doctor recap strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border-2 border-lav bg-surface p-4 shadow-card">
        <div className="flex items-center gap-4">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- approved Google-hosted mockup portrait
            <img
              src={photo}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-accent/20"
            />
          ) : (
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg font-extrabold text-accent"
              aria-hidden="true"
            >
              {initials(doctorName)}
            </span>
          )}
          <div>
            <span className="block text-xl font-extrabold text-ink">{doctorName}</span>
            <p className="text-sm font-medium text-muted">Your doctor for this visit</p>
          </div>
        </div>
        <Link
          href="/book"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-lg px-3 text-base font-bold text-accent hover:underline"
        >
          <Repeat2 className="h-5 w-5" aria-hidden="true" />
          Change Doctor
        </Link>
      </div>

      {/* Step banner */}
      <section className="rounded-card border-2 border-lav bg-surface p-5 shadow-card">
        <span className="inline-flex items-center rounded-full bg-accent px-4 py-1 text-sm font-bold text-white">
          Step 2 of 3
        </span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
          Pick Day and Time
        </h1>
      </section>

      {/* 1. Pick Day */}
      <section className="rounded-panel border-2 border-lav bg-surface p-5 shadow-card md:p-6">
        <h2 className="text-2xl font-extrabold text-ink">1. Pick Day</h2>
        <p className="text-lg text-muted">Tap the day you want:</p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((day) => {
            const free = day.freeCount > 0
            const selected = selectedDate === day.date
            const tag =
              day.date === now.date
                ? 'Today'
                : day.date === tomorrow
                  ? 'Tomorrow'
                  : weekdayShort(day.date)
            const body = (
              <>
                <span className="flex w-full items-center justify-between gap-1">
                  <span className="truncate text-xs font-black uppercase tracking-wide">
                    {tag}
                  </span>
                  {selected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border-2 border-current opacity-40"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="mt-1 block text-lg font-extrabold">
                  {formatDayMonth(day.date)}
                </span>
                <span className="block text-xs font-semibold">
                  {free ? `${day.freeCount} free` : 'No times'}
                </span>
              </>
            )
            const skin = selected
              ? 'border-4 border-accent bg-accent text-white shadow-lg'
              : free
                ? 'border-2 border-lav-high bg-lav-low text-ink hover:border-accent/60'
                : 'border-2 border-line bg-lav-low text-muted opacity-60'
            return (
              <li key={day.date}>
                {free ? (
                  <Link
                    href={`/book?doctor=${doctorId}&date=${day.date}`}
                    className={`flex min-h-[110px] flex-col justify-between rounded-xl p-3 transition-all ${skin}`}
                  >
                    {body}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className={`flex min-h-[110px] flex-col justify-between rounded-xl p-3 ${skin}`}
                  >
                    {body}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {/* 2. Pick Time */}
      <section className="rounded-panel border-2 border-lav bg-surface p-5 shadow-card md:p-6">
        <h2 className="text-2xl font-extrabold text-ink">2. Pick Time</h2>
        <p className="text-lg text-muted">Tap the time you want:</p>
        {!selectedDate ? (
          <p className="mt-4 rounded-xl bg-lav-low p-4 text-lg font-semibold text-muted">
            Tap a day above first.
          </p>
        ) : grid.length === 0 ? (
          <p className="mt-4 rounded-xl bg-lav-low p-4 text-lg font-semibold text-muted">
            {isDayOff
              ? 'That day is a day off. Pick another day.'
              : 'No times on that day. Pick another day.'}
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {grid.map((slot) => {
              const selected = selectedTime === slot.time
              if (slot.taken) {
                return (
                  <li key={slot.time}>
                    <span
                      aria-disabled="true"
                      className="flex min-h-[88px] w-full flex-col items-center justify-center rounded-xl border-2 border-line bg-lav-low text-center opacity-60"
                    >
                      <span className="text-xl font-extrabold tabular-nums">{slot.time}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        Taken
                      </span>
                    </span>
                  </li>
                )
              }
              const skin = selected
                ? 'border-4 border-accent bg-accent text-white shadow-lg'
                : 'border-2 border-lav-high bg-lav-low text-ink hover:border-accent/60'
              return (
                <li key={slot.time}>
                  <Link
                    href={`/book?doctor=${doctorId}&date=${selectedDate}&time=${slot.time}`}
                    className={`flex min-h-[88px] w-full flex-col items-center justify-center gap-1 rounded-xl text-center transition-all ${skin}`}
                  >
                    <span className="flex items-center gap-1 text-xl font-extrabold tabular-nums">
                      {slot.time}
                      {selected && <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                    </span>
                    {selected && (
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        Selected
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Bottom navigation */}
      <div className="sticky bottom-4 z-20 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/book"
          className="inline-flex min-h-[64px] w-full items-center justify-center gap-2 rounded-card border-2 border-line bg-surface px-6 text-lg font-extrabold text-ink shadow-card transition hover:bg-lav-high sm:w-auto"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          Go Back
        </Link>
        {ready ? (
          <Link
            href={`/book?doctor=${doctorId}&date=${selectedDate}&time=${selectedTime}`}
            className="inline-flex min-h-[64px] w-full items-center justify-center gap-2 rounded-card bg-accent px-8 text-lg font-extrabold text-white shadow-lift transition hover:bg-accent-deep sm:w-auto"
          >
            Continue to Next Step
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex min-h-[64px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-card bg-lav-high px-8 text-lg font-extrabold text-muted opacity-70 sm:w-auto"
          >
            Continue to Next Step
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
      </div>
    </>
  )
}

// ---------- step 3: check and confirm ----------

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

  const duration =
    data.rules.find((r) => r.doctorId === doctorId && r.weekday === weekdayOf(date))
      ?.slotMinutes ?? 30
  const photo = doctorPhoto(doctorName)

  return (
    <>
      <section className="text-center">
        <span className="inline-flex items-center rounded-full bg-accent-soft px-4 py-1 text-sm font-bold text-accent">
          Step 3 of 3
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
          Why are you seeing the doctor?
        </h1>
        <p className="mt-2 text-lg text-muted">Tap one big box below:</p>
      </section>

      {/* Summary card */}
      <div className="rounded-card border-2 border-lav-high bg-surface p-5 shadow-card md:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- approved Google-hosted mockup portrait
            <img
              src={photo}
              alt=""
              className="h-24 w-24 shrink-0 rounded-full object-cover shadow-md ring-4 ring-accent-soft"
            />
          ) : (
            <span
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-accent/10 text-2xl font-extrabold text-accent"
              aria-hidden="true"
            >
              {initials(doctorName)}
            </span>
          )}
          <div className="flex-1 text-center sm:text-left">
            <div className="text-2xl font-extrabold text-ink">{doctorName}</div>
            <div className="mt-1 flex items-center justify-center gap-2 text-lg font-bold text-accent sm:justify-start">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
              <span>
                {formatShortDate(date)} at {time}
              </span>
            </div>
            <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-success-bg px-4 py-1 text-sm font-extrabold text-success">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Visit length: {duration} min
            </span>
          </div>
        </div>
      </div>

      <ConfirmForm
        doctorId={doctorId}
        date={date}
        time={time}
        notice={<SafetyNotice />}
        back={
          <Link
            href={`/book?doctor=${doctorId}&date=${date}`}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 text-lg font-bold text-muted transition-colors hover:text-accent"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            &lt; Change Day or Doctor
          </Link>
        }
      />
    </>
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
