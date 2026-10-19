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
import { markDone, setMeetingUrl } from '@/lib/booking'
import { prisma } from '@/lib/db'
import { homeForRole } from '@/lib/roles'
import { getSession } from '@/lib/session'
import {
  loginSchema,
  markReadSchema,
  meetingLinkSchema,
  signupSchema,
} from '@/lib/validation'

export type ActionState = { error?: string } | undefined

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

/** Doctor saves a visit's meeting link — owning doctor, https only. */
export async function saveMeetingLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession()
  if (!session.userId || session.role !== 'DOCTOR') {
    return { error: 'You can only update your own visits.' }
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

/** Only same-site, absolute-path redirects (never //evil.com). */
function safeNext(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Check the form and try again.'
}
