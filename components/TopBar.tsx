import { Bell, LogOut, Phone } from 'lucide-react'
import Link from 'next/link'
import { logoutAction } from '@/app/lib/actions'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

// MamaDoc logo from the maternal-care mockups (Google-hosted).
const LOGO =
  'https://lh3.googleusercontent.com/aida/AEtjO1WtGfkGRfiF8RpNzIuCdg_NNKHQykIVgqzisWr4KIz2FM9KnKnDi1swYgnCjAqZPmgd2PMUmu5y1ZyaQG5GP2d9MgFMjysJ98GN7umpfU0rZErouw2f51nEvz_2wpMVxKV5W8AsGChznj1J2RfN1IumiHL7aLzW7A9ngeNDr0yuBtMA_l0WL2Uql8Nh71gZvrufkGcaGcFZV4b8z4cANdKcSeOEywsBCNX1IEH6TwHBK8_1Ta9hHdLjiPpc'

/** Maternal-care top bar: emergency strip + logo row + nav pills + bell/logout. */
export async function TopBar() {
  const session = await getSession()
  const signedIn = Boolean(session.userId && session.role)
  const unread = signedIn
    ? await prisma.notification.count({
        where: { userId: session.userId as string, readAt: null },
      })
    : 0
  const isDoctor = session.role === 'DOCTOR'
  const home = isDoctor ? '/doctor' : '/'
  const number = process.env.EMERGENCY_NUMBER ?? '112'

  return (
    <header className="sticky top-0 z-30 w-full border-b border-line bg-surface shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* Emergency strip — always visible, always first */}
      <div className="w-full bg-[#ba1a1a] text-white">
        <div className="mx-auto flex max-w-[1024px] flex-wrap items-center justify-between gap-2 px-4 py-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Emergency? Need help now? Call {number}</span>
          </p>
          <a
            href={`tel:${number}`}
            className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white px-4 py-1 text-sm font-bold text-[#ba1a1a] transition hover:bg-danger-bg"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call {number} Free
          </a>
        </div>
      </div>

      {/* Logo + navigation row */}
      <div className="mx-auto flex max-w-[1024px] flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-4">
          <Link
            href={signedIn ? home : '/login'}
            className="flex min-h-[48px] items-center gap-2"
            aria-label="MamaDoc home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- external brand logo, no local asset */}
            <img src={LOGO} alt="" className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight text-accent">MamaDoc</span>
          </Link>
          {signedIn && (
            <nav className="hidden items-center gap-1 lg:flex">
              <Link
                href={home}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-lav-high hover:text-ink"
              >
                {isDoctor ? "Today's queue" : 'Home'}
              </Link>
              {isDoctor ? (
                <Link
                  href="/doctor/hours"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-lav-high hover:text-ink"
                >
                  My hours
                </Link>
              ) : (
                <Link
                  href="/book"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-lav-high hover:text-ink"
                >
                  Book a visit
                </Link>
              )}
              <Link
                href="/notifications"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-lav-high hover:text-ink"
              >
                Notifications
              </Link>
            </nav>
          )}
        </div>

        {signedIn && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/notifications"
              className="relative flex h-12 w-12 items-center justify-center rounded-full text-ink transition-colors hover:bg-lav-high"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
            <span className="hidden max-w-[180px] truncate text-sm font-semibold text-ink sm:block">
              {session.name}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex h-12 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted transition-colors hover:bg-danger-bg hover:text-danger"
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
