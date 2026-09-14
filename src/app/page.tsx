import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'
import { HomeStart } from '@/components/HomeStart'

export const metadata: Metadata = {
  title: 'PeterSmart Link — Practical software products',
  description: 'PeterSmart Link is the developer and publisher behind Otya Player, Otya Space and Next.',
  keywords: ['PeterSmart Link', 'Otya Player', 'Otya', 'Uganda software developer', 'Android media player'],
  alternates: { canonical: 'https://petersmartlink.com' },
  openGraph: {
    type: 'website',
    url: 'https://petersmartlink.com',
    title: 'PeterSmart Link — Practical software products',
    description: 'The developer and publisher behind Otya Player, Otya Space and Next.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'PeterSmart Link and Otya' }],
  },
}

export default function HomePage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <section className="relative overflow-hidden border-b border-black/[.05] dark:border-white/[.07]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_10%,rgba(41,121,255,.07),transparent_31%),radial-gradient(circle_at_88%_18%,rgba(46,168,201,.06),transparent_27%),radial-gradient(circle_at_68%_90%,rgba(41,121,255,.04),transparent_25%)]" />
        <div className="otya-shell relative py-12 sm:py-16 lg:py-20 grid lg:grid-cols-[1.02fr_.98fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[.06] dark:border-white/[.08] px-3 py-2 text-xs font-black bg-white/55 dark:bg-white/[.03]">PeterSmart Link · Uganda</div>
            <h1 className="mt-7 max-w-[800px] text-[clamp(44px,7vw,84px)] font-bold tracking-[-.055em] leading-[1.04]">Practical software.<br/><span className="otya-muted">Made for your day.</span></h1>
            <p className="mt-7 max-w-[700px] text-base sm:text-xl leading-8 otya-muted">Meet Otya from PeterSmart Link. Enjoy your local music and videos, manage your account in Space, and find a helping hand with Next.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/download/otya-player" className="cosmos-button inline-flex min-h-12 items-center rounded-full px-6 text-sm font-black">Get Otya Player</Link>
              <Link href="/company" className="inline-flex min-h-12 items-center rounded-full border border-black/[.08] dark:border-white/[.10] px-5 text-sm font-black bg-white/55 dark:bg-white/[.03]">About PeterSmart Link</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs otya-muted"><span>Made for Android</span><span>Local playback, even offline</span><span>Built by PeterSmart Link</span></div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(41,121,255,.13),transparent_65%)] blur-2xl" />
            <div className="relative rounded-[34px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] dark:bg-white/[.035] p-4 sm:p-5 shadow-[0_30px_90px_rgba(8,11,18,.16)] backdrop-blur-xl">
              <div className="flex items-center justify-between px-2 pb-4"><div><div className="text-xs font-black otya-muted">Featured product</div><div className="mt-1 text-2xl font-black tracking-[-.04em]">Otya Player</div></div><span className="text-xs font-bold otya-muted">Actual app screen</span></div>
              <div className="mx-auto max-w-[310px] overflow-hidden rounded-[26px] border border-white/10 bg-[#06152d] shadow-2xl"><Image src="/product/otya/onboarding.svg" alt="Otya Player welcome screen on Android" width={540} height={960} priority className="w-full h-auto" /></div>
              <div className="pt-5 px-2 pb-1 flex flex-wrap gap-3"><Link href="/otya-player" className="text-sm font-black">View product →</Link><Link href="/download/otya-player" className="text-sm font-black otya-muted">Download</Link></div>
            </div>
          </div>
        </div>
      </section>

      <HomeStart />

      <section className="otya-shell py-10 sm:py-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="otya-kicker">Otya Player</div><h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-[-.055em]">A real player, not a concept.</h2><p className="mt-4 max-w-[680px] text-sm sm:text-base leading-7 otya-muted">Listen, organize your media and move it between nearby phones. These are screens from Otya Player on Android.</p></div><Link href="/otya-player" className="text-sm font-black">Explore Otya →</Link></div>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {[['now-playing.svg','Now playing'],['music.svg','Music library'],['transfer.svg','Otya Transfer'],['me.svg','Your media']].map(([screen,label]) => <div key={screen} className="overflow-hidden rounded-[24px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-2 sm:p-3"><Image src={`/product/otya/${screen}`} alt={`Otya Player ${label} screen`} width={540} height={960} className="w-full h-auto rounded-[17px]" /><div className="px-2 pt-3 pb-2 text-sm font-black">{label}</div></div>)}
        </div>
      </section>

      <section className="border-y border-black/[.05] dark:border-white/[.07] bg-black/[.018] dark:bg-white/[.018]">
        <div className="otya-shell py-10 sm:py-14 grid lg:grid-cols-3 gap-4">
          <Link href="/otya-player" className="rounded-[28px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-7 sm:p-8 min-h-[280px] flex flex-col"><div className="text-xs font-black otya-muted">Product</div><h2 className="mt-1 text-2xl font-black">Otya Player</h2><p className="mt-3 text-base leading-7 otya-muted">Local music and video, background playback, nearby Transfer, Private media and useful tools.</p><span className="mt-auto pt-7 text-sm font-black">Explore →</span></Link>
          <Link href="https://space.petersmartlink.com" className="rounded-[28px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-7 sm:p-8 min-h-[280px] flex flex-col"><div className="h-11 w-11 rounded-2xl grid place-items-center border border-black/[.07] dark:border-white/[.09] font-black">S</div><div className="mt-6 text-xs font-black otya-muted">Your account</div><h2 className="mt-1 text-2xl font-black">Space</h2><p className="mt-3 text-base leading-7 otya-muted">Your account details, signed-in devices and security settings, together in one place.</p><span className="mt-auto pt-7 text-sm font-black">Open Space →</span></Link>
          <Link href="/ask" className="rounded-[28px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-7 sm:p-8 min-h-[280px] flex flex-col"><div className="flex gap-1.5" aria-hidden="true"><span className="h-3 w-3 rounded-full bg-cyan-400"/><span className="h-3 w-3 rounded-full bg-blue-500"/><span className="h-3 w-3 rounded-full bg-violet-500"/></div><div className="mt-5 text-xs font-black otya-muted">Assistant</div><h2 className="mt-1 text-2xl font-black">Next</h2><p className="mt-3 text-base leading-7 otya-muted">Ask a question, get help with Otya, or work through an everyday idea.</p><span className="mt-auto pt-7 text-sm font-black">Open Next →</span></Link>
        </div>
      </section>

      <section className="otya-shell py-10 sm:py-14">
        <div className="rounded-[32px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-6 sm:p-8 lg:p-10 grid lg:grid-cols-[1fr_auto] gap-8 items-center">
          <div><div className="otya-kicker">Resources</div><h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-[-.055em]">A helping hand, whenever you need it.</h2><p className="mt-4 max-w-[720px] text-sm sm:text-base leading-7 otya-muted">Find step-by-step guides and support options. Our service information page explains what you can check when something is not working.</p></div>
          <div className="flex flex-wrap lg:flex-col gap-3"><Link href="https://docs.petersmartlink.com" className="cosmos-button inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black">Documentation</Link><Link href="https://status.petersmartlink.com" className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/[.08] dark:border-white/[.10] px-5 text-sm font-black">Service information</Link></div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
