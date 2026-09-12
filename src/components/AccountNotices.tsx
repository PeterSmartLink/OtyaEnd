'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Session = { id: string; created_at: string; user_agent?: string | null }
type Release = { published?: boolean; version?: string; changelog?: string; error?: string }

export function AccountNotices({ compact = false }: { compact?: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState(false)
  const [releaseError, setReleaseError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 8000)
    setLoading(true); setSessionError(false); setReleaseError(false)
    setSessions([]); setRelease(null)
    async function load() {
      const results = await Promise.allSettled([
        fetch('/api/account-session/sessions', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
          .then(async response => {
            if (!response.ok) throw new Error('session unavailable')
            const data = await response.json() as { sessions?: Session[] }
            if (!Array.isArray(data.sessions)) throw new Error('invalid sessions')
            return data.sessions.filter(item => item && typeof item.id === 'string' && typeof item.created_at === 'string')
          }),
        fetch('https://petersmartlink.com/latest', { credentials: 'omit', cache: 'no-store', signal: controller.signal })
          .then(async response => {
            if (!response.ok) throw new Error('release unavailable')
            const data = await response.json() as Release
            if (data.error || (data.published !== false && (typeof data.version !== 'string' || !data.version))) throw new Error('invalid release')
            return data
          }),
      ])
      if (!active) return
      const [signIns, latest] = results
      if (signIns.status === 'fulfilled') setSessions(signIns.value)
      else setSessionError(true)
      if (latest.status === 'fulfilled') setRelease(latest.value)
      else setReleaseError(true)
      setLoading(false)
    }
    void load().finally(() => clearTimeout(deadline))
    return () => { active = false; clearTimeout(deadline); controller.abort() }
  }, [attempt])

  if (loading) return <p role="status" className="py-4 text-base otya-muted">Loading notices…</p>
  const recent = [...sessions].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, compact ? 2 : 10)
  return <div className="space-y-5 text-base leading-7">
    <section>
      <h2 className="font-bold">Latest release</h2>
      {releaseError ? <p className="otya-muted">Release information could not be loaded.</p> : release?.published === false ? <p className="otya-muted">No public release is available yet.</p> : release && <>
        <p>Otya {release.version}</p>
        {!compact && typeof release.changelog === 'string' && <p className="mt-2 whitespace-pre-wrap otya-muted">{release.changelog}</p>}
        <a href="https://petersmartlink.com/download/otya-player" className="inline-flex min-h-11 items-center underline">View release</a>
      </>}
    </section>
    <section>
      <h2 className="font-bold">Recent sign-ins</h2>
      <p className="text-sm otya-muted">Based on your current account sessions.</p>
      {sessionError ? <p role="alert">Your sign-ins could not be loaded. Please try again.</p> : recent.length === 0 ? <p className="otya-muted">No current sessions to show.</p> : <ul className="divide-y divide-[color:var(--cosmos-divider)]">
        {recent.map(session => <li key={session.id} className="py-3"><p className="font-semibold">{deviceLabel(session.user_agent)}</p><p className="text-sm otya-muted">Signed in {dateLabel(session.created_at)}</p></li>)}
      </ul>}
      <Link href="/account/devices/" className="inline-flex min-h-11 items-center underline">Review signed-in devices</Link>
    </section>
    {(sessionError || releaseError) && <button type="button" onClick={() => setAttempt(value => value + 1)} className="cosmos-button min-h-11 px-5 font-semibold">Try again</button>}
  </div>
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'at an unknown time' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
function deviceLabel(agent?: string | null) {
  if (/Android/i.test(agent || '')) return 'Android device'
  if (/iPhone|iPad/i.test(agent || '')) return 'Apple device'
  return 'Otya account session'
}
