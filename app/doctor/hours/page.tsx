import { ArrowLeft, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { HoursGrid } from '@/components/hours/HoursGrid'
import { TimeOffList } from '@/components/hours/TimeOffList'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { WEEKDAY_ORDER, type HoursEntry } from '@/lib/hoursShared'

export const metadata = { title: 'My hours' }

/** S-D-AVAIL: weekly grid + days off. Doctor only; ownership re-checked. */
export default async function MyHoursPage() {
  const user = await requireRole('DOCTOR')

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    include: {
      availabilityRules: { orderBy: { weekday: 'asc' } },
      timeOffs: { orderBy: { date: 'asc' } },
    },
  })
  if (!doctor) {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <p className="font-medium text-ink">Your doctor profile is missing.</p>
        <p className="mt-1 text-sm text-muted">Ask the clinic admin to re-seed the demo data.</p>
      </div>
    )
  }

  // The grid shows every weekday; days without a rule start switched off.
  const byWeekday = new Map(doctor.availabilityRules.map((r) => [r.weekday, r]))
  const entries: HoursEntry[] = WEEKDAY_ORDER.map((weekday) => {
    const rule = byWeekday.get(weekday)
    return rule
      ? {
          weekday,
          enabled: true,
          startTime: rule.startTime,
          endTime: rule.endTime,
          slotMinutes: rule.slotMinutes,
        }
      : { weekday, enabled: false, startTime: '09:00', endTime: '17:00', slotMinutes: 30 }
  })

  const daysOff = doctor.timeOffs.map((t) => ({
    id: t.id,
    date: t.date,
    reason: t.reason,
  }))

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-ink">My hours</h1>
        <p className="mt-1 text-muted">
          Patients see free times from these hours. Times are in your clinic&apos;s
          time zone (Africa/Lagos).
        </p>
      </div>

      <section aria-labelledby="weekdays" className="flex flex-col gap-4">
        <h2 id="weekdays" className="text-xl font-semibold leading-7 text-ink">
          Every week
        </h2>
        <HoursGrid initial={entries} />
      </section>

      <section aria-labelledby="days-off" className="flex flex-col gap-4">
        <h2 id="days-off" className="text-xl font-semibold leading-7 text-ink">
          Days off
        </h2>
        <p className="text-sm text-muted">
          A day off removes every time on that date from the booking wizard.
        </p>
        <TimeOffList initial={daysOff} />
      </section>

      <Link
        href="/doctor"
        className="inline-flex min-h-[48px] items-center gap-2 self-start text-sm font-medium text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to doctor home
      </Link>
    </div>
  )
}
