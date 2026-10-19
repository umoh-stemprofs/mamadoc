// Patient and doctor messages for a booking (13-mamadoc.md §Logic).
// Pure text — the same words are reused everywhere in the flow (design.md §6).

import type { TriageLevel } from './triage'

/** Shown to the patient once the booking transaction succeeds. */
export function confirmationMessage(level: TriageLevel): string {
  return level === 'URGENT'
    ? 'Booked. The doctor sees urgent patients first.'
    : 'Booked.'
}

/** The doctor's notification text; urgent says URGENT and lists the symptoms. */
export function doctorNotificationText(input: {
  level: TriageLevel
  patientName: string
  date: string
  time: string
  symptoms?: readonly string[]
}): string {
  const when = `${input.date} at ${input.time}`
  if (input.level === 'URGENT') {
    const symptoms = (input.symptoms ?? []).join(', ') || 'none reported'
    return `URGENT: ${input.patientName} on ${when}. Symptoms: ${symptoms}.`
  }
  return `Booked: ${input.patientName} on ${when}.`
}
