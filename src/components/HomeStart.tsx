'use client'

import { useState } from 'react'
import Link from 'next/link'

const paths = [
  { id: 'listen', label: 'Enjoy my media', eyebrow: 'Otya Player · Android', title: 'Make room for your next favourite.', description: 'Play the music and videos already on your phone. Start with the Android download, or get to know Otya first.', primary: 'Get Otya Player', href: '/download/otya-player', secondary: 'Explore the player', secondaryHref: '/otya-player', detail: 'Core local playback works offline.' },
  { id: 'account', label: 'Manage my account', eyebrow: 'Otya Space', title: 'Your account. One familiar place.', description: 'Review your signed-in devices, account details and security settings in Otya Space.', primary: 'Open my account', href: 'https://space.petersmartlink.com/account/', secondary: 'Account help', secondaryHref: '/help', detail: 'Sign in to view your private account information.' },
  { id: 'help', label: 'Find an answer', eyebrow: 'Next · Otya Support', title: 'A little help goes a long way.', description: 'Ask Next about Otya, look through the guides, or find the right support option when something needs attention.', primary: 'Ask Next', href: '/ask', secondary: 'Browse help', secondaryHref: '/help', detail: 'Next needs an internet connection. AI answers can be mistaken.' },
] as const

export function HomeStart() {
  const [selected, setSelected] = useState(0)
  const path = paths[selected]
  return <section className="otya-shell py-14 sm:py-20" aria-labelledby="start-heading">
    <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-16 items-center">
      <div>
        <p className="otya-kicker">Your next step</p>
        <h2 id="start-heading" className="mt-3 text-3xl sm:text-5xl font-bold tracking-[-.045em] leading-[1.1]">What brings<br className="hidden sm:block"/> you here?</h2>
        <p className="mt-4 max-w-md text-base leading-7 otya-muted">Choose what you need. We’ll point you in the right direction.</p>
        <div className="mt-6 flex flex-col gap-2" role="tablist" aria-label="Choose your next step" aria-orientation="vertical">
          {paths.map((item, index) => <button key={item.id} id={`start-tab-${item.id}`} role="tab" aria-selected={selected === index} aria-controls={`start-panel-${item.id}`} tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)} onKeyDown={event => {
              let next = index
              if (event.key === 'ArrowDown') next = (index + 1) % paths.length
              else if (event.key === 'ArrowUp') next = (index + paths.length - 1) % paths.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = paths.length - 1
              else return
              event.preventDefault(); setSelected(next); document.getElementById(`start-tab-${paths[next].id}`)?.focus()
            }}
            className="flex min-h-14 items-center justify-between rounded-2xl border px-5 py-3 text-left text-base font-semibold"
            style={{ borderColor: selected === index ? 'var(--cosmos-primary)' : 'var(--cosmos-divider)', background: selected === index ? 'var(--cosmos-surface)' : 'transparent' }}>
            {item.label}<span aria-hidden="true" className="ml-3">{selected === index ? '↗' : '→'}</span>
          </button>)}
        </div>
      </div>
      <div key={path.id} id={`start-panel-${path.id}`} role="tabpanel" aria-labelledby={`start-tab-${path.id}`} tabIndex={0} className="rounded-[28px] border p-6 sm:p-10" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-surface)' }}>
        <p className="text-sm font-semibold otya-muted">{path.eyebrow}</p>
        <h3 className="mt-5 max-w-lg text-3xl sm:text-4xl font-bold leading-[1.12] tracking-[-.04em]">{path.title}</h3>
        <p className="mt-5 text-base leading-7 otya-muted">{path.description}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3"><Link href={path.href} className="cosmos-button inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold">{path.primary}</Link><Link href={path.secondaryHref} className="inline-flex min-h-12 items-center px-3 text-base font-semibold underline underline-offset-4">{path.secondary}</Link></div>
        <p className="mt-7 border-t pt-5 text-sm leading-6 otya-muted" style={{ borderColor: 'var(--cosmos-divider)' }}>{path.detail}</p>
      </div>
    </div>
  </section>
}
