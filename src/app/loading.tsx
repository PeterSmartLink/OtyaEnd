import { OtyaBrandMark } from '@/components/OtyaBrandMark'

export default function Loading() {
  return (
    <main
      className="min-h-[100dvh] grid place-items-center px-6"
      style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}
    >
      <div className="text-center" role="status" aria-live="polite">
        <OtyaBrandMark size={64} label="Loading Otya" />
        <div className="mt-4 text-sm font-black">Otya</div>
        <div className="mt-1 text-xs otya-muted">Loading…</div>
      </div>
    </main>
  )
}
