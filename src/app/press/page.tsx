import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'
import { OTYA } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Press & Media | PeterSmart Link',
  description: 'Factual background, official links and media contact information for PeterSmart Link and OTYA.',
  alternates: { canonical: 'https://petersmartlink.com/press' },
  openGraph: {
    type: 'website',
    url: 'https://petersmartlink.com/press',
    title: 'Press & Media | PeterSmart Link',
    description: 'Official media background and source links for PeterSmart Link and OTYA.',
  },
}

const facts = [
  ['Developer', 'PeterSmart Link'],
  ['Product family', 'OTYA'],
  ['Current featured product', 'Otya Player for Android'],
  ['Base', 'Uganda'],
  ['Design approach', 'Local-first media playback with connected services where useful'],
] as const

const productPoints = [
  'Local music and video playback on Android.',
  'Background playback with Android media-session controls.',
  'Nearby Send for supported local-network device-to-device workflows.',
  'Private media storage inside the Otya Player application environment.',
  'An Otya account for supported connected services without making core local playback depend on the cloud.',
] as const

export default function PressPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <section className="otya-reading py-12 sm:py-16">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2"><OtyaBrandMark size={36}/><span className="text-[11px] font-black uppercase tracking-[.15em] otya-muted">PeterSmart Link · Press & Media</span></div>
          <h1 className="mt-5 text-4xl sm:text-6xl font-black tracking-[-.06em]">Facts first.</h1>
          <p className="mt-4 max-w-[760px] text-sm sm:text-base leading-7 otya-muted">This page gives journalists, reviewers and researchers a concise factual reference for PeterSmart Link and OTYA. It does not replace independent reporting.</p>
        </header>

        <section aria-labelledby="about-company">
          <h2 id="about-company" className="text-2xl font-black">About PeterSmart Link</h2>
          <p className="mt-3 text-sm sm:text-base leading-7 otya-muted">PeterSmart Link is the developer and publisher behind OTYA. The organization is based in Uganda and develops practical software intended to remain understandable, secure and useful on real devices and variable network conditions.</p>
          <div className="mt-5 overflow-hidden rounded-[22px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025]">
            {facts.map(([label, value]) => <div key={label} className="grid sm:grid-cols-[190px_1fr] gap-1 sm:gap-5 px-5 py-4 border-b border-black/[.05] dark:border-white/[.07] last:border-b-0"><span className="text-xs font-black uppercase tracking-[.1em] otya-muted">{label}</span><span className="text-sm font-bold">{value}</span></div>)}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="about-otya">
          <h2 id="about-otya" className="text-2xl font-black">About Otya Player</h2>
          <p className="mt-3 text-sm sm:text-base leading-7 otya-muted">Otya Player is an Android media application in the OTYA product family. Its core experience is designed around local media and offline use, with connected services added where they provide clear value.</p>
          <ul className="mt-5 grid gap-2">
            {productPoints.map(point => <li key={point} className="rounded-[18px] border border-black/[.06] dark:border-white/[.08] bg-white/60 dark:bg-white/[.02] px-4 py-3 text-sm leading-6">{point}</li>)}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="official-sources">
          <h2 id="official-sources" className="text-2xl font-black">Official source links</h2>
          <p className="mt-3 text-sm leading-7 otya-muted">Use these links when checking identity, product information or official statements.</p>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <Link href="/official" className="rounded-[20px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-4"><strong className="block text-sm">Official identity page</strong><span className="mt-1 block text-xs otya-muted">Website, Telegram and authenticity links</span></Link>
            <Link href="/otya-player" className="rounded-[20px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-4"><strong className="block text-sm">Otya Player</strong><span className="mt-1 block text-xs otya-muted">Official product page</span></Link>
            <a href={OTYA.telegramChannel} target="_blank" rel="noopener noreferrer" className="rounded-[20px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-4"><strong className="block text-sm">Telegram channel · @otyaplayer</strong><span className="mt-1 block text-xs otya-muted">Official announcements and community updates</span></a>
            <a href={OTYA.telegramSupport} target="_blank" rel="noopener noreferrer" className="rounded-[20px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-4"><strong className="block text-sm">Telegram bot · @OtyaPlayerBot</strong><span className="mt-1 block text-xs otya-muted">Official OTYA bot</span></a>
          </div>
        </section>

        <section className="mt-10 rounded-[24px] border border-black/[.06] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.02] p-5 sm:p-7" aria-labelledby="media-contact">
          <h2 id="media-contact" className="text-2xl font-black">Media contact</h2>
          <p className="mt-3 text-sm leading-7 otya-muted">For interviews, factual clarification, product information or verification of an OTYA property, contact PeterSmart Link at <a className="font-black text-[color:var(--cosmos-text-primary)]" href={`mailto:${OTYA.supportEmail}?subject=Media%20enquiry%20-%20OTYA`}>{OTYA.supportEmail}</a>.</p>
          <p className="mt-3 text-xs leading-6 otya-muted">Editorial decisions, article wording and whether to publish remain entirely with the publication.</p>
        </section>
      </section>
    </main>
    <SiteFooter />
  </div>
}
