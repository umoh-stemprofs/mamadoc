// MamaDoc shared configuration (00-global.md §2).
//
// PLACEHOLDERS: the symptom list, the severe set and the wording below are
// sample labels. A doctor or nurse must approve this list before any real
// use. This is triage support, not a diagnosis.

/** Question 2 options in display order, symptoms only. */
export const SYMPTOMS = [
  'Bad headache',
  'Swollen face or hands',
  'Blurry eyes',
  'Bleeding',
  'Baby moving less',
  'Very bad vomiting',
  'Doctor said my blood pressure is high',
] as const

/** The exclusive "no symptoms" option of question 2. */
export const NONE_OF_THESE = 'None of these'

export type Symptom = (typeof SYMPTOMS)[number]

/** Symptoms that mean: show the red emergency screen first. */
export const SEVERE_SYMPTOMS = ['Bleeding', 'Baby moving less'] as const satisfies readonly Symptom[]

/** All 8 options of question 2: the 7 symptoms plus "None of these". */
export const SYMPTOM_OPTIONS = [...SYMPTOMS, NONE_OF_THESE] as const

/** Urgent patients may book today + tomorrow + the day after tomorrow (APP_TZ). */
export const URGENT_WINDOW_DAYS = 3
