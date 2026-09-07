'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { clearAdminSessionCache, getAdminSession } from '@/lib/admin_session_client'

type Health = { url: string; status: number; latency: number; ok: boolean }
type Stats = {
  downloads: { total: number; last24h: number; last7d: number; topAbi: string; topVersion: string }
  devices: { active30d: number }
  feedback: { byCategory: Array<{ category: string | null; count: number }> }
  crashes: { last7d: Array<{ error_type: string | null; count: number }> }
  ratings: { average: number | null; total: number }
  health: Health[]
}
type Feedback = {
  id: number
  category?: string | null
  description?: string | null
  user_email?: string | null
  app_version?: string | null
  sentiment?: string | null
  created_at?: string | null
}
type CrashGroup = { group_id?: string | null; error_type?: string | null; count?: number; latest?: string | null }
type FirebaseSync = { configured?: boolean; synced?: boolean; revision?: number; updatedAt?: string }
type SessionState = { loading: boolean; configured: boolean; authenticated: boolean; accountAdmin: boolean; checkError: string }
type Latest = { version?: string; versionCode?: number; changelog?: string; date?: string }

const card = 'rounded-2xl border p-4 sm:p-5'
const input = 'w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/40'

function surfaceStyle() {
  return { background: 'var(--cosmos-card)', borderColor: 'var(--cosmos-divider)' }
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className={card} style={surfaceStyle()}>
    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--cosmos-text-secondary)' }}>{label}</div>
    <div className="mt-1 text-2xl font-black">{value}</div>
    {sub && <div className="mt-1 text-xs" style={{ color: 'var(--cosmos-text-secondary)' }}>{sub}</div>}
  </div>
}

