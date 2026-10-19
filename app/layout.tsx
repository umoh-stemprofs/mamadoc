import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SafetyNotice } from '@/components/SafetyNotice'
import { TopBar } from '@/components/TopBar'
import './globals.css'

// Self-hosted Inter (design.md §1) — next/font downloads at build time only.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'MamaDoc', template: '%s · MamaDoc' },
  description: 'Maternal triage and priority booking — prototype, not for diagnosis.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <TopBar />
        <main className="mx-auto w-full max-w-[960px] flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line bg-surface">
          <div className="mx-auto max-w-[960px] px-4 py-6">
            <SafetyNotice />
          </div>
        </footer>
      </body>
    </html>
  )
}
