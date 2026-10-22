import { CalendarDays, Check, ChevronRight, Home, Mail, Phone, Video } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ProblemTag, TriageTag } from '@/components/pills'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatShortDate } from '@/lib/format'
import { confirmationMessage } from '@/lib/messages'
import { doctorPhoto } from '@/lib/photos'

export const metadata = { title: 'Booked' }

/** Confirmation screen (maternal-care mockup: celebration + summary card). */
export default async function BookDonePage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  const user = await requireRole('PATIENT')

  const appointment = searchParams.id
    ? await prisma.appointment.findUnique({
        where: { id: searchParams.id },
        include: { doctor: true },
      })
    : null
  // Ownership re-checked server-side: only the patient's own visit shows.
  if (!appointment || appointment.patientId !== user.id) redirect('/')

  const number = process.env.EMERGENCY_NUMBER ?? '112'
  const photo = doctorPhoto(appointment.doctor.name)

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-8 text-center">
      {/* Hero celebration */}
      <div className="flex flex-col items-center">
        <div className="relative mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-success-bg shadow-inner">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-green-deep text-white shadow-lg">
            <Check className="h-14 w-14" strokeWidth={3} aria-hidden="true" />
          </span>
          <span
            className="absolute inset-0 animate-ping rounded-full border-4 border-green-deep/30 opacity-30"
            aria-hidden="true"
          />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
          You Are Booked!
        </h1>
        <p className="mt-3 max-w-lg text-lg font-semibold text-muted md:text-xl">
          {confirmationMessage(appointment.triageLevel)}
        </p>
      </div>

      {/* Appointment summary card */}
      <div className="w-full rounded-panel border-2 border-success-bg bg-surface p-6 text-left shadow-dialog">
        <div className="flex items-center gap-5 border-b border-line pb-5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- approved Google-hosted mockup portrait
            <img
              src={photo}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full border-4 border-success object-cover shadow-md"
            />
          ) : (
            <span
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl font-extrabold text-accent"
              aria-hidden="true"
            >
              {appointment.doctor.name
                .replace(/^Dr\.?\s+/i, '')
                .split(/\s+/)
                .slice(0, 2)
                .map((p: string) => p[0]?.toUpperCase() ?? '')
                .join('')}
            </span>
          )}
          <div className="min-w-0">
            <span className="mb-1.5 inline-block rounded-full bg-success-bg px-3 py-1 text-xs font-bold uppercase tracking-wider text-success">
              Your doctor
            </span>
            <span className="block truncate text-2xl font-extrabold text-ink">
              {appointment.doctor.name}
            </span>
            <span className="block truncate text-base font-medium text-muted">
              {appointment.doctor.specialty}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-4 pt-5">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-info-bg text-info"
            aria-hidden="true"
          >
            <CalendarDays className="h-7 w-7" />
          </span>
          <div>
            <span className="block text-sm font-semibold text-muted">Day and time:</span>
            <span className="block text-xl font-bold text-ink">
              {formatShortDate(appointment.date)}
            </span>
            <span className="block text-lg font-bold text-accent">
              at {appointment.time} ({appointment.durationMin} min)
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TriageTag level={appointment.triageLevel} />
          {appointment.reason === 'PROBLEM' && appointment.triageLevel === 'NORMAL' && (
            <ProblemTag />
          )}
        </div>

        {/* Simulated-email reassurance */}
        <div className="mt-5 flex items-center gap-4 rounded-card border border-success-bg bg-success-bg/50 p-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-deep text-white shadow-sm"
            aria-hidden="true"
          >
            <Mail className="h-6 w-6" />
          </span>
          <div className="text-left">
            <span className="block font-bold text-ink">
              A confirmation was sent (simulated)
            </span>
            <span className="text-sm font-medium text-muted">
              See{' '}
              <Link
                href="/notifications?tab=emails"
                className="font-semibold text-accent underline"
              >
                messages sent to my email (demo)
              </Link>
              .
            </span>
          </div>
        </div>

        {/* Meeting-link note */}
        <div className="mt-3 flex items-center gap-4 rounded-card border border-line bg-lav-low p-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm"
            aria-hidden="true"
          >
            <Video className="h-6 w-6" />
          </span>
          <div className="text-left">
            <span className="block font-bold text-ink">
              Your video link comes before the visit
            </span>
            <span className="text-sm font-medium text-muted">
              The doctor adds a meeting link; it shows on your home page.
            </span>
          </div>
        </div>
      </div>

      {/* Single clear action */}
      <Link
        href="/"
        className="flex min-h-[76px] w-full items-center justify-center gap-3 rounded-card bg-accent px-8 text-xl font-extrabold text-white shadow-lift transition hover:bg-accent-deep"
      >
        <Home className="h-7 w-7" aria-hidden="true" />
        Go to My Home
      </Link>

      {/* Emergency help card */}
      <a
        href={`tel:${number}`}
        className="group flex w-full items-center justify-between rounded-card border-2 border-accent-soft bg-rose-bg p-5 text-left transition-colors hover:bg-accent-soft/60"
      >
        <div className="flex items-center gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white"
            aria-hidden="true"
          >
            <Phone className="h-5 w-5" />
          </span>
          <div>
            <span className="block text-lg font-bold text-accent-deep">Need help?</span>
            <span className="block text-base font-medium text-muted">
              Tap here to call {number} (emergency line).
            </span>
          </div>
        </div>
        <ChevronRight
          className="h-7 w-7 shrink-0 text-accent transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </a>
    </div>
  )
}
