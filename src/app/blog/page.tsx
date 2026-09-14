import type { Metadata } from 'next'
import { BlogIndexClient } from '@/components/BlogIndexClient'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteNav } from '@/components/SiteNav'

export const metadata: Metadata = {
  title: 'PeterSmart Journal — Product news and practical guides',
  description: 'Updates, practical guides and release information from PeterSmart Link.',
}

export default function BlogPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="otya-shell flex-1 py-14 sm:py-20">
      <div className="max-w-3xl">
        <div className="otya-kicker">PeterSmart Link</div>
        <h1 className="mt-4 text-4xl sm:text-6xl font-black tracking-[-.06em] leading-[1.03]">The PeterSmart Journal.</h1>
        <p className="mt-5 text-base sm:text-xl leading-8 otya-muted">Product updates, practical guides and clear release information for Otya Player.</p>
      </div>
      <BlogIndexClient />
    </main>
    <SiteFooter />
  </div>
}
