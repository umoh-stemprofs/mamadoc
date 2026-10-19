// Pure triage logic for MamaDoc (13-mamadoc.md §Logic).
// No clock, no database, no environment: every input is an argument, so the
// tests never depend on today's date. Question 1 (reason) and question 3
// (weeks) are saved for the doctor but NEVER change the triage level.

import {
  NONE_OF_THESE,
  SEVERE_SYMPTOMS,
  SYMPTOMS,
  type Symptom,
} from './config'

export type TriageLevel = 'NORMAL' | 'URGENT'
export type VisitReason = 'ROUTINE' | 'PROBLEM'

export type TriageInput = {
  reason: VisitReason
  symptoms: readonly string[] // raw picked options; may include "None of these"
  weeks: number | null // 1–42, or null for "Not sure"
}

export type TriageResult = {
  level: TriageLevel
  hasProblem: boolean
  severe: boolean
  reason: VisitReason
  weeks: number | null
  symptoms: Symptom[] // real symptoms only, "None of these" removed
}

/** Every validation failure carries exactly one plain sentence. */
export class TriageError extends Error {}

// The 8 options of question 2, re-exported for the wizard.
export { NONE_OF_THESE, SEVERE_SYMPTOMS, SYMPTOMS, SYMPTOM_OPTIONS } from './config'
export type { Symptom } from './config'

function isSymptomOption(value: string): boolean {
  return value === NONE_OF_THESE || (SYMPTOMS as readonly string[]).includes(value)
}

function assertOptions(values: readonly string[]): void {
  for (const value of values) {
    if (!isSymptomOption(value)) {
      throw new TriageError(`"${value}" is not one of the symptom options.`)
    }
  }
}

/** "Has a problem" tag: Q1 = problem and the level stayed NORMAL (no symptom picked). */
export function hasProblemFlag(reason: VisitReason, level: TriageLevel): boolean {
  return reason === 'PROBLEM' && level === 'NORMAL'
}

/**
 * One tap on question 2. "None of these" is exclusive in both directions:
 * picking it clears the others, picking any other clears it. Tapping the
 * already-picked option turns it off.
 */
export function toggleSymptom(current: readonly string[], option: string): string[] {
  assertOptions([...current, option])
  if (option === NONE_OF_THESE) {
    return current.includes(NONE_OF_THESE) ? [] : [NONE_OF_THESE]
  }
  const without = current.filter((value) => value !== NONE_OF_THESE && value !== option)
  return current.includes(option) ? without : [...without, option]
}

/**
 * Decide the triage level. Any real symptom picked → URGENT.
 * "None of these" or an empty list → NORMAL.
 */
export function triage(input: TriageInput): TriageResult {
  if (input.reason !== 'ROUTINE' && input.reason !== 'PROBLEM') {
    throw new TriageError('Reason must be "ROUTINE" or "PROBLEM".')
  }
  const weeks = input.weeks
  if (weeks !== null && (!Number.isInteger(weeks) || weeks < 1 || weeks > 42)) {
    throw new TriageError('Weeks must be a whole number from 1 to 42, or "Not sure".')
  }

  const picked = [...input.symptoms]
  assertOptions(picked)
  const pickedNone = picked.includes(NONE_OF_THESE)
  const symptoms = picked.filter((value): value is Symptom => value !== NONE_OF_THESE)
  if (pickedNone && symptoms.length > 0) {
    throw new TriageError('Pick either "None of these" or a symptom, not both.')
  }

  const level: TriageLevel = symptoms.length > 0 ? 'URGENT' : 'NORMAL'
  return {
    level,
    hasProblem: hasProblemFlag(input.reason, level),
    severe: symptoms.some((value) => (SEVERE_SYMPTOMS as readonly string[]).includes(value)),
    reason: input.reason,
    weeks,
    symptoms,
  }
}
