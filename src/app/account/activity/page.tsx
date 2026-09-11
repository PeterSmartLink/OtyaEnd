'use client'

import { useEffect, useState } from 'react'

const API = '/api/account-session'
type Session = { id: string; created_at: string; last_used_at: string; ip?: string | null; user_agent?: string | null }

export default function ActivityPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 8000)
    void fetch(`${API}/sessions`, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }).then(async response => {
      const data = await response.json().catch(() => ({})) as { sessions?: Session[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not load account activity.')
      if (!active) return
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
    }).catch(() => { if (active) setError('Could not load account activity. Reload this page to try again.') })
      .finally(() => { clearTimeout(deadline); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(deadline); controller.abort() }
  }, [])

  const sorted = [...sessions].sort((a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime())

  return <main className="px-4 sm:px-7 lg:px-10 py-7 sm:py-9 max-w-[900px]">
    <header className="mb-7"><div className="text-sm font-black uppercase tracking-[.16em] otya-muted">Otya Space</div><h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-[-.045em]">Activity</h1><p className="mt-2 text-sm sm:text-base otya-muted">Review when your signed-in devices last used your account.</p></header>
    {error && <div className="mb-5 rounded-2xl border border-red-500/25 px-4 py-3 text-sm text-red-700 dark:text-red-200">{error}</div>}
    <section className="rounded-[24px] border overflow-hidden" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
      {loading ? <div role="status" className="p-6 text-sm otya-muted">Loading account activity…</div> : error ? null : sorted.length === 0 ? <div className="p-6 text-sm otya-muted">No recorded account-session activity yet.</div> : sorted.map((session, index) => <div key={session.id} className="p-5 border-t first:border-t-0" style={{ borderColor: 'var(--cosmos-divider)' }}><div className="flex flex-col sm:flex-row sm:items-start gap-3"><div className="min-w-0 flex-1"><div className="font-black">{label(session.user_agent)}</div><div className="mt-1 text-sm otya-muted break-all">{session.ip || 'Network unavailable'}</div></div><div className="text-sm font-semibold otya-muted sm:text-right"><div>Last used {format(session.last_used_at)}</div><div className="mt-1">Created {format(session.created_at)}</div></div></div>{index === 0 && <div className="mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-black" style={{ borderColor: 'var(--cosmos-divider)' }}>Most recent</div>}</div>)}
    </section>
  </main>
}

function format(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'unknown' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) }
function label(agent?: string | null) { if (!agent) return 'Otya session'; if (/Android/i.test(agent)) return 'Android'; if (/iPhone|iPad/i.test(agent)) return 'Apple device'; if (/Windows/i.test(agent)) return 'Windows'; if (/Macintosh/i.test(agent)) return 'Mac'; return 'Browser session' }
