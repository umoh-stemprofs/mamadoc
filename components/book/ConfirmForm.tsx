'use client'

// Step 4 "Check and confirm" form (S-B-CONFIRM). The wizard state travels in
// the URL; this posts the last choices to the server action and shows the
// one-sentence error if the slot was just taken.
import { AlertCircle } from 'lucide-react'
import { useFormState } from 'react-dom'
import { bookVisitAction, type ActionState } from '@/app/lib/actions'

type Props = {
  doctorId: string
  date: string
  time: string
  /** Safety notice (server-rendered) shown above the primary button. */
  notice?: React.ReactNode
}

const primaryButton =
  'flex min-h-[56px] w-full items-center justify-center rounded-lg bg-accent px-4 text-base font-semibold text-white transition hover:opacity-90 sm:min-h-[48px]'

export function ConfirmForm({ doctorId, date, time, notice }: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    bookVisitAction,
    undefined,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <input type="hidden" name="doctorId" value={doctorId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-muted">
          Why are you coming? (saved for the doctor)
        </legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex min-h-[48px] flex-1 cursor-pointer items-center gap-3 rounded-input border border-line bg-surface px-4 py-3 text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/5">
            <input
              type="radio"
              name="reason"
              value="ROUTINE"
              required
              defaultChecked
              className="h-5 w-5 accent-[var(--accent)]"
            />
            <span className="text-sm font-medium">Routine checkup</span>
          </label>
          <label className="flex min-h-[48px] flex-1 cursor-pointer items-center gap-3 rounded-input border border-line bg-surface px-4 py-3 text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/5">
            <input
              type="radio"
              name="reason"
              value="PROBLEM"
              className="h-5 w-5 accent-[var(--accent)]"
            />
            <span className="text-sm font-medium">I have a problem</span>
          </label>
        </div>
      </fieldset>

      {notice}

      <button type="submit" className={primaryButton}>
        Confirm booking
      </button>
    </form>
  )
}
