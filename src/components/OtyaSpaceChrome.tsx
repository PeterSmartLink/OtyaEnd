'use client'

import Link from 'next/link'
import { AccountNotices } from '@/components/AccountNotices'
import { signOutBrowser } from '@/lib/browser-sign-out.mjs'
import { ReactNode, useRef, useState } from 'react'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

type SpaceUser = {
  email?: string | null
  name?: string | null
  avatar_url?: string | null
  otya_id?: string | null
}

type NavItem = { label: string; section?: string; fallback: string; icon: ReactNode; external?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const iconClass = 'h-[19px] w-[19px] shrink-0'
function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}

const icons = {
  overview: <Icon><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/></Icon>,
  person: <Icon><circle cx="12" cy="8" r="3.3"/><path d="M5.5 20c.7-3.4 3.1-5.2 6.5-5.2s5.8 1.8 6.5 5.2"/></Icon>,
  security: <Icon><path d="M12 3.5 19 6v5.1c0 4.6-2.8 7.7-7 9.4-4.2-1.7-7-4.8-7-9.4V6l7-2.5Z"/><path d="m9.4 12 1.7 1.7 3.7-4"/></Icon>,
  devices: <Icon><rect x="4" y="4" width="12" height="15" rx="2"/><path d="M8 7h4M8 16h4"/><path d="M18 8h2v9a2 2 0 0 1-2 2"/></Icon>,
  connected: <Icon><path d="M9.4 14.6 14.6 9.4"/><path d="M7.2 16.8 5.8 18.2a3.1 3.1 0 0 1-4.4-4.4l3.4-3.4a3.1 3.1 0 0 1 4.4 0"/><path d="m16.8 7.2 1.4-1.4a3.1 3.1 0 1 1 4.4 4.4l-3.4 3.4a3.1 3.1 0 0 1-4.4 0"/></Icon>,
  storage: <Icon><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></Icon>,
  activity: <Icon><path d="M4 13h4l2-6 4 11 2-5h4"/></Icon>,
  bell: <Icon><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M10 20h4"/></Icon>,
  settings: <Icon><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a8 8 0 0 0-1.8 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a8 8 0 0 0 1.8-1l2.4 1 2-3.4L19 13a7 7 0 0 0 .1-1Z"/></Icon>,
  help: <Icon><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.1c-.9.5-1.3 1-1.3 2"/><path d="M12 17h.01"/></Icon>,
}

const GROUPS: NavGroup[] = [
  {
    label: 'Account',
    items: [
      { label: 'Account overview', section: 'account', fallback: '/account/', icon: icons.person },
      { label: 'Sign-in methods', section: 'providers', fallback: '/account/sign-in-methods/', icon: icons.connected },
      { label: 'Security', section: 'security', fallback: '/account/security/', icon: icons.security },
      { label: 'Devices & sessions', section: 'devices', fallback: '/account/devices/', icon: icons.devices },
      { label: 'Activity', section: 'activity', fallback: '/account/activity/', icon: icons.activity },
      { label: 'Preferences', section: 'settings', fallback: '/account/settings/', icon: icons.settings },
      { label: 'Data & recovery', section: 'storage', fallback: '/account/storage/', icon: icons.storage },
      { label: 'Notifications', section: 'notifications', fallback: '/account/notifications/', icon: icons.bell },
    ],
  },
]

function consoleHref(publicId: string | null | undefined, section: string | undefined, fallback: string) {
  const id = publicId?.trim().toUpperCase()
  return id && section ? `/u/${id}/${section}` : fallback
}

