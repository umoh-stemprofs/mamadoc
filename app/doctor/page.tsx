import { ArrowLeft, CalendarClock, Check, Inbox, User } from 'lucide-react'
import Link from 'next/link'
import { markVisitDoneAction } from '@/app/lib/actions'
import { ProblemTag, TriageTag } from '@/components/pills'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatShortDate, weekdayShort } from '@/lib/format'
import { buildQueue } from '@/lib/queue'
import { addCalendarDays } from '@/lib/urgentWindow'

export const metadata = { title: 'Doctor home' }

export default async function DoctorHome() {
  const user = await requireRole('DOCTOR')
  const timeZone = process.env.APP_TZ || 'Africa/Lagos'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } })
  if (!doctor) {
    return (
      <div className="rounded-card border-2 border-lav bg-surface p-8 text-center shadow-card">
        <p className="font-medium text-ink">Your doctor profile is missing.</p>
        <p className="mt-1 text-sm text-muted">Ask the clinic admin to re-seed the demo data.</p>
      </div>
    )
  }

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: doctor.id, date: today },
    include: { patient: true },
  })
  // Queue computed on read — never stored (13-mamadoc.md).
  const queue = buildQueue(appointments, doctor.id, today)

  const weekDates = Array.from({ length: 7 }, (_, i) => addCalendarDays(today, i))
  const weekCounts = await prisma.appointment.groupBy({
    by: ['date'],
    where: { doctorId: doctor.id, status: 'BOOKED', date: { in: weekDates } },
    _count: { _all: true },
  })
  const countFor = (date: string) =>
    weekCounts.find((c) => c.date === date)?._count._all ?? 0

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Today&apos;s patients</h1>
          <p className="mt-1 text-muted">{formatShortDate(today)} · urgent patients come first.</p>
        </div>
        <Link
          href="/doctor/hours"
          className="flex min-h-[48px] items-center gap-2 rounded-lg border-2 border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-lav-high"
        >
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          My hours
        </Link>
      </section>

      <section aria-labelledby="week" className="flex flex-col gap-3">
        <h2 id="week" className="text-2xl font-extrabold text-ink">
          This week
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {weekDates.map((date, i) => (
            <li
              key={date}
              className="rounded-card border-2 border-lav bg-surface p-4 shadow-card"
            >
              <p className="text-sm text-muted">
                {i === 0 ? 'Today' : weekdayShort(date)}{' '}
                <span className="tabular-nums">{formatShortDate(date).slice(4)}</span>
              </p>
              <p className="mt-1 text-4xl font-bold leading-10 tabular-nums text-ink">
                {countFor(date)}
              </p>
              <p className="text-sm text-muted">booked</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="queue" className="flex flex-col gap-3">
        <h2 id="queue" className="text-2xl font-extrabold text-ink">
          The queue
        </h2>

        {queue.length === 0 ? (
          <div className="rounded-card border-2 border-lav bg-surface p-8 text-center shadow-card">
            <Inbox className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
            <p className="mt-2 font-medium text-ink">No patients booked today.</p>
            <p className="mt-1 text-sm text-muted">
              New bookings appear here the moment they are made.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {queue.map((item) => {
              const appointment = appointments.find((a) => a.id === item.id)
              const patientName = appointment?.patient.name ?? 'Unknown patient'
              const urgent = item.triageLevel === 'URGENT'
              return (
                <li
                  key={item.id}
                  className={`flex flex-col gap-3 rounded-card border-2 border-lav bg-surface p-4 shadow-card sm:flex-row sm:items-center ${
                    urgent ? 'border-l-4 border-l-danger' : 'border-l-4 border-l-line'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-base font-bold tabular-nums text-ink"
                      aria-hidden="true"
                    >
                      {item.position}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <TriageTag level={item.triageLevel} />
                        {item.hasProblem && <ProblemTag />}
                        <span className="text-sm font-medium tabular-nums text-muted">
                          {item.time}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-medium text-ink">{patientName}</p>
                      {urgent && item.symptoms.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {item.symptoms.map((symptom) => (
                            <li
                              key={symptom}
                              className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger"
                            >
                              {symptom}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/doctor/visit/${item.id}`}
                      className="flex min-h-[48px] items-center gap-2 rounded-lg border-2 border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-lav-high"
                    >
                      <User className="h-4 w-4" aria-hidden="true" />
                      Open
                    </Link>
                    <form action={markVisitDoneAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-deep"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Done
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <p className="text-sm text-muted">
        <ArrowLeft className="mr-1 inline h-4 w-4" aria-hidden="true" />
        This queue only ever shows your own appointments.
      </p>
    </div>
  )
}
