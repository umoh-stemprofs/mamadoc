'use client'

// "Add day off" + the current list (S-D-AVAIL). Dates are calendar dates in
// APP_TZ; the reason is stored and shown on the card.
import { AlertCircle, CalendarOff, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFormState } from 'react-dom'
import {
  addTimeOffAction,
  removeTimeOffAction,
  type ActionState,
} from '@/app/lib/actions'
import { formatShortDate } from '@/lib/format'

type DayOff = { id: string; date: string; reason: string | null }

const inputClass =
  'rounded-input border-[1.5px] border-[#d1d5db] bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent'

export function TimeOffList({ initial }: { initial: DayOff[] }) {
  const [addState, addFormAction] = useFormState<ActionState, FormData>(
    addTimeOffAction,
    undefined,
  )
  const [removeState, removeFormAction] = useFormState<ActionState, FormData>(
    removeTimeOffAction,
    undefined,
  )
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (addState && !addState.error) setAdded(true)
  }, [addState])

  const days = [...initial].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="flex flex-col gap-4">
      <form action={addFormAction} className="flex flex-col gap-3">
        {(addState?.error || removeState?.error) && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {addState?.error ?? removeState?.error}
          </p>
        )}
        {added && !addState?.error && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-success-bg px-3 py-2 text-sm text-success"
          >
            Day off added.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="dayoff-date" className="text-sm font-medium text-muted">
              Date
            </label>
            <input
              id="dayoff-date"
              name="date"
              type="date"
              required
              className={inputClass}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="dayoff-reason" className="text-sm font-medium text-muted">
              Reason
            </label>
            <input
              id="dayoff-reason"
              name="reason"
              type="text"
              required
              maxLength={80}
              placeholder="Conference, leave, training…"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-deep"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add day off
          </button>
        </div>
      </form>

      {days.length === 0 ? (
        <div className="rounded-card border-2 border-lav bg-surface p-6 text-center shadow-card">
          <CalendarOff className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-2 text-muted">No days off marked.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card border-2 border-lav bg-surface shadow-card">
          {days.map((day) => (
            <li key={day.id} className="flex items-center gap-3 p-4">
              <CalendarOff className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{formatShortDate(day.date)}</p>
                {day.reason && <p className="text-sm text-muted">{day.reason}</p>}
              </div>
              <form action={removeFormAction}>
                <input type="hidden" name="id" value={day.id} />
                <button
                  type="submit"
                  aria-label={`Remove day off on ${formatShortDate(day.date)}`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
