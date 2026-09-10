import Link from 'next/link'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

const GROUPS = [
  {
    title: 'Products',
    links: [
      ['Otya Player', '/otya-player'],
      ['Download', '/download/otya-player'],
      ['Next', 'https://space.petersmartlink.com/ask'],
      ['Space', 'https://space.petersmartlink.com'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Documentation', 'https://docs.petersmartlink.com'],
      ['Developers', '/developers'],
      ['Help & support', '/help'],
      ['Service status', 'https://status.petersmartlink.com'],
    ],
  },
  {
    title: 'PeterSmart Link',
    links: [
      ['Company', '/company'],
      ['Contact', '/contact'],
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Delete account', '/delete-account'],
    ],
  },
] as const

export function SiteFooter() {
  return <footer className="mt-16 border-t border-black/[.06] dark:border-white/[.08] bg-black/[.015] dark:bg-white/[.015]">
    <div className="otya-shell py-10 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_2fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 w-fit">
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-[color:var(--cosmos-surface)] border border-[color:var(--cosmos-divider)] shadow-[0_0_24px_rgba(18,107,255,.10)]"><OtyaBrandMark size={34}/></span>
            <span className="leading-normal"><span className="block font-bold text-lg tracking-[-.02em]">PeterSmart Link</span><span className="block text-sm font-semibold otya-muted">Otya Player</span></span>
          </Link>
          <p className="mt-3 max-w-[360px] text-sm leading-6 otya-muted">Developer and publisher of practical software products including Otya Player, Otya Space and Next.</p>
          <p className="mt-4 text-xs font-bold otya-muted">Built in Uganda.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-8">
          {GROUPS.map(group => <div key={group.title}><div className="text-sm tracking-wide font-bold otya-muted">{group.title}</div><div className="mt-3 grid gap-1">{group.links.map(([label, href]) => <Link key={`${group.title}-${label}`} href={href} className="inline-flex min-h-11 items-center text-sm font-semibold hover:text-[color:var(--cosmos-primary)]">{label}</Link>)}</div></div>)}
        </div>
      </div>
      <div className="mt-10 pt-5 border-t border-black/[.05] dark:border-white/[.06] flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-sm otya-muted">
        <span>© {new Date().getFullYear()} PeterSmart Link</span>
        <span>PeterSmart Link is the developer. Otya is a product family.</span>
      </div>
    </div>
  </footer>
}
