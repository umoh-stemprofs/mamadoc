// Login, logout, signup and role guards (00-global §4 · Security).
// bcrypt cost 10 · lockout after 5 wrong tries in 15 minutes (LoginAttempt,
// key = email) · every server action re-checks the session and the owner —
// never only the UI.
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import type { z } from 'zod'
import { prisma } from './db'
import { homeForRole, type Role } from './roles'
import { getSession } from './session'
import type { signupSchema } from './validation'

export { homeForRole }

export const BCRYPT_COST = 10
export const LOCKOUT_THRESHOLD = 5
export const LOCKOUT_WINDOW_MINUTES = 15
export const LOCKOUT_MESSAGE =
  'Too many wrong tries, wait 15 minutes and try again.'
export const WRONG_PASSWORD_MESSAGE = 'Wrong password, try again.'

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export function verifyPassword(password: string, passHash: string): Promise<boolean> {
  return bcrypt.compare(password, passHash)
}

/** Wrong tries for this email inside the 15-minute window (LoginAttempt rows). */
export async function recentFailedAttempts(email: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - LOCKOUT_WINDOW_MINUTES * 60_000)
  return prisma.loginAttempt.count({ where: { key: email, at: { gte: since } } })
}

export function isLockedOut(attempts: number): boolean {
  return attempts >= LOCKOUT_THRESHOLD
}

export type LoginOutcome =
  | { ok: true; userId: string; role: 'PATIENT' | 'DOCTOR' }
  | { ok: false; error: string }

/**
 * Verify credentials against the database. Does NOT create the session or
 * the redirect — callers decide (so tests can drive it directly).
 */
export async function attemptLogin(
  email: string,
  password: string,
  now: Date,
): Promise<LoginOutcome> {
  const user = await prisma.user.findUnique({ where: { email } })
  const attempts = await recentFailedAttempts(email, now)
  if (isLockedOut(attempts)) {
    return { ok: false, error: LOCKOUT_MESSAGE }
  }
  if (!user) {
    // Record the failed try even when the email is unknown, so the lockout
    // cannot be used to test which emails exist.
    await prisma.loginAttempt.create({ data: { key: email, at: now } })
    return { ok: false, error: WRONG_PASSWORD_MESSAGE }
  }
  const ok = await verifyPassword(password, user.passHash)
  if (!ok) {
    await prisma.loginAttempt.create({ data: { key: email, at: now } })
    return { ok: false, error: WRONG_PASSWORD_MESSAGE }
  }
  return { ok: true, userId: user.id, role: user.role }
}

/** Create a PATIENT account from validated signup input. */
export async function createPatient(
  input: z.infer<typeof signupSchema>,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    return { ok: false, error: 'An account with this email already exists.' }
  }
  const passHash = await hashPassword(input.password)
  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        passHash,
        role: 'PATIENT',
      },
    })
    return { ok: true, userId: user.id }
  } catch {
    // unique email race between the check above and this insert
    return { ok: false, error: 'An account with this email already exists.' }
  }
}

export async function loginAs(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('That account does not exist.')
  const session = await getSession()
  session.userId = user.id
  session.role = user.role
  session.email = user.email
  session.name = user.name
  await session.save()
}

export async function logout(): Promise<void> {
  const session = await getSession()
  session.destroy()
}

/** Session identity or null when signed out. Used inside actions and routes. */
export async function getCurrentUser(): Promise<{
  id: string
  role: 'PATIENT' | 'DOCTOR'
  email: string
  name: string
} | null> {
  const session = await getSession()
  if (!session.userId || !session.role) return null
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, email: true, name: true },
  })
  if (!user || user.role !== session.role) return null
  return user
}

/** Page guard: signed out → /login, wrong role → own home. */
export async function requireRole(role: 'PATIENT' | 'DOCTOR'): Promise<{
  id: string
  role: 'PATIENT' | 'DOCTOR'
  email: string
  name: string
}> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== role) redirect(homeForRole(user.role))
  return user
}

/** Shared pages (notifications): any signed-in user. */
export async function requireUser(): Promise<{
  id: string
  role: Role
  email: string
  name: string
}> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}


