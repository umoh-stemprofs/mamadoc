import { AlertTriangle, Phone } from 'lucide-react'
import Link from 'next/link'

/** Footer notice required on every page (00-global §4). Server only — reads env. */
export function SafetyNotice({ emergencyNumber }: { emergencyNumber?: string }) {
  const number = emergencyNumber ?? process.env.EMERGENCY_NUMBER ?? '112'
  return (
    <div className="flex flex-col gap-1 text-sm text-muted">
      <p className="flex items-start gap-2">
        <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          For non-emergency visits only. In an emergency call{' '}
          <strong className="font-semibold text-ink">{number}</strong>.
        </span>
      </p>
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Prototype. Not for diagnosis or treatment.{' '}
          <Link href="/limitations" className="font-medium text-accent underline">
            Limitations
          </Link>
          .
        </span>
      </p>
    </div>
  )
}
