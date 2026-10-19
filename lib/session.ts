// iron-session v8 config, shared by server actions, pages and middleware.
// The SESSION_SECRET value comes from .env and is never committed.
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

const PASSWORD = process.env.SESSION_SECRET

// Checked at call time (not import time), so tests and edge bundles never
// crash on import — they fail loudly only when a session is actually used.
function sessionOptions() {
  if (!PASSWORD) {
    throw new Error(
      'SESSION_SECRET is not set. Add a long random string to .env.'
    )
  }
  return {
    cookieName: 'mamadoc_session',
    password: PASSWORD,
    ttl: 60 * 60 * 24 * 14, // two weeks
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  }
}

export const ironOptions = sessionOptions

export interface SessionData {
  userId?: string
  role?: 'PATIENT' | 'DOCTOR'
  email?: string
  name?: string
}

/** iron-session for server actions and pages (request cookies). */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), ironOptions())
}
