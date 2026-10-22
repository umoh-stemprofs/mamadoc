import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { getCurrentUser } from '@/lib/auth'
import { homeForRole } from '@/lib/roles'

export const metadata = { title: 'Create account' }

export default async function SignupPage() {
  // DB-verified session, same as /login — a stale cookie must not redirect-loop.
  const user = await getCurrentUser()
  if (user) redirect(homeForRole(user.role))

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Create account</h1>
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
