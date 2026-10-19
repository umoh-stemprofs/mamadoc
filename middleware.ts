import { getIronSession } from 'iron-session'
import { NextRequest, NextResponse } from 'next/server'
import { routeDecision } from '@/lib/roles'
import type { SessionData } from '@/lib/session'
import { ironOptions } from '@/lib/session'

// Route guard for the browser: no session → /login, wrong role → own home.
// This is UX, not security. Every page, server action and route handler
// re-checks the real role and ownership again inside the session module.
export async function middleware(request: NextRequest) {
  const probe = NextResponse.next()
  const session = await getIronSession<SessionData>(request, probe, ironOptions())

  const decision = routeDecision(request.nextUrl.pathname, session)

  if (decision.type === 'redirect') {
    return NextResponse.redirect(new URL(decision.to, request.url))
  }

  // Expose the signed-in role to server components: they run outside the
  // middleware chain in the App Router, so the header lets pages re-check
  // the role without trusting the URL. The value is set by this middleware
  // from the verified session cookie, never from user input.
  const headers = new Headers(request.headers)
  headers.set('x-user-role', session.role ?? '')
  headers.set('x-user-id', session.userId ?? '')
  return NextResponse.next({ request: { headers } })
}

export const config = {
  // Keep the middleware off static files and everything Next serves itself.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
