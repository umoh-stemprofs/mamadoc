import { Bell, FlaskConical, Mail } from 'lucide-react'
import { markNotificationReadAction } from '@/app/lib/actions'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatTimestamp } from '@/lib/format'

export const metadata = { title: 'Notifications' }

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const user = await requireUser()
  const timeZone = process.env.APP_TZ || 'Africa/Lagos'
  const showEmails = searchParams.tab === 'emails'

  const [notifications, emails] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.emailOutbox.findMany({
      where: { toUserId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  const unread = notifications.filter((n) => !n.readAt).length

  const tabClass = (active: boolean) =>
    `flex min-h-[48px] items-center gap-2 rounded-lg px-4 text-sm font-medium ${
      active ? 'bg-accent text-white' : 'text-muted hover:bg-bg'
    }`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-ink">Notifications</h1>
        <p className="mt-1 text-muted">
          {showEmails
            ? 'Simulated emails — nothing is actually sent.'
            : unread > 0
              ? `You have ${unread} unread message${unread === 1 ? '' : 's'}.`
              : 'You are all caught up.'}
        </p>
      </div>

      <div role="tablist" aria-label="Notification views" className="flex flex-wrap gap-2">
        <a
          role="tab"
          aria-selected={!showEmails}
          href="/notifications"
          className={tabClass(!showEmails)}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          Notifications
        </a>
        <a
          role="tab"
          aria-selected={showEmails}
          href="/notifications?tab=emails"
          className={tabClass(showEmails)}
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Messages sent to my email (demo)
        </a>
      </div>

      {!showEmails ? (
        notifications.length === 0 ? (
          <EmptyCard text="No notifications yet." />
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface shadow-card">
            {notifications.map((n) => {
              const inner = (
                <>
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-line' : 'bg-accent'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${n.readAt ? 'text-muted' : 'text-ink'}`}>
                        {n.title}
                      </span>
                      {!n.readAt && (
                        <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-medium text-info">
                          New
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {formatTimestamp(n.createdAt, timeZone)}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={n.id}>
                  {n.readAt ? (
                    <div className="flex w-full gap-3 p-4">{inner}</div>
                  ) : (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        aria-label={`Open notification: ${n.title}`}
                        className="flex w-full gap-3 p-4 text-left transition hover:bg-bg"
                      >
                        {inner}
                      </button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )
      ) : emails.length === 0 ? (
        <EmptyCard text="No simulated emails yet." />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface shadow-card">
          {emails.map((mail) => (
            <li key={mail.id} className="flex flex-col gap-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{mail.subject}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-medium text-info">
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                  Simulated
                </span>
              </div>
              <p className="whitespace-pre-line text-sm text-muted">{mail.body}</p>
              <p className="text-xs text-muted">{formatTimestamp(mail.createdAt, timeZone)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
      <Bell className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
      <p className="mt-2 text-muted">{text}</p>
    </div>
  )
}
