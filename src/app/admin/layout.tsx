import type { ReactNode } from 'react'

/**
 * Owner operations are intentionally unavailable in a browser.
 *
 * Privileged server APIs remain protected and are used by the private Next
 * Android application after owner verification and biometric step-up.
 */
export default function AdminLayout({ children: _children }: { children: ReactNode }) {
  return <main className="min-h-screen grid place-items-center px-5" style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}>
    <section className="max-w-md text-center">
      <div className="mx-auto flex gap-2 justify-center" aria-hidden="true">
        <span className="h-3 w-3 rounded-full bg-cyan-400" />
        <span className="h-3 w-3 rounded-full bg-blue-500" />
        <span className="h-3 w-3 rounded-full bg-violet-500" />
      </div>
      <h1 className="mt-5 text-2xl font-black tracking-[-.04em]">Owner control is in Next</h1>
      <p className="mt-3 text-sm leading-6 otya-muted">This browser workspace has been retired. Use the private Next app on your verified owner device for conversations, system health, approvals and protected actions.</p>
    </section>
  </main>
}
