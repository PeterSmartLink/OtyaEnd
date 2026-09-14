'use client'

import Link from 'next/link'
import { OTYA } from '@/lib/constants'
import { signOutBrowser } from '@/lib/browser-sign-out.mjs'
import { useEffect, useRef, useState } from 'react'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

type User = { name?: string; email?: string; avatar_url?: string }
type Session = { authenticated?: boolean; user?: User }

const publicLinks = [
  ['Products', '/apps'],
  ['Otya', '/otya-player'],
  ['Developers', '/developers'],
  ['Company', '/company'],
  ['Journal', '/blog'],
  ['Support', '/help'],
] as const

function initials(user?: User) {
  const name = user?.name?.trim()
  if (name) return name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
  return user?.email?.trim()?.[0]?.toUpperCase() || 'U'
}

function MenuGlyph() { return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg> }
function CloseGlyph() { return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg> }
function AccountGlyph() { return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.25"/><path d="M5.5 19c.75-3.2 3.1-5 6.5-5s5.75 1.8 6.5 5"/></svg> }
function SpaceGlyph() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/></svg> }

function Brand() {
  return <Link href={OTYA.website} className="inline-flex items-center gap-2.5 shrink-0" aria-label="PeterSmart Link home">
    <span className="grid h-11 w-11 place-items-center rounded-xl border border-[color:var(--cosmos-divider)] bg-[color:var(--cosmos-surface)] shadow-[0_0_24px_rgba(18,107,255,.10)]"><OtyaBrandMark size={32} /></span>
    <span className="hidden sm:block leading-tight">
      <span className="block font-black text-[15px] tracking-[-.035em] whitespace-nowrap">PeterSmart Link</span>
      <span className="block text-sm font-semibold tracking-[.04em] otya-muted">Otya Player</span>
    </span>
  </Link>
}

