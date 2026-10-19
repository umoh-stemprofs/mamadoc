import { describe, expect, it } from 'vitest'
import {
  NONE_OF_THESE,
  SEVERE_SYMPTOMS,
  SYMPTOMS,
  SYMPTOM_OPTIONS,
  TriageError,
  toggleSymptom,
  triage,
  type VisitReason,
} from './triage'

function capture(fn: () => unknown): TriageError | null {
  try {
    fn()
    return null
  } catch (e) {
    return e as TriageError
  }
}

describe('question 2 options', () => {
  it('are 8 options: 7 symptoms then "None of these"', () => {
    expect(SYMPTOM_OPTIONS).toHaveLength(8)
    expect(SYMPTOMS).toHaveLength(7)
    expect(SYMPTOM_OPTIONS[7]).toBe(NONE_OF_THESE)
  })
})

describe('triage level', () => {
  it('an empty list is NORMAL', () => {
    expect(triage({ reason: 'ROUTINE', symptoms: [], weeks: 20 }).level).toBe('NORMAL')
  })

  it('"None of these" is NORMAL', () => {
    expect(triage({ reason: 'ROUTINE', symptoms: [NONE_OF_THESE], weeks: null }).level).toBe('NORMAL')
  })

  it.each([...SYMPTOMS])('symptom "%s" gives URGENT', (symptom) => {
    expect(triage({ reason: 'ROUTINE', symptoms: [symptom], weeks: 20 }).level).toBe('URGENT')
  })

  it('more than one symptom still gives URGENT', () => {
    expect(triage({ reason: 'ROUTINE', symptoms: ['Bad headache', 'Very bad vomiting'], weeks: 20 }).level).toBe('URGENT')
  })
})

describe('severe flag', () => {
  it.each([...SEVERE_SYMPTOMS])('flags "%s" as severe', (symptom) => {
    expect(triage({ reason: 'PROBLEM', symptoms: [symptom], weeks: 30 }).severe).toBe(true)
  })

  const nonSevere = SYMPTOMS.filter((s) => !(SEVERE_SYMPTOMS as readonly string[]).includes(s))
  it.each([...nonSevere])('does not flag "%s"', (symptom) => {
    expect(triage({ reason: 'ROUTINE', symptoms: [symptom], weeks: 20 }).severe).toBe(false)
  })

  it('a severe symptom among others still flags severe', () => {
    const result = triage({ reason: 'PROBLEM', symptoms: ['Bad headache', 'Bleeding'], weeks: 20 })
    expect(result.severe).toBe(true)
    expect(result.level).toBe('URGENT')
  })

  it('no symptom is never severe', () => {
    expect(triage({ reason: 'PROBLEM', symptoms: [NONE_OF_THESE], weeks: 20 }).severe).toBe(false)
  })
})

describe('"None of these" exclusivity (toggleSymptom)', () => {
  it('picking None clears the others', () => {
    expect(toggleSymptom(['Bad headache', 'Blurry eyes'], NONE_OF_THESE)).toEqual([NONE_OF_THESE])
  })

  it('picking any other symptom clears None', () => {
    expect(toggleSymptom([NONE_OF_THESE], 'Bleeding')).toEqual(['Bleeding'])
  })

  it('picking None again turns it off', () => {
    expect(toggleSymptom([NONE_OF_THESE], NONE_OF_THESE)).toEqual([])
  })

  it('toggles a picked symptom off without touching the others', () => {
    expect(toggleSymptom(['Bad headache', 'Bleeding'], 'Bad headache')).toEqual(['Bleeding'])
  })

  it('adds a new symptom to the list', () => {
    expect(toggleSymptom(['Bad headache'], 'Very bad vomiting')).toEqual([
      'Bad headache',
      'Very bad vomiting',
    ])
  })

  it('rejects an unknown option', () => {
    expect(() => toggleSymptom([], 'Fever')).toThrowError(TriageError)
  })
})

