// The doctor's queue, computed on read and never stored (13-mamadoc.md).
// Same doctor and day, status BOOKED only; URGENT first (earliest createdAt,
// ties broken by time then id), then NORMAL by time slot. Done and cancelled
// leave the queue.

import { hasProblemFlag, type TriageLevel, type VisitReason } from './triage'

export type QueueAppointment = {
  id: string
  doctorId: string
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
  status: string // "BOOKED" | "CANCELLED" | "DONE" | "NO_SHOW"
  triageLevel: TriageLevel
  reason: VisitReason
  symptomsJson?: string | null // JSON list of symptom labels
  createdAt: Date | string
}

export type QueueItem = {
  position: number // 1-based, in queue order
  id: string
  time: string
  triageLevel: TriageLevel
  symptoms: string[]
  hasProblem: boolean
}

export function buildQueue(
  appointments: readonly QueueAppointment[],
  doctorId: string,
  date: string,
): QueueItem[] {
  const booked = appointments.filter(
    (a) => a.doctorId === doctorId && a.date === date && a.status === 'BOOKED',
  )
  const createdAtMs = (a: QueueAppointment): number =>
    a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()

  // Urgent: earliest createdAt first; ties by time, then id (total order →
  // the queue is identical no matter how the rows arrive).
  const urgent = booked
    .filter((a) => a.triageLevel === 'URGENT')
    .sort(
      (a, b) =>
        createdAtMs(a) - createdAtMs(b) ||
        a.time.localeCompare(b.time) ||
        a.id.localeCompare(b.id),
    )
  // Normal: by time slot; ties by createdAt, then id.
  const normal = booked
    .filter((a) => a.triageLevel === 'NORMAL')
    .sort(
      (a, b) =>
        a.time.localeCompare(b.time) ||
        createdAtMs(a) - createdAtMs(b) ||
        a.id.localeCompare(b.id),
    )

  return [...urgent, ...normal].map((a, index) => ({
    position: index + 1,
    id: a.id,
    time: a.time,
    triageLevel: a.triageLevel,
    symptoms: parseSymptoms(a.symptomsJson),
    hasProblem: hasProblemFlag(a.reason, a.triageLevel),
  }))
}

function parseSymptoms(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    // Unreadable JSON shows as no symptoms rather than crashing the queue.
    return []
  }
}
