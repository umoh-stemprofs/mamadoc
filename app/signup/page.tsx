import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { homeForRole } from '@/lib/roles'
import { getSession } from '@/lib/session'

export const metadata = { title: 'Create account' }

export default async function SignupPage() {
  const session = await getSession()
  if (session.userId && session.role) redirect(homeForRole(session.role))

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <h1 className="text-2xl font-semibold leading-8 text-ink">Create account</h1>
      <p className="mb-6 mt-1 text-muted">
        Patients create their own account. Doctor accounts are made by the clinic.
      </p>
      <AuthForm
        mode="signup"
        demoMode={false}
        demoAccounts={{ patient: '', doctor: '' }}
        emergencyNumber={process.env.EMERGENCY_NUMBER ?? '112'}
      />
    </div>
  )
}
