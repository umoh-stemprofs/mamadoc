import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { homeForRole } from '@/lib/roles'
import { getSession } from '@/lib/session'

export const metadata = { title: 'Log in' }

// Demo accounts (seeded — also listed in README.md).
const DEMO_PATIENT = 'chioma.eze@mamadoc.demo'
const DEMO_DOCTOR = 'amaka.obi@mamadoc.demo'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const session = await getSession()
  if (session.userId && session.role) redirect(homeForRole(session.role))

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
