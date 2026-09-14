'use client'

import Link from 'next/link'
import { ReactNode, useEffect, useMemo, useState } from 'react'

type SpaceUser = {
  id?: string
  otya_id?: string | null
  email?: string | null
  name?: string | null
  is_verified?: boolean | number
}

type Identity = { provider: string; provider_username?: string | null }
type Session = { id: string; last_used_at: string }
type Product = { product_id?: string; status?: string }
type AccountPayload = { user?: SpaceUser; identities?: Identity[]; products?: Product[] }
type TwoFactor = { enabled?: boolean }

async function accountFetch(path: string) {
  return fetch(`/api/account-session/${path}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
}

function spaceHref(publicId: string | null | undefined, section: string, fallback: string) {
  const id = publicId?.trim().toUpperCase()
  return id ? `/u/${id}/${section}` : fallback
}

export default function SpaceHomePage() {
  const [user, setUser] = useState<SpaceUser | null>(null)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [twoFactor, setTwoFactor] = useState<TwoFactor>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      accountFetch('account'),
      accountFetch('sessions').catch(() => null),
      accountFetch('2fa/status').catch(() => null),
    ]).then(async ([accountResponse, sessionsResponse, twoFactorResponse]) => {
      if (!accountResponse.ok) throw new Error('account')
      const account = await accountResponse.json().catch(() => ({})) as AccountPayload
      const sessionData = sessionsResponse?.ok
        ? await sessionsResponse.json().catch(() => ({})) as { sessions?: Session[] }
        : {}
      const twoFactorData = twoFactorResponse?.ok
        ? await twoFactorResponse.json().catch(() => ({})) as TwoFactor
        : {}
      if (cancelled) return
      setUser(account.user ?? null)
      setIdentities(Array.isArray(account.identities) ? account.identities : [])
      setProducts(Array.isArray(account.products) ? account.products : [])
      setSessions(Array.isArray(sessionData.sessions) ? sessionData.sessions : [])
      setTwoFactor(twoFactorData)
    }).catch(() => {
      if (!cancelled) setError('Otya Space could not load your account summary. Your account has not been changed.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const google = identities.find(identity => identity.provider === 'google')
  const telegram = identities.find(identity => identity.provider === 'telegram')
  const connectedCount = [Boolean(user?.email), Boolean(google), Boolean(telegram)].filter(Boolean).length
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || user?.otya_id || 'Otya user'
  const lastActivity = useMemo(() => sessions[0]?.last_used_at ? formatDate(sessions[0].last_used_at) : 'No recent session activity', [sessions])

  const accountHref = spaceHref(user?.otya_id, 'account', '/account/')
  const providersHref = spaceHref(user?.otya_id, 'providers', '/account/sign-in-methods/')
  const securityHref = spaceHref(user?.otya_id, 'security', '/account/security/')
  const devicesHref = spaceHref(user?.otya_id, 'devices', '/account/devices/')
  const storageHref = spaceHref(user?.otya_id, 'storage', '/account/storage/')
  const settingsHref = spaceHref(user?.otya_id, 'settings', '/account/settings/')
  const telegramHref = spaceHref(user?.otya_id, 'telegram', '/telegram/')

  return <main className="px-4 sm:px-7 lg:px-10 py-7 sm:py-9 max-w-[1240px]">
    <section className="relative overflow-hidden rounded-[28px] border p-6 sm:p-8 lg:p-10" style={{ borderColor: 'var(--cosmos-divider)', background: 'linear-gradient(135deg,color-mix(in srgb,var(--cosmos-primary) 13%,var(--cosmos-card)),var(--cosmos-card) 58%)' }}>
      <div className="max-w-3xl">
        <div className="text-[11px] font-black uppercase tracking-[.18em] otya-muted">Otya Space</div>
        <h1 className="mt-3 text-3xl sm:text-5xl font-black tracking-[-.05em]">Welcome, {displayName}</h1>
        <p className="mt-4 text-sm sm:text-base leading-7 otya-muted">Your local Otya account space. Manage your identity, security, connected sign-in methods and supported recovery services.</p>
        {user?.otya_id && <div className="mt-4 inline-flex rounded-xl border px-3 py-2 font-mono text-xs font-bold" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>Otya ID · {user.otya_id}</div>}
        <div className="mt-6 flex flex-wrap gap-2">
          <PrimaryLink href={accountHref}>Manage account</PrimaryLink>
          <QuietLink href={providersHref}>Sign-in methods</QuietLink>
          <QuietLink href={telegramHref}>Telegram</QuietLink>
        </div>
      </div>
    </section>

    {error && <div className="mt-5 rounded-2xl border border-red-500/25 px-4 py-3 text-sm text-red-700 dark:text-red-200">{error}</div>}

    <section className="mt-7 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      <SpaceCard title="Account & security" eyebrow="Identity" action={<Link href={securityHref} className="text-xs font-black otya-muted">Open</Link>}>
        {loading ? <LoadingLine /> : <>
          <StatusRow label="Primary email" value={!user?.email ? 'Not added' : user.is_verified ? 'Verified' : 'Needs verification'} />
          <StatusRow label="Two-step verification" value={twoFactor.enabled ? 'On' : 'Off'} />
          <StatusRow label="Active sessions" value={String(sessions.length)} />
        </>}
      </SpaceCard>

      <SpaceCard title="Sign-in methods" eyebrow="One Otya ID" action={<Link href={providersHref} className="text-xs font-black otya-muted">Manage</Link>}>
        {loading ? <LoadingLine /> : <>
          <div className="text-4xl font-black">{connectedCount}</div>
          <p className="mt-1 text-sm otya-muted">connected way{connectedCount === 1 ? '' : 's'} to access this same account</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <Badge on={Boolean(user?.email)}>Email</Badge><Badge on={Boolean(google)}>Google</Badge><Badge on={Boolean(telegram)}>Telegram</Badge>
          </div>
        </>}
      </SpaceCard>

      <SpaceCard title="Devices & activity" eyebrow="Sessions" action={<Link href={devicesHref} className="text-xs font-black otya-muted">Review</Link>}>
        <div className="text-sm font-bold">{lastActivity}</div>
        <p className="mt-2 text-sm otya-muted">Review recorded sign-ins and revoke sessions you no longer trust.</p>
      </SpaceCard>

      <SpaceCard title="Playlist recovery" eyebrow="Google Drive" action={<Link href={storageHref} className="text-xs font-black otya-muted">Details</Link>}>
        <div className="text-lg font-black">Available in the Android app</div>
        <p className="mt-2 text-sm leading-6 otya-muted">Otya can back up playlist names and saved media references to your private Google Drive app folder. Media files and Private files stay on your device.</p>
      </SpaceCard>

      <SpaceCard title="Your Otya data" eyebrow="Device-first" action={<Link href={storageHref} className="text-xs font-black otya-muted">Review</Link>}>
        <StatusRow label="Playlists" value="Recovery supported" />
        <StatusRow label="Favorites" value="Device-first in v1" />
        <StatusRow label="History" value="Device-first in v1" />
        <p className="mt-3 text-xs leading-5 otya-muted">Space does not pretend local-only data is already cloud-synced.</p>
      </SpaceCard>


      <SpaceCard title="Telegram" eyebrow="Connected service" action={<Link href={telegramHref} className="text-xs font-black otya-muted">Open</Link>}>
        <div className="text-lg font-black">{telegram ? 'Connected to your Otya ID' : 'Available to connect'}</div>
        <p className="mt-2 text-sm leading-6 otya-muted">Telegram is a first-class Otya identity and Mini App surface, not a separate user database.</p>
      </SpaceCard>

      <SpaceCard title="Otya products" eyebrow="Account history">
        <div className="text-4xl font-black">{products.length}</div>
        <p className="mt-1 text-sm otya-muted">product record{products.length === 1 ? '' : 's'} associated with this Otya account</p>
      </SpaceCard>

      <SpaceCard title="Privacy & help" eyebrow="Control">
        <div className="flex flex-col gap-2 text-sm font-black">
          <a href="https://petersmartlink.com/privacy">Privacy Policy</a>
          <a href="https://petersmartlink.com/terms">Terms of Service</a>
          <a href="https://docs.petersmartlink.com">Otya Help & Docs</a>
          <Link href={settingsHref}>Account preferences</Link>
        </div>
      </SpaceCard>
    </section>
  </main>
}

function SpaceCard({ title, eyebrow, action, children }: { title: string; eyebrow: string; action?: ReactNode; children: ReactNode }) {
  return <article className="rounded-[22px] border p-5 min-h-[210px]" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
    <div className="flex items-start justify-between gap-3 mb-5"><div><div className="text-[10px] font-black uppercase tracking-[.15em] otya-muted">{eyebrow}</div><h2 className="mt-1 text-lg font-black tracking-[-.025em]">{title}</h2></div>{action}</div>
    {children}
  </article>
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-t first:border-t-0 py-2.5 text-sm" style={{ borderColor: 'var(--cosmos-divider)' }}><span className="otya-muted">{label}</span><span className="font-black text-right">{value}</span></div>
}

function Badge({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className="rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--cosmos-divider)', opacity: on ? 1 : .48 }}>{children} · {on ? 'connected' : 'not set'}</span>
}

function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="cosmos-button inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black">{children}</Link>
}

function QuietLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="otya-quiet-button inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black">{children}</Link>
}

function LoadingLine() {
  return <div className="space-y-3"><div className="h-4 w-3/4 rounded animate-pulse" style={{ background: 'var(--cosmos-divider)' }} /><div className="h-4 w-2/3 rounded animate-pulse" style={{ background: 'var(--cosmos-divider)' }} /><div className="h-4 w-1/2 rounded animate-pulse" style={{ background: 'var(--cosmos-divider)' }} /></div>
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recent activity recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
