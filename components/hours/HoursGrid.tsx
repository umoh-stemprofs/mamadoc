'use client'

// S-D-AVAIL weekly grid: one row per weekday (Mon–Sun), a switch per day,
// start/end time and slot length. Posts the whole week as JSON to the server
// action; errors come back as one sentence.
import { AlertCircle, CheckCircle2, Clock3, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFormState } from 'react-dom'
import { saveHoursAction, type ActionState } from '@/app/lib/actions'
import { WEEKDAY_NAMES, WEEKDAY_ORDER, type HoursEntry } from '@/lib/hoursShared'

const SLOT_OPTIONS = [15, 20, 30, 45, 60]

const timeInput =
  'rounded-input border-[1.5px] border-[#d1d5db] bg-surface px-2 py-2 text-sm tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-bg disabled:text-muted'

export function HoursGrid({ initial }: { initial: HoursEntry[] }) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    saveHoursAction,
    undefined,
  )
  const [rows, setRows] = useState<HoursEntry[]>(() => order(initial))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (state && !state.error) setSaved(true)
  }, [state])

  const update = (weekday: number, patch: Partial<HoursEntry>) => {
    setSaved(false)
    setRows((current) =>
      current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)),
    )
  }

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
      {saved && !state?.error && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg bg-success-bg px-3 py-2 text-sm text-success"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Hours saved.
        </p>
      )}

      <input type="hidden" name="rows" value={JSON.stringify(rows)} />

      <ul className="flex flex-col divide-y divide-line rounded-card border-2 border-lav bg-surface shadow-card">
        {rows.map((row) => (
          <li key={row.weekday} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-[150px] items-center gap-3">
              <Toggle
                checked={row.enabled}
                onChange={(enabled) => update(row.weekday, { enabled })}
                label={WEEKDAY_NAMES[row.weekday]}
              />
              <span className={`text-sm font-medium ${row.enabled ? 'text-ink' : 'text-muted'}`}>
                {WEEKDAY_NAMES[row.weekday]}
              </span>
            </div>

            <div className="flex flex-1 flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-muted">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Start time on {WEEKDAY_NAMES[row.weekday]}</span>
                <input
                  type="time"
                  value={row.startTime}
                  disabled={!row.enabled}
                  step={900}
                  onChange={(e) => update(row.weekday, { startTime: e.target.value })}
                  className={timeInput}
                />
              </label>
              <span aria-hidden="true" className="text-muted">
                –
              </span>
              <label className="flex items-center gap-1.5 text-sm text-muted">
                <span className="sr-only">End time on {WEEKDAY_NAMES[row.weekday]}</span>
                <input
                  type="time"
                  value={row.endTime}
                  disabled={!row.enabled}
                  step={900}
                  onChange={(e) => update(row.weekday, { endTime: e.target.value })}
                  className={timeInput}
                />
              </label>

              <label className="ml-auto flex items-center gap-2 text-sm text-muted">
                <span className="sr-only">Slot length on {WEEKDAY_NAMES[row.weekday]}</span>
                <select
                  value={row.slotMinutes}
                  disabled={!row.enabled}
                  onChange={(e) =>
                    update(row.weekday, { slotMinutes: Number(e.target.value) })
                  }
                  className={timeInput}
                >
                  {SLOT_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min slots
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="submit"
        className="flex min-h-[48px] items-center justify-center gap-2 self-start rounded-lg bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-deep"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        Save hours
      </button>
    </form>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Available on ${label}`}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? 'bg-accent' : 'bg-line'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
        aria-hidden="true"
      />
    </button>
  )
}

function order(entries: HoursEntry[]): HoursEntry[] {
  const byWeekday = new Map(entries.map((e) => [e.weekday, e]))
  return WEEKDAY_ORDER.map(
    (weekday) =>
      byWeekday.get(weekday) ?? {
        weekday,
        enabled: false,
        startTime: '09:00',
        endTime: '17:00',
        slotMinutes: 30,
      },
  )
}
