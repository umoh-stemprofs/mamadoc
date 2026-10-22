'use server'

// Server actions. Roles and ownership are re-checked here (and in the page
// guards) — never only in the UI. Every input goes through Zod.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  LOCKOUT_MESSAGE,
  attemptLogin,
  createPatient,
  isLockedOut,
  loginAs,
  logout,
  recentFailedAttempts,
} from '@/lib/auth'
import { jitSiMeetingUrl, markDone, setMeetingUrl } from '@/lib/booking'
import { prisma } from '@/lib/db'
import { addDayOff, removeDayOff, saveHours } from '@/lib/hours'
import { homeForRole } from '@/lib/roles'
import { getSession } from '@/lib/session'
import { bookVisitFor } from '@/lib/wizard'
import {
  addDayOffSchema,
  bookVisitSchema,
  loginSchema,
  markReadSchema,
  meetingLinkSchema,
  removeDayOffSchema,
  saveHoursSchema,
  signupSchema,
  visitIdSchema,
} from '@/lib/validation'

export type ActionState = { error?: string; saved?: boolean; url?: string } | undefined

/** The current moment in APP_TZ — never the server's clock zone. */
function appNow() {
  const timeZone = process.env.APP_TZ || 'Africa/Lagos'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  }
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) }
  }

  const now = new Date()
  const attempts = await recentFailedAttempts(parsed.data.email, now)
  if (isLockedOut(attempts)) {
    return { error: LOCKOUT_MESSAGE }
  }

  const outcome = await attemptLogin(parsed.data.email, parsed.data.password, now)
  if (!outcome.ok) return { error: outcome.error }
  await loginAs(outcome.userId)
  redirect(safeNext(formData.get('next')) ?? homeForRole(outcome.role))
}

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) }
  }
  const created = await createPatient(parsed.data)
  if (!created.ok) return { error: created.error }
  await loginAs(created.userId)
  redirect('/')
}

/** "Try demo patient" / "Try demo doctor" — only reachable when DEMO_MODE=true. */
export async function demoLoginAction(formData: FormData): Promise<void> {
  if (process.env.DEMO_MODE !== 'true') {
    throw new Error('Demo mode is off. Add DEMO_MODE=true to .env to enable it.')
  }
  const role = z.enum(['PATIENT', 'DOCTOR']).parse(formData.get('role'))
  const email = z.string().email().parse(formData.get('email'))
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.role !== role) throw new Error('That demo account does not exist.')
  await loginAs(user.id)
  redirect(homeForRole(role))
}

export async function logoutAction(): Promise<void> {
  await logout()
  redirect('/login')
}

/** Mark one of MY notifications read — owner re-checked here. */
export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const parsed = markReadSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return
  const session = await getSession()
  if (!session.userId) return // signed out: change nothing
  await prisma.notification.updateMany({
    where: { id: parsed.data.id, userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  })
  revalidatePath('/notifications')
  revalidatePath('/')
}

/** Doctor "Done" on a queue card — the owning doctor only (markDone). */
export async function markVisitDoneAction(formData: FormData): Promise<void> {
  const parsed = markReadSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return
  const session = await getSession()
  if (!session.userId || session.role !== 'DOCTOR') return
  await markDone(prisma, parsed.data.id, session.userId)
  revalidatePath('/doctor')
}

/**
 * Doctor saves a visit's meeting link — owning doctor, https only.
 * The "Generate meeting link" button posts intent=generate: the Jitsi room
 * URL is built server-side and saved through this same ownership-checked path.
 */
export async function saveMeetingLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session.userId || session.role !== 'DOCTOR') {
    return { error: 'You can only update your own visits.' }
  }
  if (formData.get('intent') === 'generate') {
    const idParsed = visitIdSchema.safeParse({ id: formData.get('id') })
    if (!idParsed.success) return { error: firstIssue(idParsed.error) }
    const url = jitSiMeetingUrl(idParsed.data.id)
    const generated = await setMeetingUrl(prisma, idParsed.data.id, session.userId, url)
    if (!generated.ok) return { error: generated.error }
    revalidatePath(`/doctor/visit/${idParsed.data.id}`)
    return { url }
  }
  const parsed = meetingLinkSchema.safeParse({
    id: formData.get('id'),
    url: formData.get('url'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const result = await setMeetingUrl(prisma, parsed.data.id, session.userId, parsed.data.url)
  if (!result.ok) return { error: result.error }
  revalidatePath(`/doctor/visit/${parsed.data.id}`)
  return undefined
}

/**
 * Confirm booking (wizard step 4). The patient id comes from the session,
 * never the form — bookVisitFor re-checks the role again inside.
 */
export async function bookVisitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session.userId || !session.role) return { error: 'Log in to book a visit.' }

  const parsed = bookVisitSchema.safeParse({
    doctorId: formData.get('doctorId'),
    date: formData.get('date'),
    time: formData.get('time'),
    reason: formData.get('reason'),
    symptoms: formData.getAll('symptoms'),
    weeks: formData.get('weeks'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const result = await bookVisitFor(
    prisma,
    { role: session.role, userId: session.userId },
    parsed.data,
    appNow(),
  )
  if (!result.ok) return { error: result.error }

  revalidatePath('/')
  revalidatePath('/doctor')
  redirect(`/book/done?id=${result.appointmentId}`)
}

/** Doctor saves the whole weekly grid — only their own rules are replaced. */
export async function saveHoursAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session.userId || session.role !== 'DOCTOR') {
    return { error: 'You can only set your own hours.' }
  }
  const parsed = saveHoursSchema.safeParse({ rows: formData.get('rows') })
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const result = await saveHours(prisma, session.userId, parsed.data.rows)
  if (!result.ok) return { error: result.error }
  revalidatePath('/doctor/hours')
  revalidatePath('/book')
  return { error: undefined, saved: true } as ActionState
}

/** Doctor adds one of their own days off, with a reason. */
export async function addTimeOffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session.userId || session.role !== 'DOCTOR') {
    return { error: 'You can only set your own days off.' }
  }
  const parsed = addDayOffSchema.safeParse({
    date: formData.get('date'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const result = await addDayOff(prisma, session.userId, parsed.data.date, parsed.data.reason)
  if (!result.ok) return { error: result.error }
  revalidatePath('/doctor/hours')
  revalidatePath('/book')
  return { error: undefined, saved: true } as ActionState
}

/** Doctor removes one of their own days off. */
export async function removeTimeOffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session.userId || session.role !== 'DOCTOR') {
    return { error: 'You can only change your own days off.' }
  }
  const parsed = removeDayOffSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { error: firstIssue(parsed.error) }

  const result = await removeDayOff(prisma, session.userId, parsed.data.id)
  if (!result.ok) return { error: result.error }
  revalidatePath('/doctor/hours')
  revalidatePath('/book')
  return { error: undefined } as ActionState
}

/** Only same-site, absolute-path redirects (never //evil.com). */
function safeNext(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the form and try again.'
}