describe('questions 1 and 3 never change the level', () => {
  const allLevels = (symptoms: string[]): string[] =>
    (['ROUTINE', 'PROBLEM'] as const).flatMap((reason) =>
      [null, 1, 21, 42].map((weeks) => triage({ reason, symptoms, weeks }).level),
    )

  it('with no symptom the level is NORMAL for every reason and weeks value', () => {
    expect(allLevels([])).toEqual(Array(8).fill('NORMAL'))
  })

  it('with a symptom the level is URGENT for every reason and weeks value', () => {
    expect(allLevels(['Swollen face or hands'])).toEqual(Array(8).fill('URGENT'))
  })
})

describe('hasProblem flag', () => {
  it('true for PROBLEM with no symptom (level stays NORMAL)', () => {
    const result = triage({ reason: 'PROBLEM', symptoms: [], weeks: 12 })
    expect(result.level).toBe('NORMAL')
    expect(result.hasProblem).toBe(true)
  })

  it('true for PROBLEM with "None of these" (no symptom picked)', () => {
    const result = triage({ reason: 'PROBLEM', symptoms: [NONE_OF_THESE], weeks: 12 })
    expect(result.level).toBe('NORMAL')
    expect(result.hasProblem).toBe(true)
  })

  it('false for ROUTINE with no symptom', () => {
    expect(triage({ reason: 'ROUTINE', symptoms: [], weeks: 12 }).hasProblem).toBe(false)
  })

  it('false for PROBLEM with a symptom (already URGENT)', () => {
    const result = triage({ reason: 'PROBLEM', symptoms: ['Bad headache'], weeks: 12 })
    expect(result.level).toBe('URGENT')
    expect(result.hasProblem).toBe(false)
  })
})

describe('validation', () => {
  it.each([0, 43, 1.5])('rejects weeks %s', (weeks) => {
    expect(() => triage({ reason: 'ROUTINE', symptoms: [], weeks })).toThrowError(
      /whole number from 1 to 42/,
    )
  })

  it('accepts weeks 1, weeks 42 and "Not sure" (null)', () => {
    expect(triage({ reason: 'ROUTINE', symptoms: [], weeks: 1 }).weeks).toBe(1)
    expect(triage({ reason: 'ROUTINE', symptoms: [], weeks: 42 }).weeks).toBe(42)
    expect(triage({ reason: 'ROUTINE', symptoms: [], weeks: null }).weeks).toBe(null)
  })

  it('rejects an unknown symptom', () => {
    const err = capture(() => triage({ reason: 'ROUTINE', symptoms: ['Fever'], weeks: null }))
    expect(err).toBeInstanceOf(TriageError)
    expect(err?.message).toBe('"Fever" is not one of the symptom options.')
  })

  it('rejects "None of these" mixed with a symptom', () => {
    const err = capture(() =>
      triage({ reason: 'ROUTINE', symptoms: [NONE_OF_THESE, 'Bleeding'], weeks: null }),
    )
    expect(err).toBeInstanceOf(TriageError)
    expect(err?.message).toMatch(/not both/)
  })

  it('rejects an unknown reason', () => {
    // untrusted server input can carry any string — the runtime check catches it
    expect(() => triage({ reason: 'MAYBE' as VisitReason, symptoms: [], weeks: null })).toThrowError(
      TriageError,
    )
  })

  it('every validation error is one plain sentence', () => {
    const badInputs = [
      () => triage({ reason: 'ROUTINE', symptoms: [], weeks: 0 }),
      () => triage({ reason: 'ROUTINE', symptoms: ['Fever'], weeks: null }),
      () => triage({ reason: 'ROUTINE', symptoms: [NONE_OF_THESE, 'Bleeding'], weeks: null }),
      () => triage({ reason: 'MAYBE' as VisitReason, symptoms: [], weeks: null }),
    ]
    for (const fn of badInputs) {
      const err = capture(fn)
      expect(err).toBeInstanceOf(TriageError)
      expect(err?.message).toMatch(/^[^.!?]+[.!?]$/)
    }
  })
})
