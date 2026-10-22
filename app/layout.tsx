import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { SafetyNotice } from '@/components/SafetyNotice'
import { TopBar } from '@/components/TopBar'
import './globals.css'

// Self-hosted Plus Jakarta Sans (maternal-care design.md) — downloaded at build time.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'MamaDoc', template: '%s · MamaDoc' },
  description: 'Maternal triage and priority booking — prototype, not for diagnosis.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <TopBar />
        <main className="mx-auto w-full max-w-[1024px] flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line bg-lav-low">
          <div className="mx-auto flex max-w-[1024px] flex-col gap-4 px-4 py-8">
            <SafetyNotice />
            <p className="text-sm font-medium text-muted">
              MamaDoc Telehealth · Safe &amp; simple care · Prototype with simulated email and
              sample data.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
