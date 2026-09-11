'use client'

import { FormEvent, useEffect, useState } from 'react'

const API = '/api/account-session'
type User = { locale?: string | null; timezone?: string | null; country_code?: string | null }

async function accountFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${API}/${path}`, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
}

export default function SettingsPage() {
  const [locale, setLocale] = useState('')
  const [timezone, setTimezone] = useState('')
  const [country, setCountry] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 8000)
    setLocale(navigator.language || '')
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || '')
    void accountFetch('account', { signal: controller.signal }).then(async response => {
      const data = await response.json().catch(() => ({})) as { user?: User; error?: string }
      if (!response.ok || !data.user) throw new Error(data.error || 'Could not load preferences.')
      if (!active) return
      setLoaded(true)
      setLocale(data.user.locale || navigator.language || '')
      setTimezone(data.user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '')
      setCountry(data.user.country_code || '')
    }).catch(() => { if (active) setError('Could not load preferences. Reload this page to try again.') })
      .finally(() => clearTimeout(deadline))
    return () => { active = false; clearTimeout(deadline); controller.abort() }
  }, [])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || !loaded) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await accountFetch('account', { method: 'PATCH', body: JSON.stringify({ locale: locale.trim() || null, timezone: timezone.trim() || null, country_code: country.trim().toUpperCase() || null }) })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not save preferences.')
      setNotice('Preferences saved.')
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  return <main className="px-4 sm:px-7 lg:px-10 py-7 sm:py-9 max-w-[840px]">
    <header className="mb-7"><div className="text-sm font-black uppercase tracking-[.16em] otya-muted">Otya Space</div><h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-[-.045em]">Preferences</h1><p className="mt-2 text-sm sm:text-base otya-muted">Account-level regional preferences. Device playback settings remain inside the Android app.</p></header>
    {error && <Message tone="error">{error}</Message>}{notice && <Message tone="ok">{notice}</Message>}
    <form onSubmit={save} className="rounded-[24px] border p-5 sm:p-6 grid gap-4" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
      <fieldset disabled={!loaded || busy} className="grid gap-4">
      <Field label="Language / locale" value={locale} onChange={setLocale} placeholder="en-UG" />
      <Field label="Timezone" value={timezone} onChange={setTimezone} placeholder="Africa/Kampala" />
      <Field label="Country code" value={country} onChange={setCountry} placeholder="UG" maxLength={2} />
      <div className="pt-1"><button disabled={busy} className="cosmos-button min-h-11 rounded-xl px-5 text-sm font-black disabled:opacity-60">{busy ? 'Saving…' : !loaded ? (error ? 'Preferences unavailable' : 'Loading preferences…') : 'Save preferences'}</button></div>
      </fieldset>
    </form>
  </main>
}

function Field({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; maxLength?: number }) { return <label className="grid gap-1.5"><span className="text-sm font-black otya-muted">{label}</span><input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} className="min-h-12 rounded-xl border bg-transparent px-3.5 outline-none" style={{ borderColor: 'var(--cosmos-divider)' }} /></label> }
function Message({ tone, children }: { tone: 'error' | 'ok'; children: React.ReactNode }) { return <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${tone === 'error' ? 'border-red-500/25 text-red-700 dark:text-red-200' : 'border-emerald-500/25 text-emerald-700 dark:text-emerald-200'}`}>{children}</div> }
