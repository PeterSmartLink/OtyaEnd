import Link from 'next/link'

export function HomeStart() {
  return <section className="otya-shell py-10 sm:py-14" aria-labelledby="start-heading">
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div>
        <p className="otya-kicker">Start here</p>
        <h2 id="start-heading" className="mt-3 text-3xl sm:text-5xl font-bold tracking-[-.045em] leading-[1.1]">One product.<br/>Clear next steps.</h2>
        <p className="mt-4 max-w-md text-base leading-7 otya-muted">Otya is for the media already on your Android phone. Space is the private place for your account.</p>
      </div>
      <div className="grid gap-3">
        <Link href="/download/otya-player" className="group rounded-2xl border border-black/[.07] bg-[color:var(--cosmos-surface)] p-5 transition-colors hover:border-black/[.16] dark:border-white/[.09] dark:hover:border-white/[.18]">
          <p className="text-xs font-black otya-muted">Otya Player · Android</p>
          <h3 className="mt-1 text-xl font-black tracking-[-.03em]">Play the media already on your phone.</h3>
          <p className="mt-2 text-sm leading-6 otya-muted">Music and video playback, including core local playback offline.</p>
          <span className="mt-4 inline-flex text-sm font-black">Download Otya Player <span aria-hidden="true" className="ml-1">→</span></span>
        </Link>
        <a href="https://space.petersmartlink.com/account/" className="group rounded-2xl border border-black/[.07] bg-[color:var(--cosmos-surface)] p-5 transition-colors hover:border-black/[.16] dark:border-white/[.09] dark:hover:border-white/[.18]">
          <p className="text-xs font-black otya-muted">Otya Space</p>
          <h3 className="mt-1 text-xl font-black tracking-[-.03em]">Manage your account in private.</h3>
          <p className="mt-2 text-sm leading-6 otya-muted">Review account details, signed-in devices and security settings.</p>
          <span className="mt-4 inline-flex text-sm font-black">Open Space <span aria-hidden="true" className="ml-1">→</span></span>
        </a>
      </div>
    </div>
  </section>
}
