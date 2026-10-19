import { Bell, HeartPulse, LogOut } from 'lucide-react'
import Link from 'next/link'
import { logoutAction } from '@/app/lib/actions'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

/** D-HEALTH top bar: logo left, notification bell + user menu right. */
export async function TopBar() {
  const session = await getSession()
  const signedIn = Boolean(session.userId && session.role)
  const unread = signedIn
    ? await prisma.notification.count({
        where: { userId: session.userId as string, readAt: null },
      })
    : 0
  const home = session.role === 'DOCTOR' ? '/doctor' : '/'

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-[960px] items-center justify-between gap-4 px-4">
        <Link
          href={signedIn ? home : '/login'}
          className="flex min-h-[48px] items-center gap-2"
          aria-label="MamaDoc home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white">
            <HeartPulse className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-ink">MamaDoc</span>
        </Link>

        {signedIn && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/notifications"
              className="relative flex h-12 w-12 items-center justify-center rounded-lg text-ink hover:bg-bg"
              aria-label={
                unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
              }
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <span className="hidden max-w-[180px] truncate text-sm text-muted sm:block">
              {session.name}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex h-12 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted hover:bg-bg"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
                <span className="sr-only sm:hidden">Log out</span>
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  )
}
