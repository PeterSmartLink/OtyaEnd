'use client'

import Script from 'next/script'
import { useEffect, useMemo, useState } from 'react'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

export const dynamic = 'force-dynamic'

type Tab = 'home' | 'next' | 'account' | 'updates'
type TelegramWebApp = {
  initData: string
  initDataUnsafe?: { start_param?: string }
  colorScheme?: 'light' | 'dark'
  ready(): void
  expand?(): void
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
}
declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

type AuthState = { ready: boolean; authenticated: boolean; needsAccount: boolean; error?: string; user?: { name?: string; email?: string; otya_id?: string } }

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' }, { id: 'next', label: 'Next' },
   { id: 'account', label: 'Account' }, { id: 'updates', label: 'Updates' },
]

function allowedStart(value?: string): Tab {
  const raw = String(value ?? '')
  if (['home', 'next', 'account', 'updates'].includes(raw)) return raw as Tab
  if (/^release_\d+$/.test(raw)) return 'updates'
  if (/^track_[A-Za-z0-9_-]{1,80}$/.test(raw)) return 'home'
  return 'home'
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.error || `Request failed (${response.status})`), { status: response.status, data })
  return data
}

export default function TelegramMiniAppPage() {
  const [tab, setTab] = useState<Tab>('home')
  const [telegramReady, setTelegramReady] = useState(false)
  const [auth, setAuth] = useState<AuthState>({ ready: false, authenticated: false, needsAccount: false })
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [updates, setUpdates] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)

  const inTelegram = telegramReady && Boolean(window.Telegram?.WebApp?.initData)
  const title = useMemo(() => TABS.find(item => item.id === tab)?.label ?? 'OTYA', [tab])

  useEffect(() => {
    if (!telegramReady) return
    const tg = window.Telegram?.WebApp
    if (!tg) return
    tg.ready(); tg.expand?.()
    setTab(allowedStart(tg.initDataUnsafe?.start_param))
    if (!tg.initData) {
      setAuth({ ready: true, authenticated: false, needsAccount: false, error: 'Open this page from @OtyaPlayerBot to connect Telegram securely.' })
      return
    }
    void api('/api/auth/telegram/miniapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: tg.initData }),
    }).then(data => setAuth({ ready: true, authenticated: data.authenticated === true, needsAccount: false, user: data.user }))
      .catch((error: Error & { data?: { code?: string } }) => setAuth({ ready: true, authenticated: false, needsAccount: error.data?.code === 'OTYA_ACCOUNT_REQUIRED', error: error.message }))
  }, [telegramReady])

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg?.BackButton) return
    const back = () => setTab('home')
    if (tab === 'home') tg.BackButton.hide(); else tg.BackButton.show()
    tg.BackButton.onClick(back)
    return () => tg.BackButton?.offClick(back)
  }, [tab, telegramReady])

  async function askNext() {
    if (!query.trim() || busy) return
    setBusy(true); setAnswer('')
    try {
      const data = await api('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: query.trim(), channel: 'telegram-miniapp' }) })
      setAnswer(String(data.answer ?? data.response ?? ''))
    } catch (error) { setAnswer((error as Error).message) }
    finally { setBusy(false) }
  }
  async function loadUpdates() {
    setBusy(true)
    try { setUpdates(await api('/api/version')) } catch { setUpdates({ error: 'Updates are temporarily unavailable.' }) } finally { setBusy(false) }
  }

  if (!inTelegram || !auth.authenticated) return <main className="min-h-screen grid place-items-center px-5" style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}>
    <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onLoad={() => setTelegramReady(true)} onError={() => setAuth({ ready: true, authenticated: false, needsAccount: false, error: 'Could not connect to Telegram. Please reopen Otya from the bot.' })} />
    <section className="max-w-md space-y-4 py-10">
      <OtyaBrandMark size={44}/>
      <h1 className="text-2xl font-bold">{inTelegram ? 'Connect your Otya account' : 'Open Otya in Telegram'}</h1>
      <p className="text-base leading-7 otya-muted">{auth.error || (inTelegram ? 'Verifying your Telegram session…' : 'This Mini App is available through the official Otya bot.')}</p>
      <a href={auth.needsAccount ? 'https://space.petersmartlink.com/sign-in' : 'https://t.me/OtyaPlayerBot'} className="cosmos-button inline-flex min-h-12 items-center px-5 font-bold">{auth.needsAccount ? 'Connect account' : 'Open Otya bot'}</a>
    </section>
  </main>

  return <main className="min-h-screen bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)] px-4 pb-24 pt-[max(18px,env(safe-area-inset-top))]">
    <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onLoad={() => setTelegramReady(true)} />
    <div className="mx-auto max-w-xl">
      <header className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2"><OtyaBrandMark size={34}/><div><div className="font-black tracking-tight">Otya</div><div className="text-xs otya-muted">Next by Otya</div></div></div>
        <div className="rounded-full border border-black/10 px-3 py-1 text-xs font-bold dark:border-white/10">{title}</div>
      </header>

      {!auth.ready && <Card><p className="font-bold">Connecting securely…</p><p className="mt-1 text-sm otya-muted">Verifying Telegram with OTYA Account.</p></Card>}
      {auth.ready && !inTelegram && <Card><h1 className="text-xl font-black">Open OTYA from Telegram</h1><p className="mt-2 text-sm otya-muted">Use @OtyaPlayerBot → Open OTYA. This browser fallback never trusts Telegram identity data.</p></Card>}
      {auth.needsAccount && <Card><h2 className="text-lg font-black">Connect your OTYA Account</h2><p className="mt-2 text-sm otya-muted">Telegram is verified, but it is not linked to an OTYA Account yet. Sign in first, then reopen OTYA from Telegram.</p><a className="cosmos-button mt-4 inline-flex rounded-full px-5 py-3 font-black" href="https://petersmartlink.com/sign-in">Sign in to OTYA</a></Card>}
      {auth.error && !auth.needsAccount && inTelegram && <Card><p className="text-sm font-bold text-red-600 dark:text-red-300">{auth.error}</p></Card>}

      {tab === 'home' && <div className="space-y-3"><Card><h1 className="text-3xl font-black tracking-[-.04em]">OTYA in Telegram</h1><p className="mt-2 otya-muted">Ask Next, manage your account and check Otya updates without leaving Telegram.</p></Card><div className="grid grid-cols-2 gap-3">{TABS.slice(1).map(item => <button key={item.id} onClick={() => setTab(item.id)} className="rounded-3xl border border-black/10 bg-[color:var(--cosmos-surface)] p-5 text-left font-black dark:border-white/10">{item.label}</button>)}</div></div>}

      {tab === 'next' && <Card><h2 className="text-2xl font-black">Next</h2><p className="mt-1 text-sm otya-muted">Ask a question or get help with Otya.</p><textarea value={query} onChange={e => setQuery(e.target.value)} className="mt-4 min-h-28 w-full rounded-2xl border border-black/10 bg-transparent p-3 dark:border-white/10" placeholder="Ask Next…"/><button onClick={askNext} disabled={busy} className="cosmos-button mt-3 rounded-full px-5 py-3 font-black disabled:opacity-50">{busy ? 'Thinking…' : 'Ask Next'}</button>{answer && <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-black/[.04] p-4 text-sm dark:bg-white/[.05]">{answer}</div>}</Card>}



      {tab === 'account' && <Card><h2 className="text-2xl font-black">OTYA Account</h2>{auth.authenticated ? <><p className="mt-2 font-bold">Connected</p><p className="mt-1 text-sm otya-muted">{auth.user?.name || auth.user?.email || auth.user?.otya_id || 'OTYA Account'}</p></> : <p className="mt-2 text-sm otya-muted">Sign in to connect Telegram to your OTYA Account.</p>}<a href="https://petersmartlink.com/account" className="mt-4 inline-flex font-black underline">Open full account</a></Card>}

      {tab === 'updates' && <Card><h2 className="text-2xl font-black">Updates</h2><button onClick={loadUpdates} className="cosmos-button mt-4 rounded-full px-5 py-3 font-black">Check OTYA</button><div className="mt-4 text-base leading-7">{updates?.error ? <p role="alert">Updates are temporarily unavailable. Please try again.</p> : updates?.published === false ? <p>No public release is available yet.</p> : updates ? <><p className="font-bold">Otya {String(updates.version ?? '')}</p><p className="mt-2 whitespace-pre-wrap">{String(updates.changelog ?? 'Visit the download page for release details.')}</p><a href="https://petersmartlink.com/download/otya-player" className="mt-4 inline-flex min-h-11 items-center underline">View release and download</a></> : <p className="otya-muted">Check for the latest Otya release.</p>}</div></Card>}
    </div>

    <nav className="fixed inset-x-0 bottom-0 border-t border-black/10 bg-[color:var(--cosmos-surface)]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-white/10"><div className="mx-auto flex max-w-xl justify-around">{TABS.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-full px-2 py-2 text-sm font-black ${tab === item.id ? 'bg-black/10 dark:bg-white/10' : 'otya-muted'}`}>{item.label}</button>)}</div></nav>
  </main>
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[28px] border border-black/10 bg-[color:var(--cosmos-surface)] p-5 shadow-sm dark:border-white/10">{children}</section>
}
