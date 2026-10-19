import { ArrowLeft, CalendarPlus } from 'lucide-react'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'

export const metadata = { title: 'Book a visit' }

export default async function BookPage() {
  await requireRole('PATIENT')

  return (
    <div className="mx-auto w-full max-w-[560px] rounded-card border border-line bg-surface p-8 text-center shadow-card">
      <CalendarPlus className="mx-auto h-10 w-10 text-accent" aria-hidden="true" />
      <h1 className="mt-3 text-xl font-semibold leading-7 text-ink">
        The booking wizard is coming next
      </h1>
      <p className="mt-2 text-muted">
        Step 4B adds the three questions, the day and time picker, and the confirm
        screen. Nothing is booked yet.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-medium text-ink hover:bg-bg"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to home
      </Link>
    </div>
  )
}
