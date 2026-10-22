import { ArrowLeft, Check, CheckCircle2, Phone, User } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { markVisitDoneAction } from '@/app/lib/actions'
import { MeetingLinkForm } from '@/components/MeetingLinkForm'
import { ProblemTag, StatusPill, TriageTag } from '@/components/pills'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatShortDate } from '@/lib/format'

export const metadata = { title: 'Visit' }

function parseSymptoms(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

export default async function VisitPage({ params }: { params: { id: string } }) {
  const user = await requireRole('DOCTOR')

  const visit = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: { patient: true, doctor: { include: { user: true } } },
  })
  if (!visit) notFound()
  // Owner re-checked on the server — a doctor only ever sees their own visits.
  if (visit.doctor.userId !== user.id) redirect('/doctor')

  const symptoms = parseSymptoms(visit.symptomsJson)
  const canFinish = visit.status === 'BOOKED'

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      <Link
        href="/doctor"
        className="flex min-h-[48px] items-center gap-2 text-sm font-medium text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to today&apos;s queue
      </Link>

      <section className="rounded-card border-2 border-lav bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={visit.status} />
          <TriageTag level={visit.triageLevel} />
          {visit.reason === 'PROBLEM' && visit.triageLevel === 'NORMAL' && <ProblemTag />}
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">
          {visit.patient.name}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-muted">
          <Phone className="h-4 w-4" aria-hidden="true" />
          {visit.patient.phone}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">When</dt>
            <dd className="font-medium text-ink">
              {formatShortDate(visit.date)} at {visit.time} ({visit.durationMin} min)
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Why (question 1)</dt>
            <dd className="font-medium text-ink">
              {visit.reason === 'PROBLEM' ? 'I have a problem' : 'Routine checkup'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Weeks pregnant (question 3)</dt>
            <dd className="font-medium text-ink">
              {visit.weeks === null ? 'Not sure' : `${visit.weeks} weeks`}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Severe signs</dt>
            <dd className="font-medium text-ink">{visit.severe ? 'Yes' : 'No'}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <p className="text-sm text-muted">Symptoms (question 2)</p>
          {symptoms.length === 0 ? (
            <p className="mt-1 font-medium text-ink">None of these</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {symptoms.map((symptom) => (
                <li
                  key={symptom}
                  className="rounded-full bg-danger-bg px-2.5 py-0.5 text-sm font-medium text-danger"
                >
                  {symptom}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-card border-2 border-lav bg-surface p-5 shadow-card">
        <h2 className="text-2xl font-extrabold text-ink">Video call</h2>
        <div className="mt-3">
          <MeetingLinkForm visitId={visit.id} initialUrl={visit.meetingUrl} />
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        {canFinish ? (
          <form action={markVisitDoneAction}>
            <input type="hidden" name="id" value={visit.id} />
            <button
              type="submit"
              className="flex min-h-[56px] items-center gap-2 rounded-lg bg-accent px-6 text-base font-semibold text-white transition hover:bg-accent-deep sm:min-h-[48px]"
            >
              <Check className="h-5 w-5" aria-hidden="true" />
              Mark done
            </button>
          </form>
        ) : (
          <span className="flex min-h-[48px] items-center gap-2 rounded-lg bg-success-bg px-5 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {visit.status === 'DONE' ? 'Already done' : 'Not bookable'}
          </span>
        )}
        <Link
          href="/doctor"
          className="flex min-h-[48px] items-center gap-2 rounded-lg border-2 border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-lav-high"
        >
          <User className="h-4 w-4" aria-hidden="true" />
          Back to queue
        </Link>
      </section>
    </div>
  )
}
