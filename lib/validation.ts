// Zod schemas for every server input (00-global §2 · Validation).
// Each failure is shown to the user as one plain sentence.
import { z } from 'zod'
import { SYMPTOM_OPTIONS, NONE_OF_THESE } from './config'

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(80, 'Name must be 80 characters or fewer.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number.')
    .max(20, 'Enter a valid phone number.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(200, 'Password must be 200 characters or fewer.'),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export const markReadSchema = z.object({
  id: z.string().min(1, 'That notification does not exist.'),
})

export const meetingLinkSchema = z.object({
  id: z.string().min(1, 'That visit does not exist.'),
  url: z.string().trim().url('Enter a valid link.'), // https:// checked in setMeetingUrl
})

// ---------- booking wizard ----------

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date.')

const hhmm = z
  .string()
  .trim()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Pick a valid time.')

/** The confirm-screen form: the wizard state travels in the URL, the POST is small. */
export const bookVisitSchema = z.object({
  doctorId: z.string().trim().min(1, 'Pick a doctor.'),
  date: isoDate,
  time: hhmm,
  reason: z.enum(['ROUTINE', 'PROBLEM'], {
    errorMap: () => ({ message: 'Choose why you are coming.' }),
  }),
  // Question 2: raw options, "None of these" exclusive (triage re-checks).
  symptoms: z
    .array(z.string().trim())
    .default([])
    .refine(
      (list) => list.every((s) => (SYMPTOM_OPTIONS as readonly string[]).includes(s)),
      'Choose symptoms from the list.',
    )
    .refine(
      (list) => !(list.includes(NONE_OF_THESE) && list.length > 1),
      'Pick either "None of these" or a symptom, not both.',
    ),
  // Question 3: 1–42, or left empty for "Not sure".
  weeks: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.coerce
      .number()
      .int('Enter a whole number of weeks.')
      .min(1, 'Weeks must be between 1 and 42.')
      .max(42, 'Weeks must be between 1 and 42.')
      .nullish()
      .transform((v) => v ?? null),
  ),
})

// ---------- My hours (S-D-AVAIL) ----------

const slotMinutesSchema = z.coerce
  .number()
  .refine((v) => [15, 20, 30, 45, 60].includes(v), 'Slot length must be 15, 20, 30, 45 or 60 minutes.')

/** One row of the weekly grid, exactly as the form posts it. */
export const hoursRowSchema = z
  .object({
    weekday: z.coerce.number().int().min(0, 'Pick a day of the week.').max(6, 'Pick a day of the week.'),
    enabled: z.enum(['true', 'false']),
    startTime: hhmm.or(z.literal('').transform(() => '09:00')),
    endTime: hhmm.or(z.literal('').transform(() => '17:00')),
    slotMinutes: slotMinutesSchema.or(z.literal('').transform(() => 30)),
  })
  .transform((row) => ({
    weekday: row.weekday,
    enabled: row.enabled === 'true',
    startTime: row.startTime,
    endTime: row.endTime,
    slotMinutes: row.slotMinutes,
  }))

/** The whole week, posted as JSON in one hidden field. */
export const saveHoursSchema = z.object({
  rows: z
    .string()
    .min(1, 'Send the weekly grid.')
    .transform((raw, ctx): z.infer<typeof hoursRowSchema>[] => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The weekly grid was not sent correctly.' })
        return z.NEVER
      }
      const result = z.array(hoursRowSchema).safeParse(parsed)
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The weekly grid was not sent correctly.' })
        return z.NEVER
      }
      if (result.data.length !== 7) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Send all seven days of the week.' })
        return z.NEVER
      }
      const weekdays = result.data.map((r) => r.weekday).sort((a, b) => a - b)
      if (JSON.stringify(weekdays) !== JSON.stringify([0, 1, 2, 3, 4, 5, 6])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Send each day of the week exactly once.' })
        return z.NEVER
      }
      return result.data
    }),
})

export const addDayOffSchema = z.object({
  date: isoDate,
  reason: z
    .string()
    .trim()
    .min(1, 'Write why you are away.')
    .max(80, 'The reason must be 80 characters or fewer.'),
})

export const removeDayOffSchema = z.object({
  id: z.string().min(1, 'That day off does not exist.'),
})