function AdminGate({ configured, accountAdmin, checkError, onRetry, onSuccess }: { configured: boolean; accountAdmin: boolean; checkError: string; onRetry: () => void; onSuccess: () => void }) {
  const [otp, setOtp] = useState('')
  const [stage, setStage] = useState<'start' | 'otp' | 'telegram'>('start')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({})) as { error?: string; ok?: boolean }
    if (!res.ok) throw new Error(data.error ?? 'Admin verification failed')
    clearAdminSessionCache()
    return data
  }, [])

  useEffect(() => {
    if (!accountAdmin || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const telegram = params.get('telegram')
    if (telegram === 'verified') {
      setLoading(true)
      post({ action: 'complete' })
        .then(() => {
          window.history.replaceState({}, '', '/admin')
          onSuccess()
        })
        .catch(e => setError((e as Error).message))
        .finally(() => setLoading(false))
    } else if (telegram === 'not-linked') {
      setStage('telegram')
      setError('Link your Telegram account to this Otya account before using it for admin verification.')
    } else if (telegram === 'error' || telegram === 'expired' || telegram === 'cancelled') {
      setStage('telegram')
      setError('Telegram verification was not completed. Try again.')
    }
  }, [accountAdmin, onSuccess, post])

  async function sendOtp() {
    setLoading(true); setError('')
    try {
      await post({ action: 'start' })
      setStage('otp')
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault()
    if (!otp.trim()) return
    setLoading(true); setError('')
    try {
      await post({ action: 'verify-otp', otp: otp.trim() })
      setOtp('')
      setStage('telegram')
      const res = await fetch('/api/auth/telegram/start?mode=admin', { method: 'POST', credentials: 'same-origin' })
      const data = await res.json().catch(() => ({})) as { authorization_url?: string; error?: string }
      if (!res.ok || !data.authorization_url) throw new Error(data.error ?? 'Telegram verification could not start.')
      window.location.assign(data.authorization_url)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  return <main className="min-h-screen grid place-items-center px-4 py-10" style={{ background: 'var(--cosmos-scaffold)' }}>
    <div className="w-full max-w-sm rounded-3xl border p-6 sm:p-8" style={surfaceStyle()}>
      <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--cosmos-divider)' }}>
        <img src="/otya-app-icon.webp" alt="Otya" className="h-full w-full object-cover" />
      </div>
      <h1 className="text-center text-2xl font-black">Otya Admin</h1>
      <p className="mt-2 text-center text-sm" style={{ color: 'var(--cosmos-text-secondary)' }}>
        Admin uses your existing Otya sign-in. Owner controls are unlocked with fresh email and Telegram verification, not a second account login.
      </p>

      {checkError ? <div className="mt-5 rounded-xl border p-4 text-xs leading-6" style={{ borderColor: 'var(--cosmos-divider)' }}>
        <p>We could not verify the Admin service configuration right now.</p>
        <p className="mt-2 text-red-400">{checkError}</p>
        <button type="button" onClick={onRetry} className="mt-3 w-full rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: 'var(--cosmos-divider)' }}>Retry session check</button>
      </div> : !configured ? <div className="mt-5 rounded-xl border p-4 text-xs leading-6" style={{ borderColor: 'var(--cosmos-divider)' }}>
        Admin MFA is not fully configured on the server. Check the owner allowlist, Auth service binding, and Admin session secret.
      </div> : !accountAdmin ? <div className="mt-6 space-y-3">
        <p className="text-sm text-center" style={{ color: 'var(--cosmos-text-secondary)' }}>Sign in to your Otya account first. Only allowlisted accounts can continue to Admin.</p>
        <a href="/sign-in?next=/admin" className="block w-full rounded-xl bg-violet-500 px-4 py-3 text-center text-sm font-black text-white">Sign in to Otya</a>
      </div> : stage === 'start' ? <div className="mt-6 space-y-3">
        <p className="text-sm" style={{ color: 'var(--cosmos-text-secondary)' }}>You are already signed in. To unlock Admin, we will send a single-use code to the verified email on this Otya account, then confirm the linked Telegram identity.</p>
        <button onClick={sendOtp} disabled={loading} className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? 'Sending…' : 'Unlock Admin'}</button>
      </div> : stage === 'otp' ? <form onSubmit={verifyOtp} className="mt-6 space-y-3">
        <input className={input} style={surfaceStyle()} autoComplete="one-time-code" inputMode="text" placeholder="Email verification code" value={otp} onChange={e => setOtp(e.target.value.toUpperCase().slice(0, 5))} />
        <button disabled={loading || otp.trim().length !== 5} className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? 'Checking…' : 'Continue with Telegram'}</button>
        <button type="button" onClick={sendOtp} disabled={loading} className="w-full rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: 'var(--cosmos-divider)' }}>Send a new code</button>
      </form> : <div className="mt-6 space-y-3">
        <p className="text-sm" style={{ color: 'var(--cosmos-text-secondary)' }}>Email verification passed. Complete verification with the Telegram identity linked to this same Otya account.</p>
        <button onClick={() => verifyOtp({ preventDefault() {} } as FormEvent)} disabled className="hidden" />
        <button onClick={async () => {
          setLoading(true); setError('')
          try {
            const res = await fetch('/api/auth/telegram/start?mode=admin', { method: 'POST', credentials: 'same-origin' })
            const data = await res.json().catch(() => ({})) as { authorization_url?: string; error?: string }
            if (!res.ok || !data.authorization_url) throw new Error(data.error ?? 'Telegram verification could not start.')
            window.location.assign(data.authorization_url)
          } catch (e) { setError((e as Error).message); setLoading(false) }
        }} disabled={loading} className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? 'Opening Telegram…' : 'Continue with Telegram'}</button>
      </div>}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  </main>
}

const sections = [
  ['overview', 'Overview'], ['config', 'Config'], ['releases', 'Releases'], ['push', 'Push'],
  ['feedback', 'Feedback'], ['crashes', 'Crashes'], ['themes', 'Themes'], ['audit', 'Audit'],
] as const

type Section = typeof sections[number][0]

