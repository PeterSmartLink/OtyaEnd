import { AccountNotices } from '@/components/AccountNotices'

export default function NotificationsPage() {
  return <main className="px-4 sm:px-7 lg:px-10 py-7 sm:py-9 max-w-[900px]">
    <header className="mb-7"><div className="text-sm font-semibold otya-muted">Otya Space</div><h1 className="mt-2 text-3xl sm:text-4xl font-bold">Notices</h1><p className="mt-2 text-base leading-7 otya-muted">See the latest release and review recent sign-ins. Playback controls and alerts stay on your phone.</p></header>
    <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
      <AccountNotices />
    </section>
  </main>
}
