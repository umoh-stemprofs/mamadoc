'use client'

// Login / signup form (S-LOGIN-W, S-SIGNUP-W). Server actions do the real
// work; this only collects input and shows the one-sentence error.
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useFormState } from 'react-dom'
import {
  demoLoginAction,
  loginAction,
  signupAction,
  type ActionState,
} from '@/app/lib/actions'

type Props = {
  mode: 'login' | 'signup'
  demoMode: boolean
  demoAccounts: { patient: string; doctor: string }
  emergencyNumber: string
  next?: string
}

const inputClass =
  'block w-full rounded-input border border-line bg-surface px-3 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent'
const labelClass = 'mb-1 block text-sm font-medium text-muted'
const primaryButton =
  'flex min-h-[56px] w-full items-center justify-center rounded-lg bg-accent px-4 text-base font-semibold text-white transition hover:opacity-90 sm:min-h-[48px]'
const secondaryButton =
  'flex min-h-[48px] w-full items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition hover:bg-bg'

export function AuthForm({
  mode,
  demoMode,
  demoAccounts,
  emergencyNumber,
  next,
}: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    mode === 'login' ? loginAction : signupAction,
    undefined,
  )
  const [showPassword, setShowPassword] = useState(false)
  const isLogin = mode === 'login'

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-card">
      <form action={formAction} className="flex flex-col gap-4">
        {state?.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}

        {!isLogin && (
          <div>
            <label className={labelClass} htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className={inputClass}
              placeholder="Chioma Eze"
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        {!isLogin && (
          <div>
            <label className={labelClass} htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              className={inputClass}
              placeholder="0803 123 4567"
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={isLogin ? 1 : 8}
              className={`${inputClass} pr-12`}
              placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-bg"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
          {!isLogin && (
            <p className="mt-1 text-sm text-muted">Password must be at least 8 characters.</p>
          )}
        </div>

        {!isLogin && next !== undefined && <input type="hidden" name="next" value={next} />}
        {isLogin && next && <input type="hidden" name="next" value={next} />}

        <button type="submit" className={primaryButton}>
          {isLogin ? 'Log in' : 'Create account'}
        </button>
      </form>

      {isLogin && demoMode && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm text-muted">Demo accounts (sample data):</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form action={demoLoginAction} className="flex-1">
              <input type="hidden" name="role" value="PATIENT" />
              <input type="hidden" name="email" value={demoAccounts.patient} />
              <button type="submit" className={secondaryButton}>
                Try demo patient
              </button>
            </form>
            <form action={demoLoginAction} className="flex-1">
              <input type="hidden" name="role" value="DOCTOR" />
              <input type="hidden" name="email" value={demoAccounts.doctor} />
              <button type="submit" className={secondaryButton}>
                Try demo doctor
              </button>
            </form>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-muted">
        {isLogin ? (
          <>
            New here?{' '}
            <Link href="/signup" className="font-medium text-accent underline">
              Create an account
            </Link>
            .{' '}
            Doctor accounts are created by the clinic.
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-accent underline">
              Log in
            </Link>
            .
          </>
        )}
      </p>

      <div className="mt-4 border-t border-line pt-4 text-sm text-muted">
        <p>
          For non-emergency visits only. In an emergency call{' '}
          <strong className="font-semibold text-ink">{emergencyNumber}</strong>.
        </p>
        <p className="mt-1">Prototype. Not for diagnosis or treatment.</p>
      </div>
    </div>
  )
}
