'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Otya website route error', error)
  }, [error])

  return (
    <main className="min-h-[100dvh] grid place-items-center px-6 py-12" style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}>
      <section className="w-full max-w-lg rounded-[28px] border p-6 sm:p-8 text-center" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-surface)' }}>
        <OtyaBrandMark size={52} label="Otya Player" />
        <h1 className="mt-5 text-2xl sm:text-3xl font-black tracking-[-.04em]">Something did not load.</h1>
        <p className="mt-3 text-sm leading-6 otya-muted">Please try loading this page again. If you were saving a change, check its status before submitting it again. Help is here if the problem continues.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="cosmos-button min-h-11 rounded-full px-5 text-sm font-black">Try again</button>
          <Link href="/" className="otya-quiet-button inline-flex min-h-11 items-center rounded-full px-5 text-sm font-black">Home</Link>
          <Link href="/help" className="otya-quiet-button inline-flex min-h-11 items-center rounded-full px-5 text-sm font-black">Help</Link>
        </div>
      </section>
    </main>
  )
}
