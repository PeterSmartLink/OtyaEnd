import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

export const metadata: Metadata = {
  title: 'Help | Otya Player',
  description: 'Quick help for Otya Player accounts, local music and video, Send, Private and Android playback.',
  alternates: { canonical: 'https://petersmartlink.com/help' },
}

const quickHelp = [
  ['I cannot sign in', 'Email, Google and Telegram are sign-in methods for the same Otya account. Use the method already connected to your account. When adding another provider to an existing account, sign in first and link it from your account settings rather than creating a second account.'],
  ['I did not receive a verification code', 'Registration sends one verification code automatically. Check spam or promotions first, then request a new code only if you still need one. When a newer code is issued, use that newest code.'],
  ['I did not receive a password-reset email', 'Request one fresh reset code and check spam or promotions. Avoid repeatedly requesting codes because only the newest valid reset request should be used.'],
  ['Music or videos are missing in the Android app', 'Allow the media permissions requested by Android, then refresh or rescan the local library. Local media scanning does not require an Otya account.'],
  ['Playback stops in the background', 'Otya Player uses Android media-session controls for playback. If playback is interrupted, review Android battery or background restrictions for Otya Player. Ordinary product or marketing notification permission is separate from starting local playback.'],
  ['Send is not connecting', 'Keep both devices on the same Wi-Fi or hotspot and start Send from Me. Nearby Send is local-network only and does not require mobile data or a cloud relay.'],
  ['How does Private work?', 'Private keeps supported local media inside Otya Player app-private storage until you restore it. Keep a separate backup of important files before moving or changing device storage.'],
  ['Security and safe downloads', 'Install Otya Player only from the official download page. Never share passwords, one-time codes, recovery codes, API keys, secret tokens or signing credentials.'],
] as const

export default function HelpPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <section className="otya-reading py-10 sm:py-14">
        <header className="mb-8">
          <div className="text-[11px] font-black uppercase tracking-[.15em] otya-muted">Otya Player Help</div>
          <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-[-.055em]">How can we help?</h1>
          <p className="mt-3 text-sm sm:text-base leading-6 otya-muted">Start with quick answers, your Otya account, or the official documentation.</p>
        </header>

        <div className="grid sm:grid-cols-2 gap-3 mb-7">
          <Link href="/sign-in" className="rounded-[24px] border border-black/[.06] dark:border-white/[.08] bg-white/75 dark:bg-white/[.025] p-5 min-h-28 flex flex-col justify-between">
            <OtyaBrandMark size={40}/>
            <span><strong className="block text-base">Otya Account</strong><span className="text-xs otya-muted">Sign in, create an account or recover access</span></span>
          </Link>
          <Link href="https://docs.petersmartlink.com" className="rounded-[24px] border border-black/[.06] dark:border-white/[.08] bg-white/75 dark:bg-white/[.025] p-5 min-h-28 flex flex-col justify-between">
            <OtyaBrandMark size={40}/>
            <span><strong className="block text-base">Documentation</strong><span className="text-xs otya-muted">Read official Otya setup, playback, Send and account guidance</span></span>
          </Link>
        </div>

        <section className="overflow-hidden rounded-[24px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.02]" aria-labelledby="quick-help">
          <h2 id="quick-help" className="sr-only">Quick help</h2>
          {quickHelp.map(([title,text])=><details key={title} id={title.startsWith('Security')?'security':undefined} className="group border-b border-black/[.05] dark:border-white/[.07] last:border-b-0"><summary className="cursor-pointer list-none px-4 sm:px-5 py-4 flex items-center justify-between gap-4 font-black text-sm"><span>{title}</span><span className="otya-muted group-open:rotate-45 transition-transform">＋</span></summary><p className="px-4 sm:px-5 pb-5 text-sm leading-7 otya-muted">{text}</p></details>)}
        </section>

        <section id="contact" className="mt-9" aria-labelledby="contact-title">
          <div className="flex items-end justify-between gap-4 mb-3"><h2 id="contact-title" className="text-xl font-black">Contact Otya</h2><span className="text-xs otya-muted">Human support</span></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <a href="https://t.me/OtyaPlayerBot" target="_blank" rel="noopener noreferrer" className="rounded-[20px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-4 min-h-20 flex items-center gap-3"><span className="w-9 h-9 rounded-full grid place-items-center bg-[#229ED9]/10 text-[#229ED9] font-black">➤</span><span className="font-black text-sm">Telegram</span></a>
            <a href="mailto:support@petersmartlink.com?subject=Otya%20Support" className="rounded-[20px] border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.025] p-4 min-h-20 flex items-center gap-3"><span className="w-9 h-9 rounded-full grid place-items-center bg-black/[.045] dark:bg-white/[.06] font-black">✉</span><span className="font-black text-sm">Email</span></a>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold">
          <Link href="https://status.petersmartlink.com">Status</Link>
          <Link href="https://docs.petersmartlink.com">Documentation</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
