// Pure role and route helpers — no Prisma, no bcrypt, no next/headers — so
// the edge middleware can import them and tests can exercise the exact rule
// the middleware applies.
export type Role = 'PATIENT' | 'DOCTOR'

export type SessionLike = { userId?: string; role?: Role } | null | undefined

export function homeForRole(role: Role): string {
  return role === 'PATIENT' ? '/' : '/doctor'
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/limitations' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  )
}

export type RouteDecision =
  | { type: 'public' }
  | { type: 'next' }
  | { type: 'redirect'; to: string }

/**
 * The rule the middleware enforces:
 * no session → /login; a patient off doctor pages → /;
 * a doctor off patient pages → /doctor. Public pages stay reachable, and
 * /notifications is shared by both roles.
 */
export function routeDecision(pathname: string, session: SessionLike): RouteDecision {
  if (isPublicPath(pathname)) return { type: 'public' }
  if (!session?.userId || !session.role) {
    return { type: 'redirect', to: `/login?next=${encodeURIComponent(pathname)}` }
  }
  if (pathname === '/notifications') return { type: 'next' } // shared by both roles
  const doctorArea = pathname === '/doctor' || pathname.startsWith('/doctor/')
  if (session.role === 'PATIENT' && doctorArea) return { type: 'redirect', to: '/' }
  if (session.role === 'DOCTOR' && !doctorArea) return { type: 'redirect', to: '/doctor' }
  return { type: 'next' }
}
