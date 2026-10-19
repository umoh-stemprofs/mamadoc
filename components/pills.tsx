// Status pills: never colour alone — colour + icon + word (design.md §1).
import { AlertTriangle, Check, CheckCircle2, Clock3, XCircle } from 'lucide-react'

type Status = 'BOOKED' | 'CANCELLED' | 'DONE' | 'NO_SHOW'

const STATUS: Record<Status, { label: string; className: string; Icon: typeof Check }> = {
  BOOKED: { label: 'Booked', className: 'bg-success-bg text-success', Icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', className: 'bg-bg text-muted', Icon: XCircle },
  DONE: { label: 'Done', className: 'bg-success-bg text-success', Icon: CheckCircle2 },
  NO_SHOW: { label: 'No show', className: 'bg-warning-bg text-warning', Icon: Clock3 },
}

export function StatusPill({ status }: { status: string }) {
  const entry = STATUS[status as Status] ?? STATUS.BOOKED
  const { label, className, Icon } = entry
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

export function TriageTag({ level }: { level: 'NORMAL' | 'URGENT' }) {
  return level === 'URGENT' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2.5 py-0.5 text-sm font-semibold text-danger">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      Urgent
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-0.5 text-sm font-semibold text-success">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      Normal
    </span>
  )
}

export function ProblemTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-0.5 text-sm font-medium text-warning">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      Has a problem
    </span>
  )
}
