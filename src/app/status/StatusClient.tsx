'use client'

import { useEffect, useMemo, useState } from 'react'

type PublicState = 'operational' | 'degraded'
type StatusPayload = {
  status: PublicState
  components: {
    website?: PublicState
    accounts?: PublicState
    next?: PublicState
  }
  checkedAt: string
}

type CardState = PublicState | 'checking' | 'device-first'

type StatusCard = {
  title: string
  state: CardState
  detail: string
}

const STATE_LABEL: Record<CardState, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  checking: 'Checking',
  'device-first': 'Device-first',
}

export function LiveStatusPanel() {
  const [snapshot, setSnapshot] = useState<StatusPayload | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    const refresh = async () => {
      try {
        const response = await fetch('/api/status', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) throw new Error('status unavailable')
        const data = await response.json() as StatusPayload
        if (!data?.components || typeof data.checkedAt !== 'string') {
          throw new Error('invalid status payload')
        }
        if (!active) return
        setSnapshot(data)
        setFailed(false)
      } catch {
        if (!active) return
        setFailed(true)
      }
    }

    void refresh()
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const cards = useMemo<StatusCard[]>(() => {
    const fallback: CardState = failed ? 'degraded' : 'checking'
    return [
      {
        title: 'Website',
        state: snapshot?.components.website ?? fallback,
        detail: 'Public Otya website and status surface.',
      },
      {
        title: 'Account',
        state: snapshot?.components.accounts ?? fallback,
        detail: 'Sign-in and account service reachability.',
      },
      {
        title: 'Next',
        state: snapshot?.components.next ?? fallback,
        detail: 'Otya assistant service reachability.',
      },
      {
        title: 'Local playback',
        state: 'device-first',
        detail: 'Local music and video remain designed to work without Otya online services.',
      },
    ]
  }, [failed, snapshot])

  return (
    <section className="mt-10" aria-label="Live Otya service status" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[.16em] opacity-60">Live service checks</div>
          <h2 className="mt-2 text-2xl font-black tracking-[-.035em]">Current availability</h2>
        </div>
        <p className="text-xs otya-muted">
          {snapshot
            ? `Checked ${new Date(snapshot.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : failed
              ? 'Live check unavailable — retrying automatically'
              : 'Checking now…'}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-[24px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-5"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${
                  card.state === 'degraded'
                    ? 'bg-amber-500'
                    : card.state === 'checking'
                      ? 'bg-black/30 dark:bg-white/30'
                      : 'bg-[color:var(--cosmos-primary)]'
                }`}
              />
              <span className="text-xs font-black uppercase tracking-[.08em] opacity-60">
                {STATE_LABEL[card.state]}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-black">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 otya-muted">{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
