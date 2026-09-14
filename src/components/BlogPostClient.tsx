'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Post = { slug: string; title: string; excerpt: string | null; content: string; category: string | null; author_name: string | null; created_at: string }

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export function BlogPostClient({ slug }: { slug: string }) {
  const [post, setPost] = useState<Post | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')

  useEffect(() => {
    fetch('/api/blog/' + encodeURIComponent(slug), { cache: 'no-store' })
      .then(async response => {
        if (response.status === 404) { setState('missing'); return }
        if (!response.ok) throw new Error('Unable to load article')
        const data = await response.json() as { post?: Post }
        setPost(data.post ?? null)
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [slug])

  if (state === 'loading') return <div className="flex items-center gap-3 text-sm otya-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--cosmos-primary)]" aria-hidden="true"/>Loading article</div>
  if (state === 'missing') return <div className="rounded-[26px] border border-black/[.07] p-7 dark:border-white/[.10]"><h1 className="text-3xl font-black">Article not found</h1><Link href="/blog" className="mt-5 inline-flex text-sm font-black">Back to journal →</Link></div>
  if (state === 'error' || !post) return <div className="rounded-[26px] border border-black/[.07] p-7 text-sm otya-muted dark:border-white/[.10]">This article is temporarily unavailable.</div>

  return <article className="mx-auto max-w-3xl">
    <Link href="/blog" className="text-sm font-black otya-muted hover:text-[color:var(--cosmos-primary)]">← PeterSmart Journal</Link>
    <div className="mt-10 text-xs font-black uppercase tracking-[.14em] otya-muted">{post.category || 'Product'}</div>
    <h1 className="mt-4 text-4xl sm:text-6xl font-black tracking-[-.06em] leading-[1.03]">{post.title}</h1>
    {post.excerpt && <p className="mt-6 text-lg sm:text-xl leading-8 otya-muted">{post.excerpt}</p>}
    <div className="mt-6 text-sm otya-muted">{post.author_name || 'PeterSmart Link'}{post.created_at ? ' · ' + dateLabel(post.created_at) : ''}</div>
    <div className="mt-10 border-t border-black/[.07] pt-8 text-base leading-8 dark:border-white/[.10]">{post.content.split(/\n{2,}/).map((paragraph, index) => <p key={index} className="mb-6 whitespace-pre-line">{paragraph}</p>)}</div>
  </article>
}
