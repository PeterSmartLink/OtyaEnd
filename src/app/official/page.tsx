import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'
import { OTYA } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Official OTYA links | PeterSmart Link',
  description: 'Authoritative PeterSmart Link page for official OTYA web, Telegram, support and product links.',
  alternates: { canonical: 'https://petersmartlink.com/official' },
  openGraph: {
    type: 'website',
    url: 'https://petersmartlink.com/official',
    title: 'Official OTYA links | PeterSmart Link',
    description: 'Authoritative links for OTYA products and official Telegram properties operated by PeterSmart Link.',
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'PeterSmart Link',
  url: OTYA.website,
  email: OTYA.supportEmail,
  sameAs: [OTYA.telegramChannel, OTYA.telegramSupport],
  brand: {
    '@type': 'Brand',
    name: 'OTYA',
  },
}

export default function OfficialLinksPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
    <SiteNav />
    <main className="flex-1">
      <section className="otya-reading py-12 sm:py-16">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2"><OtyaBrandMark size={36}/><span className="text-[11px] font-black uppercase tracking-[.15em] otya-muted">PeterSmart Link · Official identity</span></div>
          <h1 className="mt-5 text-4xl sm:text-6xl font-black tracking-[-.06em]">Official OTYA links</h1>
          <p className="mt-4 max-w-[760px] text-sm sm:text-base leading-7 otya-muted">PeterSmart Link is the developer and publisher behind OTYA. This page is the authoritative public reference for our official OTYA website, Telegram channel, Telegram bot and support contact.</p>
        </header>

        <section className="grid gap-3" aria-label="Official OTYA links">
          <a href={OTYA.telegramChannel} target="_blank" rel="noopener noreferrer" className="rounded-[24px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-5 sm:p-6 flex items-center gap-4">
            <span className="w-12 h-12 shrink-0 rounded-full grid place-items-center bg-[#229ED9]/10 text-[#229ED9] text-xl font-black">➤</span>
            <span><span className="block text-xs font-black uppercase tracking-[.12em] otya-muted">Official Telegram channel</span><strong className="block mt-1 text-xl">@otyaplayer</strong><span className="block mt-1 text-sm otya-muted">OTYA announcements, releases and community updates</span></span>
          </a>

          <a href={OTYA.telegramSupport} target="_blank" rel="noopener noreferrer" className="rounded-[24px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-5 sm:p-6 flex items-center gap-4">
            <span className="w-12 h-12 shrink-0 rounded-full grid place-items-center bg-[#229ED9]/10 text-[#229ED9] text-xl font-black">✦</span>
            <span><span className="block text-xs font-black uppercase tracking-[.12em] otya-muted">Official Telegram bot</span><strong className="block mt-1 text-xl">@OtyaPlayerBot</strong><span className="block mt-1 text-sm otya-muted">Official OTYA assistance and supported bot services</span></span>
          </a>

          <Link href="/otya-player" className="rounded-[24px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-5 sm:p-6 flex items-center gap-4">
            <span className="w-12 h-12 shrink-0 rounded-2xl grid place-items-center border border-black/[.06] dark:border-white/[.08]"><OtyaBrandMark size={34}/></span>
            <span><span className="block text-xs font-black uppercase tracking-[.12em] otya-muted">Official product page</span><strong className="block mt-1 text-xl">Otya Player</strong><span className="block mt-1 text-sm otya-muted">Product information and official distribution links on petersmartlink.com</span></span>
          </Link>
        </section>

        <section className="mt-8 rounded-[24px] border border-black/[.06] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.02] p-5 sm:p-6">
          <h2 className="text-xl font-black">Ownership and authenticity</h2>
          <p className="mt-3 text-sm leading-7 otya-muted">The Telegram properties listed above are operated as official OTYA properties by PeterSmart Link. Links not listed on this page should not be assumed to represent OTYA or PeterSmart Link.</p>
          <p className="mt-3 text-sm leading-7 otya-muted">For verification, media or authenticity questions, contact <a className="font-black text-[color:var(--cosmos-text-primary)]" href={`mailto:${OTYA.supportEmail}`}>{OTYA.supportEmail}</a>.</p>
        </section>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
          <Link href="/company">About PeterSmart Link</Link>
          <Link href="/help">Help</Link>
          <Link href="/contact">Contact</Link>
          <Link href="https://docs.petersmartlink.com">Documentation</Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
