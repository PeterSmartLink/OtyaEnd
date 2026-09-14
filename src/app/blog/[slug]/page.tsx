import { SiteFooter } from '@/components/SiteFooter'
import { SiteNav } from '@/components/SiteNav'
import { BlogPostClient } from '@/components/BlogPostClient'

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]"><SiteNav/><main className="otya-shell flex-1 py-14 sm:py-20"><BlogPostClient slug={slug}/></main><SiteFooter/></div>
}
