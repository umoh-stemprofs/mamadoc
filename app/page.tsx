import { CalendarPlus, CheckCircle2, ChevronRight, Video } from 'lucide-react'
import Link from 'next/link'
import { StatusPill, TriageTag } from '@/components/pills'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatShortDate } from '@/lib/format'

export const metadata = { title: 'Home' }

export default async function PatientHome() {
  const user = await requireRole('PATIENT')

  const timeZone = process.env.APP_TZ || 'Africa/Lagos'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())

  const [next, notifications] = await Promise.all([
    prisma.appointment.findFirst({
      where: { patientId: user.id, status: 'BOOKED', date: { gte: today } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: { doctor: true },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold leading-8 text-ink">
          Hello, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-muted">Here is your next visit and your latest updates.</p>
      </section>

      <section aria-labelledby="next-visit" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="next-visit" className="text-xl font-semibold leading-7 text-ink">
            Next appointment
          </h2>
          <Link
            href="/book"
            className="flex min-h-[48px] items-center gap-2 rounded-lg bg-accent px-5 text-base font-semibold text-white transition hover:opacity-90"
          >
            <CalendarPlus className="h-5 w-5" aria-hidden="true" />
            Book a visit
          </Link>
        </div>

        {next ? (
          <article className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={next.status} />
              <TriageTag level={next.triageLevel} />
              {next.reason === 'PROBLEM' && next.triageLevel === 'NORMAL' && (
                <span className="inline-flex items-center rounded-full bg-warning-bg px-2.5 py-0.5 text-sm font-medium text-warning">
                  Has a problem
                </span>
              )}
            </div>
            <p className="mt-3 text-lg font-semibold leading-7 text-ink">{next.doctor.name}</p>
            <p className="text-muted">{next.doctor.specialty}</p>
            <p className="mt-2 text-ink">
              {formatShortDate(next.date)} at {next.time}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {next.meetingUrl && (
                <a
                  href={next.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[48px] items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-bg"
                >
                  <Video className="h-4 w-4" aria-hidden="true" />
                  Join call
                </a>
              )}
            </div>
          </article>
        ) : (
          <article className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
            <CheckCircle2 className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
            <p className="mt-2 font-medium text-ink">No visit booked yet.</p>
            <p className="mt-1 text-sm text-muted">
              When you book a visit it will show up here.
            </p>
          </article>
        )}
      </section>

      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-xl font-semibold leading-7 text-ink">
            Recent notifications
          </h2>
          <Link
            href="/notifications"
            className="flex min-h-[48px] items-center gap-1 text-sm font-medium text-accent"
          >
            View all
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {notifications.length === 0 ? (
          <p className="rounded-card border border-line bg-surface p-5 text-muted shadow-card">
            No notifications yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface shadow-card">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 p-4">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-line' : 'bg-accent'}`}
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-ink">{n.title}</p>
                  <p className="text-sm text-muted">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
