// "Step 2 of 4" + progress bar (design.md §2 step bar).
const LABELS = ['Doctor', 'Day', 'Time', 'Confirm'] as const

export function StepBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">
        Step {step} of 4 · {LABELS[step - 1]}
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={4}
        aria-valuenow={step}
        aria-label={`Step ${step} of 4`}
      >
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>
    </div>
  )
}
