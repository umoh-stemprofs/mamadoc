import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { getCurrentUser } from '@/lib/auth'
import { homeForRole } from '@/lib/roles'

export const metadata = { title: 'Log in' }

// Demo accounts (seeded — also listed in README.md).
const DEMO_PATIENT = 'chioma.eze@mamadoc.demo'
const DEMO_DOCTOR = 'amaka.obi@mamadoc.demo'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  // Redirect only when the session still resolves to a real account: a stale
  // cookie (e.g. after re-seeding) must land on this form, not bounce between
  // here and / forever.
  const user = await getCurrentUser()
  if (user) redirect(homeForRole(user.role))

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <h1 className="text-2xl font-semibold leading-8 text-ink">Log in</h1>
      <p className="mb-6 mt-1 text-muted">
        Book antenatal visits and keep your checkups in one place.
      </p>
      <AuthForm
        mode="login"
        demoMode={process.env.DEMO_MODE === 'true'}
        demoAccounts={{ patient: DEMO_PATIENT, doctor: DEMO_DOCTOR }}
        emergencyNumber={process.env.EMERGENCY_NUMBER ?? '112'}
        next={searchParams.next}
      />
    </div>
  )
}
