'use client'

// Step 3 "Check and confirm" (maternal-care mockup: two big picture-style
// reason cards + one unmissable green confirm button). The wizard state
// travels in the URL; this posts the last choices to the server action and
// shows the one-sentence error if the slot was just taken.
import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Heart } from 'lucide-react'
import { useFormState } from 'react-dom'
import { bookVisitAction, type ActionState } from '@/app/lib/actions'

type Props = {
  doctorId: string
  date: string
  time: string
  notice?: ReactNode
  back?: ReactNode
}

const card =
  'relative flex cursor-pointer flex-col items-center rounded-card border-4 border-line bg-surface p-6 text-center transition-all has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40 has-[:checked]:shadow-dialog'

const checkBadge =
  'absolute right-4 top-4 hidden h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow has-[:checked]:flex'

export function ConfirmForm({ doctorId, date, time, notice, back }: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    bookVisitAction,
    undefined,
  )

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-card border-2 border-[#fca5a5] bg-danger-bg px-4 py-3 text-base font-semibold text-danger"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />

      <div
        role="radiogroup"
        aria-label="Reason for the visit"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <label className={card}>
          <input
            type="radio"
            name="reason"
            value="ROUTINE"
            required
            defaultChecked
            className="sr-only"
          />
          <span className={checkBadge} aria-hidden="true">
            <Check className="h-6 w-6" />
          </span>
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-md"
            aria-hidden="true"
          >
            <Heart className="h-12 w-12" />
          </span>
          <span className="mt-4 block text-2xl font-bold text-ink">
            Routine Pregnancy Checkup
          </span>
          <span className="mt-1 block text-base font-medium text-muted">
            Regular check for mother and baby
          </span>
        </label>

        <label className={card}>
          <input type="radio" name="reason" value="PROBLEM" className="sr-only" />
          <span className={checkBadge} aria-hidden="true">
            <Check className="h-6 w-6" />
          </span>
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full bg-danger-bg text-danger shadow-md"
            aria-hidden="true"
          >
            <AlertTriangle className="h-12 w-12" />
          </span>
          <span className="mt-4 block text-2xl font-bold text-ink">
            I Feel Sick or In Pain
          </span>
          <span className="mt-1 block text-base font-medium text-muted">
            Headache, fever, pains, or worry
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="flex min-h-[84px] w-full items-center justify-center gap-3 rounded-card bg-[#006e2d] px-6 py-5 text-2xl font-extrabold text-white shadow-lift transition hover:bg-[#005a24] active:scale-[0.99] md:text-3xl"
      >
        <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        YES, BOOK MY VISIT NOW
      </button>

      {back && <div className="text-center">{back}</div>}
      {notice && (
        <div className="rounded-card border-2 border-lav bg-lav-low p-4">{notice}</div>
      )}
    </form>
  )
}
