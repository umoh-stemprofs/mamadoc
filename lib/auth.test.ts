/**
 * Auth tests against the real Neon database.
 * Creates its own user and LoginAttempt rows with a unique RUN marker and
 * deletes only those rows. Never touches the seed. 60 s timeout (vitest config).
 */
import 'dotenv/config'
import { afterAll, describe, expect, it } from 'vitest'
import {
  BCRYPT_COST,
  LOCKOUT_MESSAGE,
  LOCKOUT_THRESHOLD,
  WRONG_PASSWORD_MESSAGE,
  attemptLogin,
  hashPassword,
  isLockedOut,
  recentFailedAttempts,
  verifyPassword,
} from './auth'
import { prisma } from './db'

const RUN = Date.now().toString(36)
const email = `auth.${RUN}@mamadoc.test`
const now = new Date('2027-08-10T10:00:00Z')

afterAll(async () => {
  await prisma.loginAttempt.deleteMany({ where: { key: email } })
  await prisma.user.deleteMany({ where: { email } })
  await prisma.$disconnect()
})

describe('password storage', () => {
  it('stores the password hashed with bcrypt cost 10', async () => {
    const hash = await hashPassword('correct-horse-1')
    expect(hash).not.toBe('correct-horse-1')
    expect(hash).toMatch(/^\$2a\$10\$/)
    expect(await verifyPassword('correct-horse-1', hash)).toBe(true)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
    expect(BCRYPT_COST).toBe(10)
  })
})

describe('attemptLogin', () => {
  it('wrong password: one plain sentence and the try is recorded', async () => {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: 'Auth Test',
        phone: '08000000000',
        passHash: await hashPassword('correct-horse-1'),
        role: 'PATIENT',
      },
    })
    const outcome = await attemptLogin(email, 'wrong-password', now)
    expect(outcome).toEqual({ ok: false, error: WRONG_PASSWORD_MESSAGE })
    expect(WRONG_PASSWORD_MESSAGE).toMatch(/^[^.!?]+[.!?]$/)
    const tries = await prisma.loginAttempt.count({ where: { key: email } })
    expect(tries).toBeGreaterThan(0)
    expect(user.role).toBe('PATIENT')
  })

  it('correct password: succeeds with the user id and role', async () => {
    const outcome = await attemptLogin(email, 'correct-horse-1', now)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.role).toBe('PATIENT')
    }
  })

  it('locks out after 5 wrong tries in 15 minutes — even with the right password', async () => {
    await prisma.loginAttempt.deleteMany({ where: { key: email } })
    // 5 failed tries inside the window
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await prisma.loginAttempt.create({ data: { key: email, at: now } })
    }
    const attempts = await recentFailedAttempts(email, now)
    expect(attempts).toBe(LOCKOUT_THRESHOLD)
    expect(isLockedOut(attempts)).toBe(true)

    const outcome = await attemptLogin(email, 'correct-horse-1', now)
    expect(outcome).toEqual({ ok: false, error: LOCKOUT_MESSAGE })
    expect(LOCKOUT_MESSAGE).toMatch(/wait/i)
    expect(LOCKOUT_MESSAGE).toMatch(/^[^.!?]+[.!?]$/)
  })

  it('tries older than 15 minutes do not count', async () => {
    await prisma.loginAttempt.deleteMany({ where: { key: email } })
    const old = new Date(now.getTime() - 16 * 60_000)
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await prisma.loginAttempt.create({ data: { key: email, at: old } })
    }
    expect(await recentFailedAttempts(email, now)).toBe(0)
    expect(isLockedOut(await recentFailedAttempts(email, now))).toBe(false)
    const outcome = await attemptLogin(email, 'correct-horse-1', now)
    expect(outcome.ok).toBe(true)
  })

  it('unknown email still records the try (no account enumeration)', async () => {
    const ghost = `ghost.${RUN}@mamadoc.test`
    const outcome = await attemptLogin(ghost, 'whatever-123', now)
    expect(outcome).toEqual({ ok: false, error: WRONG_PASSWORD_MESSAGE })
    const tries = await prisma.loginAttempt.count({ where: { key: ghost } })
    expect(tries).toBe(1)
    await prisma.loginAttempt.deleteMany({ where: { key: ghost } })
  })
})
