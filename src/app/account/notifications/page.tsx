'use client'

export default function NotificationsPage() {
  return <main className="px-4 sm:px-7 lg:px-10 py-7 sm:py-9 max-w-[900px]">
    <header className="mb-7"><div className="text-[11px] font-black uppercase tracking-[.16em] otya-muted">Otya Space</div><h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-[-.045em]">Notifications</h1><p className="mt-2 text-sm sm:text-base otya-muted">Account and security notices belong here. Playback controls and local-media alerts remain on the Android device.</p></header>
    <section className="rounded-[24px] border p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
      <div className="text-lg font-black">Account inbox not available yet</div>
      <p className="mt-2 text-sm leading-6 otya-muted">There is no cloud notification inbox to show yet. Otya will not invent placeholder alerts or duplicate Android playback notifications in Space.</p>
      <div className="mt-5 grid sm:grid-cols-3 gap-3 text-sm"><State title="Security" text="Important sign-in/account alerts"/><State title="Updates" text="Relevant Otya release notices"/><State title="Playback" text="Android media session only"/></div>
    </section>
  </main>
}

function State({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--cosmos-divider)' }}><div className="font-black">{title}</div><div className="mt-1 text-xs leading-5 otya-muted">{text}</div></div> }
