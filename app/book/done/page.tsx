import { CheckCircle2, Home, Mail, Video } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TriageTag } from '@/components/pills'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatShortDate } from '@/lib/format'
import { confirmationMessage } from '@/lib/messages'

export const metadata = { title: 'Booked' }

/** S-B-DONE: green tick, summary, "A confirmation was sent", Home. */
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

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
          <CheckCircle2 className="h-9 w-9 text-success" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold leading-8 text-ink">Booked</h1>
        <p className="text-muted">{confirmationMessage(appointment.triageLevel)}</p>
      </div>

      <div className="w-full rounded-card border border-line bg-surface p-5 text-left shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <TriageTag level={appointment.triageLevel} />
          {appointment.reason === 'PROBLEM' && appointment.triageLevel === 'NORMAL' && (
            <span className="inline-flex items-center rounded-full bg-warning-bg px-2.5 py-0.5 text-sm font-medium text-warning">
              Has a problem
            </span>
          )}
        </div>
        <p className="mt-3 text-lg font-semibold leading-7 text-ink">
          {appointment.doctor.name}
        </p>
        <p className="text-muted">{appointment.doctor.specialty}</p>
        <p className="mt-2 text-ink">
          {formatShortDate(appointment.date)} at {appointment.time}
        </p>
      </div>

      <p className="flex items-start gap-2 text-sm text-muted">
        <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          A confirmation was sent (simulated — see{' '}
          <Link href="/notifications?tab=emails" className="font-medium text-accent underline">
            Messages sent to my email (demo)
          </Link>
          ).
        </span>
      </p>

      <p className="flex items-start gap-2 text-sm text-muted">
        <Video className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>The doctor adds a meeting link before the visit; it shows up on your home page.</span>
      </p>

      <Link
        href="/"
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-base font-semibold text-white transition hover:opacity-90 sm:w-auto"
      >
        <Home className="h-5 w-5" aria-hidden="true" />
        Home
      </Link>
    </div>
  )
}
