// Zod schemas for every server input (00-global §2 · Validation).
// Each failure is shown to the user as one plain sentence.
import { z } from 'zod'

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