export function SiteNav() {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const signingOut = useRef(false)
  const [signOutError, setSignOutError] = useState('')
  const accountWrap = useRef<HTMLDivElement>(null)
  const menuPanel = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 8000)
    fetch('/api/account-session/session', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as Session
        if (!active) return
        setUser(response.ok && data.authenticated === true ? (data.user ?? {}) : null)
        setChecked(true)
      })
      .catch(() => { if (active) { setUser(null); setChecked(true) } })
      .finally(() => clearTimeout(deadline))
    return () => { active = false; clearTimeout(deadline); controller.abort() }
  }, [])

  useEffect(() => {
    if (!accountOpen) return
    const close = (event: MouseEvent) => { if (accountWrap.current && !accountWrap.current.contains(event.target as Node)) setAccountOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [accountOpen])

  useEffect(() => {
    if (!menuOpen) return
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => Array.from(menuPanel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? [])
    focusable()[0]?.focus()
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
      if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    const resize = () => { if (window.innerWidth >= 1024) setMenuOpen(false) }
    window.addEventListener('resize', resize)
    window.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = old; window.removeEventListener('keydown', esc); window.removeEventListener('resize', resize); menuButton.current?.focus() }
  }, [menuOpen])

  const signedIn = checked && user !== null
  const avatar = user?.avatar_url?.trim()

  async function signOut() {
    if (signingOut.current) return
    signingOut.current = true
    setSignOutError('')
    try {
      await signOutBrowser()
      window.location.assign('/')
    } catch {
      setSignOutError('Could not sign out. Check your connection and try again.')
    } finally {
      signingOut.current = false
    }
  }

  return <>
    {signOutError && <p role="alert" className="fixed bottom-4 left-4 right-4 z-[100] rounded-xl border bg-[color:var(--cosmos-surface)] p-4 text-sm shadow-lg">{signOutError}</p>}
    <header className="sticky top-0 z-50 border-b border-black/[.06] dark:border-white/[.08] bg-[color:var(--nav-bg)] backdrop-blur-2xl">
      <div className="otya-shell h-16 flex items-center gap-2 sm:gap-3">
        <button ref={menuButton} aria-expanded={menuOpen} aria-controls="otya-mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/[.05] dark:hover:bg-white/[.06]"><MenuGlyph/></button>
        <Brand />
        <nav className="hidden lg:flex ml-7 items-center gap-1" aria-label="Main navigation">{publicLinks.map(([label, href]) => <Link key={href} href={href.startsWith('/') ? `${OTYA.website}${href}` : href} className="min-h-10 inline-flex items-center rounded-full px-3.5 text-[13px] font-extrabold otya-muted hover:bg-black/[.045] dark:hover:bg-white/[.06]">{label}</Link>)}</nav>
        <div className="ml-auto flex items-center gap-2">
          <a href="https://docs.petersmartlink.com" className="hidden md:inline-flex min-h-10 items-center rounded-full px-3.5 text-xs font-black otya-muted hover:bg-black/[.04] dark:hover:bg-white/[.05]">Docs</a>
          {signedIn ? <a href="https://space.petersmartlink.com" className="hidden sm:inline-flex min-h-10 items-center gap-2 rounded-full border border-black/[.08] dark:border-white/[.10] px-3.5 text-xs font-black hover:bg-black/[.04] dark:hover:bg-white/[.05]" aria-label="Open Space"><SpaceGlyph/>Space</a> : <a href="https://space.petersmartlink.com/sign-in" className="hidden sm:inline-flex min-h-10 items-center rounded-full px-3.5 text-xs font-black">Sign in</a>}
          <div ref={accountWrap} className="relative">
            <button onClick={() => signedIn ? setAccountOpen(value => !value) : window.location.assign('https://space.petersmartlink.com/sign-in')} aria-label={signedIn ? 'Open account menu' : 'Sign in'} className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-black/[.08] dark:border-white/[.10] bg-black/[.025] dark:bg-white/[.04]">
              {!signedIn ? <AccountGlyph/> : avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer"/> : <span className="text-xs font-black">{initials(user ?? undefined)}</span>}
            </button>
            {signedIn && accountOpen && <div className="absolute right-0 mt-2 w-[280px] overflow-hidden rounded-[22px] border border-black/[.08] dark:border-white/[.10] bg-[color:var(--cosmos-surface)] shadow-2xl">
              <div className="px-4 py-4 border-b border-black/[.06] dark:border-white/[.08]"><div className="font-black truncate">{user?.name || 'Otya account'}</div><div className="mt-1 text-xs otya-muted truncate">{user?.email}</div></div>
              <div className="p-2 text-sm"><a href="https://space.petersmartlink.com" onClick={() => setAccountOpen(false)} className="block rounded-xl px-3 py-2.5 font-bold hover:bg-black/[.04] dark:hover:bg-white/[.06]">Open Space</a><a href="https://space.petersmartlink.com/account/" onClick={() => setAccountOpen(false)} className="block rounded-xl px-3 py-2.5 font-bold hover:bg-black/[.04] dark:hover:bg-white/[.06]">Manage account</a><button onClick={() => void signOut()} className="w-full text-left rounded-xl px-3 py-2.5 text-red-500 hover:bg-black/[.04] dark:hover:bg-white/[.06]">Sign out</button></div>
            </div>}
          </div>
        </div>
      </div>
    </header>

    <div className={`fixed inset-0 z-[70] lg:hidden ${menuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!menuOpen} inert={!menuOpen}>
      <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0'}`}/>
      <aside ref={menuPanel} id="otya-mobile-menu" role="dialog" aria-modal={menuOpen} aria-label="Main navigation" className={`absolute inset-y-0 left-0 w-[88vw] max-w-[360px] border-r border-black/[.08] dark:border-white/[.10] bg-[color:var(--cosmos-surface)] shadow-2xl transition-transform ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-4 border-b border-black/[.06] dark:border-white/[.08]"><Brand/><button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="ml-auto h-11 w-11 grid place-items-center rounded-full"><CloseGlyph/></button></div>
        <div className="p-4 text-sm">
          {signedIn && <a href="https://space.petersmartlink.com" onClick={() => setMenuOpen(false)} className="mb-4 flex items-center gap-3 rounded-2xl px-3 py-3 font-black bg-black/[.035] dark:bg-white/[.05]"><SpaceGlyph/>Open Space</a>}
          <div className="space-y-1">{publicLinks.map(([label, href]) => <Link key={href} href={href.startsWith('/') ? `${OTYA.website}${href}` : href} onClick={() => setMenuOpen(false)} className="block rounded-2xl px-3 py-3 font-bold hover:bg-black/[.045] dark:hover:bg-white/[.06]">{label}</Link>)}</div>
          <div className="mt-4 pt-4 border-t border-black/[.06] dark:border-white/[.08] space-y-1"><a href="https://docs.petersmartlink.com" className="block rounded-2xl px-3 py-3 font-bold">Documentation</a><a href="https://status.petersmartlink.com" className="block rounded-2xl px-3 py-3 font-bold">Service status</a></div>
          {signedIn ? <button onClick={() => void signOut()} className="mt-4 w-full text-left rounded-2xl px-3 py-3 text-red-500">Sign out</button> : <a href="https://space.petersmartlink.com/sign-in" onClick={() => setMenuOpen(false)} className="cosmos-button mt-4 flex min-h-11 items-center justify-center rounded-full px-4 font-black">Sign in</a>}
        </div>
      </aside>
    </div>
  </>
}
