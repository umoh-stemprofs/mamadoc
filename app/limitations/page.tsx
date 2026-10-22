import { ArrowLeft, FlaskConical, Lock, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Limitations' }

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card border-2 border-lav bg-surface p-6 shadow-card">
      <h2 className="flex items-center gap-2 text-2xl font-extrabold text-ink">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-muted">{children}</ul>
    </section>
  )
}

export default function LimitationsPage() {
  const emergency = process.env.EMERGENCY_NUMBER ?? '112'
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          Limitations of this prototype
        </h1>
        <p className="mt-1 text-muted">
          Read this before relying on anything you see in MamaDoc.
        </p>
      </div>

      <Section title="What is simulated" icon={<FlaskConical className="h-5 w-5" />}>
        <Bullet>
          <strong className="text-ink">Emails</strong> are never sent. Booking messages
          appear under &quot;Messages sent to my email (demo)&quot; as rows in the
          database only.
        </Bullet>
        <Bullet>
          <strong className="text-ink">The video call</strong> is a link stored per visit.
          There is no real video service behind &quot;Join call&quot; in this prototype.
        </Bullet>
        <Bullet>
          <strong className="text-ink">Sample data</strong>: the demo patients, doctors
          and visits come from a seed. The symptom list and triage wording are
          placeholders — a doctor or nurse must approve them before any real use.
        </Bullet>
        <Bullet>
          <strong className="text-ink">The queue</strong> is computed on read from
          today&apos;s bookings; nothing about priority is reviewed by a human.
        </Bullet>
      </Section>

      <Section title="What is protected" icon={<Lock className="h-5 w-5" />}>
        <Bullet>
          Health profile data is encrypted with AES-256-GCM before it is stored; the key
          lives only in the environment, never in this repository.
        </Bullet>
        <Bullet>
          Passwords are hashed with bcrypt (cost 10). The session cookie is httpOnly,
          sameSite lax, and secure in production.
        </Bullet>
        <Bullet>
          The database connection uses TLS. Role and ownership are re-checked on the
          server for every page, action and route.
        </Bullet>
      </Section>

      <Section title="What this is not" icon={<ShieldAlert className="h-5 w-5" />}>
        <Bullet>
          <strong className="text-ink">Prototype. Not for diagnosis or treatment.</strong>{' '}
          No clinician reviews anything entered here.
        </Bullet>
        <Bullet>
          For non-emergency visits only. In an emergency call{' '}
          <strong className="text-ink">{emergency}</strong>.
        </Bullet>
        <Bullet>
          Triage levels are simple rules (any symptom → urgent), not medical advice.
        </Bullet>
      </Section>

      <Link
        href="/login"
        className="flex min-h-[48px] items-center gap-2 self-start rounded-lg border-2 border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-lav-high"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>
    </div>
  )
}
