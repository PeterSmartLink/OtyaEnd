export default function Loading() {
  return (
    <main className="min-h-[100dvh] grid place-items-center px-6" style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}>
      <div className="flex items-center gap-3 text-sm font-semibold" role="status" aria-live="polite">
        <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--cosmos-primary)]" />
        <span>Loading</span>
      </div>
    </main>
  )
}
