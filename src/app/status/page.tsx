import type { Metadata } from 'next'
import Link from 'next/link'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'
import { LiveStatusPanel } from './StatusClient'

export const metadata: Metadata = {
  title: 'Otya Status',
  description: 'Live public availability information for Otya services.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://status.petersmartlink.com' },
}

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
      <div className="mx-auto max-w-[980px] px-5 sm:px-7 py-8 sm:py-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="https://petersmartlink.com" className="inline-flex items-center gap-2" aria-label="Otya home">
            <OtyaBrandMark size={34} />
            <span className="text-lg font-black tracking-[-.04em]">Otya</span>
          </Link>
          <Link
            href="https://petersmartlink.com/help"
            className="inline-flex min-h-10 items-center rounded-full border border-black/[.08] dark:border-white/[.10] px-4 text-sm font-black"
          >
            Help
          </Link>
        </header>

        <section className="pt-14 sm:pt-20">
          <div className="text-[11px] font-black uppercase tracking-[.16em] opacity-60">Service status</div>
          <h1 className="mt-3 text-4xl sm:text-6xl font-black tracking-[-.06em] leading-[.95]">Otya service availability.</h1>
          <p className="mt-5 max-w-[720px] text-base sm:text-lg leading-8 opacity-70">
            Live checks below report the public website, account service and Next assistant without exposing private infrastructure details. Local media playback remains device-first and can continue when Otya online services are unavailable.
          </p>
        </section>

        <LiveStatusPanel />

        <section className="mt-10 rounded-[28px] border border-black/[.07] dark:border-white/[.09] bg-black/[.018] dark:bg-white/[.025] p-6 sm:p-7">
          <h2 className="text-xl font-black tracking-[-.025em]">Useful public checks</h2>
          <p className="mt-2 text-sm leading-6 otya-muted">
            These destinations expose only information intended for customers and can be checked without private admin access.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Link href="https://petersmartlink.com" className="rounded-2xl bg-[color:var(--cosmos-surface)] px-4 py-3 text-sm font-black">Website</Link>
            <Link href="https://petersmartlink.com/download/otya-player" className="rounded-2xl bg-[color:var(--cosmos-surface)] px-4 py-3 text-sm font-black">Downloads & updates</Link>
            <Link href="https://docs.petersmartlink.com" className="rounded-2xl bg-[color:var(--cosmos-surface)] px-4 py-3 text-sm font-black">Documentation</Link>
          </div>
        </section>

        <footer className="pt-10 pb-8 text-xs leading-6 otya-muted">
          Account-specific information, private operational metrics and internal infrastructure details are intentionally not shown here. Use Otya Help for customer support.
        </footer>
      </div>
    </main>
  )
}
