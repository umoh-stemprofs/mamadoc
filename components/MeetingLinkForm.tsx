'use client'

// Doctor "Add meeting link" — https only, checked on the server too.
import { Sparkles, Video } from 'lucide-react'
import { useFormState } from 'react-dom'
import { saveMeetingLinkAction, type ActionState } from '@/app/lib/actions'

export function MeetingLinkForm({ visitId, initialUrl }: { visitId: string; initialUrl?: string | null }) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    saveMeetingLinkAction,
    undefined,
  )

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={visitId} />
      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="meeting-url"
            className="mb-1 block text-sm font-medium text-muted"
          >
            Meeting link (must start with https://)
          </label>
          <input
            id="meeting-url"
            key={state?.url ?? initialUrl ?? ''}
            name="url"
            type="url"
            required
            placeholder="https://meet.example.com/visit"
            defaultValue={state?.url ?? initialUrl ?? ''}
            className="block w-full rounded-input border-[1.5px] border-[#d1d5db] bg-surface px-3 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          type="submit"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-deep"
        >
          <Video className="h-4 w-4" aria-hidden="true" />
          Save link
        </button>
      </div>
      <button
        type="submit"
        name="intent"
        value="generate"
        formNoValidate
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border-2 border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:bg-lav-high"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Generate meeting link
      </button>
      {state?.url && (
        <p role="status" className="text-sm text-success">
          Meeting link generated and saved for this visit.
        </p>
      )}
      <p className="text-sm text-muted">
        The patient sees a &quot;Join call&quot; button once a link is saved.
      </p>
    </form>
  )
}