export default function AdminPage() {
  const [session, setSession] = useState<SessionState>({ loading: true, configured: false, authenticated: false, accountAdmin: false, checkError: '' })
  const [section, setSection] = useState<Section>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [crashes, setCrashes] = useState<CrashGroup[]>([])
  const [latest, setLatest] = useState<Latest | null>(null)
  const [configText, setConfigText] = useState('')
  const [firebaseSync, setFirebaseSync] = useState<FirebaseSync | null>(null)
  const [themeText, setThemeText] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshSession = useCallback(async () => {
    setSession(current => ({ ...current, loading: true, checkError: '' }))
    try {
      const body = await getAdminSession()
      setSession({ loading: false, configured: body.configured, authenticated: body.authenticated, accountAdmin: body.accountAdmin, checkError: '' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Admin session check failed'
      setSession({ loading: false, configured: false, authenticated: false, accountAdmin: false, checkError: message })
    }
  }, [])

  useEffect(() => { refreshSession() }, [refreshSession])

  const api = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store' })
    if (res.status === 401) {
      clearAdminSessionCache()
      setSession(s => ({ ...s, authenticated: false }))
      throw new Error('Admin session expired')
    }
    return res
  }, [])

  const loadOverview = useCallback(async () => {
    const [statsRes, latestRes] = await Promise.all([api('/api/admin/stats'), fetch('/latest', { cache: 'no-store' })])
    if (!statsRes.ok) throw new Error(`Stats HTTP ${statsRes.status}`)
    setStats(await statsRes.json() as Stats)
    if (latestRes.ok) setLatest(await latestRes.json() as Latest)
  }, [api])

  const loadFeedback = useCallback(async () => {
    const res = await api('/api/admin/feedback?limit=50')
    if (!res.ok) throw new Error(`Feedback HTTP ${res.status}`)
    const body = await res.json() as { feedback?: Feedback[] }
    setFeedback(body.feedback ?? [])
  }, [api])

  const loadCrashes = useCallback(async () => {
    const res = await api('/api/admin/crashes?limit=50')
    if (!res.ok) throw new Error(`Crashes HTTP ${res.status}`)
    const body = await res.json() as { groups?: CrashGroup[] }
    setCrashes(body.groups ?? [])
  }, [api])

  const loadConfig = useCallback(async () => {
    const res = await api('/api/admin/app-config')
    if (!res.ok) throw new Error(`Config HTTP ${res.status}`)
    const body = await res.json() as { config?: unknown; firebase?: FirebaseSync }
    setConfigText(JSON.stringify(body.config ?? {}, null, 2))
    setFirebaseSync(body.firebase ?? null)
  }, [api])

  const loadThemes = useCallback(async () => {
    const res = await api('/api/admin/themes')
    if (!res.ok) throw new Error(`Themes HTTP ${res.status}`)
    const body = await res.json() as { catalog?: unknown }
    setThemeText(JSON.stringify(body.catalog ?? {}, null, 2))
  }, [api])

  useEffect(() => {
    if (!session.authenticated) return
    const loader = section === 'overview' || section === 'releases' || section === 'push' || section === 'audit'
      ? loadOverview
      : section === 'feedback' ? loadFeedback
      : section === 'crashes' ? loadCrashes
      : section === 'config' ? loadConfig
      : loadThemes
    loader().catch(e => setMessage((e as Error).message))
  }, [session.authenticated, section, loadOverview, loadFeedback, loadCrashes, loadConfig, loadThemes])

  const healthOk = useMemo(() => stats?.health.filter(h => h.ok).length ?? 0, [stats])

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => null)
    clearAdminSessionCache()
    setSession(s => ({ ...s, authenticated: false }))
  }

  async function saveJson(url: string, value: string) {
    setBusy(true); setMessage('')
    try {
      const parsed = JSON.parse(value) as unknown
      const res = await api(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) })
      const body = await res.json().catch(() => ({})) as { error?: string; firebase?: FirebaseSync }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      if (body.firebase) setFirebaseSync(body.firebase)
      setMessage('Saved successfully.')
    } catch (e) { setMessage((e as Error).message) } finally { setBusy(false) }
  }

  if (session.loading) return <div className="min-h-screen grid place-items-center">Loading Otya Admin…</div>
  if (!session.authenticated) return <AdminGate configured={session.configured} accountAdmin={session.accountAdmin} checkError={session.checkError} onRetry={refreshSession} onSuccess={refreshSession} />

  return <div className="min-h-screen" style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}>
    <header className="sticky top-0 z-40 border-b" style={{ background: 'var(--cosmos-surface)', borderColor: 'var(--cosmos-divider)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img src="/otya-app-icon.webp" alt="Otya" className="h-9 w-9 rounded-xl" />
          <div><div className="text-sm font-black">OTYA Admin</div><div className="text-[11px]" style={{ color: 'var(--cosmos-text-secondary)' }}>Control center</div></div>
        </div>
        <div className="flex gap-2"><a href="/admin/ai" className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--cosmos-divider)' }}>Admin AI</a><button onClick={logout} className="rounded-lg border px-3 py-2 text-xs font-bold text-red-400 border-red-400/30">Sign out</button></div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
        {sections.map(([id, label]) => <button key={id} onClick={() => { setMessage(''); setSection(id) }} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${section === id ? 'bg-violet-500 text-white' : ''}`} style={section === id ? undefined : { color: 'var(--cosmos-text-secondary)' }}>{label}</button>)}
      </nav>
    </header>

    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      {message && <div className="mb-4 rounded-xl border p-3 text-sm" style={surfaceStyle()}>{message}</div>}

      {section === 'overview' && <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Downloads" value={stats?.downloads.total ?? '—'} sub={`${stats?.downloads.last7d ?? 0} in 7 days`} />
          <StatCard label="Active devices" value={stats?.devices.active30d ?? '—'} sub="last 30 days" />
          <StatCard label="Rating" value={stats?.ratings.average ?? '—'} sub={`${stats?.ratings.total ?? 0} ratings`} />
          <StatCard label="Systems online" value={`${healthOk}/${stats?.health.length ?? 0}`} sub={`Latest ${latest?.version ?? 'unknown'}`} />
        </div>
        <div className={card} style={surfaceStyle()}><h2 className="font-black">System health</h2><div className="mt-3 space-y-2">{(stats?.health ?? []).map(h => <div key={h.url} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{h.url}</span><span className={h.ok ? 'text-emerald-400' : 'text-red-400'}>{h.status} · {h.latency}ms</span></div>)}</div></div>
      </div>}

      {section === 'config' && <div className="space-y-4"><div className={card} style={surfaceStyle()}><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black">App configuration</h2><p className="text-xs" style={{ color: 'var(--cosmos-text-secondary)' }}>Cloudflare stores safety/fallback config and mirrors the Firebase-owned client subset.</p></div><span className={`text-xs font-bold ${firebaseSync?.synced ? 'text-emerald-400' : 'text-amber-400'}`}>Firebase {firebaseSync?.synced ? 'synced' : firebaseSync?.configured ? 'not synced' : 'not configured'}</span></div><textarea spellCheck={false} className="mt-4 min-h-[420px] w-full rounded-xl border p-3 font-mono text-xs" style={surfaceStyle()} value={configText} onChange={e => setConfigText(e.target.value)} /><button disabled={busy} onClick={() => saveJson('/api/admin/app-config', configText)} className="mt-3 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Save config</button></div></div>}

      {section === 'releases' && <ReleasePanel api={api} latest={latest} onMessage={setMessage} />}
      {section === 'push' && <PushPanel api={api} onMessage={setMessage} />}
      {section === 'feedback' && <div className="space-y-3">{feedback.length === 0 ? <div className={card} style={surfaceStyle()}>No feedback yet.</div> : feedback.map(row => <div key={row.id} className={card} style={surfaceStyle()}><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{row.category ?? 'Other'}</b><span className="text-xs" style={{ color: 'var(--cosmos-text-secondary)' }}>{row.created_at ?? ''}</span></div><p className="mt-2 text-sm whitespace-pre-wrap">{row.description}</p>{row.user_email && <p className="mt-2 text-xs" style={{ color: 'var(--cosmos-text-secondary)' }}>{row.user_email} · {row.app_version ?? ''}</p>}</div>)}</div>}
      {section === 'crashes' && <div className="space-y-3">{crashes.length === 0 ? <div className={card} style={surfaceStyle()}>No crash groups yet.</div> : crashes.map((row, i) => <div key={`${row.group_id}-${i}`} className={card} style={surfaceStyle()}><div className="flex items-center justify-between gap-3"><div><b className="text-sm">{row.error_type ?? row.group_id ?? 'Unknown'}</b><p className="text-xs" style={{ color: 'var(--cosmos-text-secondary)' }}>{row.group_id ?? 'Ungrouped'}</p></div><div className="text-right"><div className="text-xl font-black">{row.count ?? 0}</div><div className="text-[11px]" style={{ color: 'var(--cosmos-text-secondary)' }}>{row.latest ?? ''}</div></div></div></div>)}</div>}
      {section === 'themes' && <div className={card} style={surfaceStyle()}><h2 className="font-black">Theme catalog</h2><p className="mt-1 text-xs" style={{ color: 'var(--cosmos-text-secondary)' }}>One catalog controls Personalize. Invalid JSON is rejected by the server.</p><textarea spellCheck={false} className="mt-4 min-h-[420px] w-full rounded-xl border p-3 font-mono text-xs" style={surfaceStyle()} value={themeText} onChange={e => setThemeText(e.target.value)} /><button disabled={busy} onClick={() => saveJson('/api/admin/themes', themeText)} className="mt-3 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Save themes</button></div>}
      {section === 'audit' && <AuditPanel api={api} onMessage={setMessage} />}
    </main>
  </div>
}

function ReleasePanel({ api, latest, onMessage }: { api: (url: string, init?: RequestInit) => Promise<Response>; latest: Latest | null; onMessage: (m: string) => void }) {
  const [version, setVersion] = useState(latest?.version ?? '1.0.0')
  const [code, setCode] = useState(String(latest?.versionCode ?? 1))
  const [changelog, setChangelog] = useState('')
  const [force, setForce] = useState(false)
  useEffect(() => { if (latest?.version) setVersion(latest.version); if (latest?.versionCode) setCode(String(latest.versionCode)) }, [latest])
  async function publish(e: FormEvent) {
    e.preventDefault(); onMessage('')
    const versionCode = Number(code)
    if (!version.trim() || !Number.isInteger(versionCode) || versionCode < 1) { onMessage('Enter a valid version and version code.'); return }
    const res = await api('/api/admin/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: `v${version.trim()}+${versionCode}`, version: version.trim(), version_code: versionCode, changelog: changelog.trim(), force_update: force }) })
    const body = await res.json().catch(() => ({})) as { error?: string }
    onMessage(res.ok ? `Release ${version.trim()}+${versionCode} metadata published.` : body.error ?? `Release HTTP ${res.status}`)
  }
  return <form onSubmit={publish} className={`${card} space-y-3`} style={surfaceStyle()}><h2 className="font-black">Publish release metadata</h2><p className="text-xs" style={{ color: 'var(--cosmos-text-secondary)' }}>Use this after validated APKs are uploaded. This does not fabricate an APK.</p><div className="grid gap-3 sm:grid-cols-2"><input className={input} style={surfaceStyle()} value={version} onChange={e => setVersion(e.target.value)} placeholder="Version, e.g. 1.0.0" /><input className={input} style={surfaceStyle()} value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" placeholder="Version code" /></div><textarea className={`${input} min-h-32`} style={surfaceStyle()} value={changelog} onChange={e => setChangelog(e.target.value)} placeholder="Release notes" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} /> Force update only when an older build is unsafe</label><button className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white">Publish metadata</button></form>
}

function PushPanel({ api, onMessage }: { api: (url: string, init?: RequestInit) => Promise<Response>; onMessage: (m: string) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [deviceId, setDeviceId] = useState('')
  async function send(e: FormEvent) {
    e.preventDefault(); onMessage('')
    const res = await api('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, ...(deviceId.trim() ? { deviceId: deviceId.trim() } : {}) }) })
    const data = await res.json().catch(() => ({})) as { error?: string; sent?: number; failed?: number }
    onMessage(res.ok ? `Push complete: ${data.sent ?? 0} sent, ${data.failed ?? 0} failed.` : data.error ?? `Push HTTP ${res.status}`)
  }
  return <form onSubmit={send} className={`${card} space-y-3`} style={surfaceStyle()}><h2 className="font-black">Push notification</h2><input className={input} style={surfaceStyle()} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" /><textarea className={`${input} min-h-28`} style={surfaceStyle()} value={body} onChange={e => setBody(e.target.value)} placeholder="Message" /><input className={input} style={surfaceStyle()} value={deviceId} onChange={e => setDeviceId(e.target.value)} placeholder="Optional device ID — blank sends to all registered devices" /><button disabled={!title.trim() || !body.trim()} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Send push</button></form>
}

function AuditPanel({ api, onMessage }: { api: (url: string, init?: RequestInit) => Promise<Response>; onMessage: (m: string) => void }) {
  async function run() {
    const res = await api('/api/notifications/reengage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: true }) })
    const body = await res.json().catch(() => ({})) as { eligibleDormantDevices?: number; reason?: string; error?: string }
    onMessage(res.ok ? `${body.eligibleDormantDevices ?? 0} installations have been dormant for 30+ days. ${body.reason ?? ''}` : body.error ?? `Audit HTTP ${res.status}`)
  }
  return <div className={card} style={surfaceStyle()}><h2 className="font-black">Dormant-device audit</h2><p className="mt-2 text-sm" style={{ color: 'var(--cosmos-text-secondary)' }}>This is intentionally audit-only. OTYA will not send marketing email until explicit consent and unsubscribe state exist.</p><button onClick={run} className="mt-4 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-black text-white">Run audit</button></div>
}