'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Post = { id: number; slug: string; title: string; excerpt: string | null; category: string | null; author_name: string | null; created_at: string }

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'PeterSmart Link' : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function BlogIndexClient() {
  const [posts, setPosts] = useState<Post[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    fetch('/api/blog', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load articles')
        const data = await response.json() as { posts?: Post[] }
        setPosts(data.posts ?? [])
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [])

  if (state === 'loading') return <div className="mt-10 flex items-center gap-3 text-sm otya-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--cosmos-primary)]" aria-hidden="true"/>Loading articles</div>
  if (state === 'error') return <div className="mt-10 rounded-2xl border border-black/[.07] p-5 text-sm otya-muted dark:border-white/[.10]">Articles are temporarily unavailable. Please try again later.</div>
  if (posts.length === 0) return <div className="mt-10 rounded-[26px] border border-black/[.07] bg-black/[.018] p-7 sm:p-10 dark:border-white/[.10] dark:bg-white/[.025]"><h2 className="text-2xl font-black tracking-[-.04em]">The first articles are on their way.</h2><p className="mt-3 max-w-xl text-sm leading-7 otya-muted">Product updates, practical guides and clear release information will be published here by PeterSmart Link.</p></div>

  return <div className="mt-10 grid gap-4">
    {posts.map(post => <article key={post.id} className="rounded-[26px] border border-black/[.07] bg-[color:var(--cosmos-surface)] p-6 sm:p-8 dark:border-white/[.10]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold otya-muted"><span>{post.category || 'Product'}</span><span aria-hidden="true">·</span><span>{dateLabel(post.created_at)}</span></div>
      <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-[-.045em]"><Link href={\`/blog/\${post.slug}\`} className="hover:text-[color:var(--cosmos-primary)]">{post.title}</Link></h2>
      {post.excerpt && <p className="mt-3 max-w-3xl text-sm sm:text-base leading-7 otya-muted">{post.excerpt}</p>}
      <Link href={\`/blog/\${post.slug}\`} className="mt-5 inline-flex text-sm font-black">Read article →</Link>
    </article>)}
  </div>
}