export function OtyaSpaceChrome({ children, initialUser }: { children: ReactNode; initialUser: SpaceUser }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [query, setQuery] = useState('')
  const signingOut = useRef(false)
  const [signOutError, setSignOutError] = useState('')
  const profileRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const user = initialUser

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      const node = event.target as Node
      if (profileOpen && !profileRef.current?.contains(node)) setProfileOpen(false)
      if (notificationsOpen && !notificationRef.current?.contains(node)) setNotificationsOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [profileOpen, notificationsOpen])

  const displayName = user.name?.trim() || user.email?.split('@')[0] || user.otya_id || 'Otya user'
  const initials = displayName.slice(0, 2).toUpperCase()
  const homeHref = consoleHref(user.otya_id, 'overview', '/')

  return <div className="min-h-screen" style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}>
    {signOutError && <p role="alert" className="fixed bottom-4 left-4 right-4 z-[100] rounded-xl border bg-[color:var(--cosmos-surface)] p-4 text-sm shadow-lg">{signOutError}</p>}
    <header className="sticky top-0 z-50 h-16 border-b" style={{ background: 'color-mix(in srgb,var(--cosmos-scaffold) 94%,transparent)', borderColor: 'var(--cosmos-divider)', backdropFilter: 'blur(18px)' }}>
      <div className="h-full flex items-center gap-2 px-3 sm:px-5">
        <button type="button" aria-label="Open Space menu" onClick={() => setMobileNavOpen(true)} className="lg:hidden h-11 w-11 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5"><Icon><path d="M4 7h16M4 12h16M4 17h16"/></Icon></button>
        <Link href={homeHref} className="flex items-center gap-2.5 min-w-0" aria-label="Otya Space home"><OtyaBrandMark size={36} /><div className="hidden sm:block leading-tight"><div className="font-black tracking-[-.025em]">Otya</div><div className="text-sm otya-muted">Space</div></div></Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <div className="relative" ref={notificationRef}>
            <button type="button" aria-label="Notifications" title="Notifications" onClick={() => { setNotificationsOpen(value => !value); setProfileOpen(false) }} className="relative h-11 w-11 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5">{icons.bell}</button>
            {notificationsOpen && <FloatingPanel><div className="font-bold px-2 py-1">Notices</div><div className="mt-2 max-h-[65vh] overflow-y-auto px-2"><AccountNotices compact /></div><Link href={consoleHref(user.otya_id, 'notifications', '/account/notifications/')} className="mt-3 inline-flex min-h-11 items-center px-2 text-sm font-bold">View notices</Link></FloatingPanel>}
          </div>
          <a href="https://docs.petersmartlink.com" aria-label="Help" title="Help" className="h-11 w-11 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5">{icons.help}</a>
          <div className="relative" ref={profileRef}>
            <button type="button" aria-label="Profile" title="Profile" onClick={() => { setProfileOpen(value => !value); setNotificationsOpen(false) }} className="h-11 min-w-11 rounded-full border grid place-items-center text-xs font-black overflow-hidden" style={{ borderColor: profileOpen ? 'var(--cosmos-primary)' : 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>{user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials}</button>
            {profileOpen && <FloatingPanel><div className="flex items-center gap-3 p-2.5"><div className="h-11 w-11 shrink-0 rounded-full grid place-items-center font-black" style={{ background: 'color-mix(in srgb,var(--cosmos-primary) 14%,var(--cosmos-card))' }}>{initials}</div><div className="min-w-0"><div className="font-bold truncate">{displayName}</div><div className="text-xs otya-muted truncate">{user.email || 'No primary email added'}</div>{user.otya_id && <div className="mt-1 text-sm font-mono otya-muted">{user.otya_id}</div>}</div></div><Divider/><PanelLink href={consoleHref(user.otya_id, 'account', '/account/')} onClick={() => setProfileOpen(false)}>Account</PanelLink><PanelLink href={consoleHref(user.otya_id, 'providers', '/account/sign-in-methods/')} onClick={() => setProfileOpen(false)}>Sign-in methods</PanelLink><PanelLink href={consoleHref(user.otya_id, 'settings', '/account/settings/')} onClick={() => setProfileOpen(false)}>Preferences</PanelLink><Divider/><button type="button" onClick={() => void signOut()} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5">Sign out</button></FloatingPanel>}
          </div>
        </div>
      </div>
    </header>

    <div className="lg:grid lg:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="hidden lg:block border-r min-h-[calc(100vh-64px)]" style={{ borderColor: 'var(--cosmos-divider)' }}><SpaceNav query={query} setQuery={setQuery} publicId={user.otya_id} /></aside>
      <div className="min-w-0">{children}</div>
    </div>

    {mobileNavOpen && <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Otya Space menu"><button type="button" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-black/45" /><aside className="relative h-full w-[88vw] max-w-[390px] border-r shadow-2xl" style={{ background: 'var(--cosmos-scaffold)', borderColor: 'var(--cosmos-divider)' }}><div className="h-16 flex items-center gap-2 px-4 border-b" style={{ borderColor: 'var(--cosmos-divider)' }}><OtyaBrandMark size={34}/><strong className="tracking-[-.02em]">Otya Space</strong><button type="button" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} className="ml-auto h-11 w-11 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5"><Icon><path d="m6 6 12 12M18 6 6 18"/></Icon></button></div><SpaceNav query={query} setQuery={setQuery} publicId={user.otya_id} onNavigate={() => setMobileNavOpen(false)} /></aside></div>}
  </div>

  async function signOut() {
    if (signingOut.current) return
    signingOut.current = true
    setSignOutError('')
    try {
      await signOutBrowser()
      window.location.replace('/sign-in')
    } catch {
      setSignOutError('Could not sign out. Check your connection and try again.')
    } finally {
      signingOut.current = false
    }
  }
}

function SpaceNav({ query, setQuery, publicId, onNavigate }: { query: string; setQuery: (value: string) => void; publicId?: string | null; onNavigate?: () => void }) {
  const normalized = query.trim().toLowerCase()
  const match = (label: string) => !normalized || label.toLowerCase().includes(normalized)
  return <nav className="sticky top-16 max-h-[calc(100dvh-64px)] overflow-y-auto px-3 py-4" aria-label="Otya Space">
    <label className="mb-3 flex h-11 items-center gap-2 rounded-xl border px-3" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}><Icon><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></Icon><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Space" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current placeholder:opacity-45" /></label>
    {match('Space home') && <NavLink item={{ label: 'Space home', section: 'overview', fallback: '/', icon: icons.overview }} publicId={publicId} onNavigate={onNavigate} strong />}
    {GROUPS.map(group => { const visible = group.items.filter(item => match(item.label)); if (!visible.length) return null; return <div key={group.label} className="mt-5"><div className="px-3 pb-2 text-sm font-semibold otya-muted">{group.label}</div><div className="space-y-0.5">{visible.map(item => <NavLink key={item.label} item={item} publicId={publicId} onNavigate={onNavigate} />)}</div></div> })}
    <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--cosmos-divider)' }}><NavLink item={{ label: 'Help & Docs', fallback: 'https://docs.petersmartlink.com', icon: icons.help, external: true }} publicId={publicId} onNavigate={onNavigate} /></div>
  </nav>
}

function NavLink({ item, publicId, onNavigate, strong = false }: { item: NavItem; publicId?: string | null; onNavigate?: () => void; strong?: boolean }) {
  const classes = `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 ${strong ? 'font-black' : 'font-semibold'}`
  const content = <><span className="opacity-75">{item.icon}</span><span className="truncate">{item.label}</span></>
  const href = consoleHref(publicId, item.section, item.fallback)
  if (item.external) return <a href={href} onClick={onNavigate} className={classes}>{content}</a>
  return <Link href={href} onClick={onNavigate} className={classes}>{content}</Link>
}

function FloatingPanel({ children }: { children: ReactNode }) { return <div className="absolute right-0 top-12 w-[min(360px,calc(100vw-24px))] max-h-[56vh] overflow-auto rounded-2xl border p-3 shadow-2xl" style={{ background: 'var(--cosmos-surface)', borderColor: 'var(--cosmos-divider)' }}>{children}</div> }
function Divider() { return <div className="my-2 border-t" style={{ borderColor: 'var(--cosmos-divider)' }} /> }
function PanelLink({ href, children, onClick }: { href: string; children: ReactNode; onClick?: () => void }) { return <Link href={href} onClick={onClick} className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5">{children}</Link> }
