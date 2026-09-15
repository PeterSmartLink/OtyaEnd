'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string
        theme?: 'dark' | 'light' | 'auto'
        size?: 'normal' | 'compact' | 'flexible'
        callback: (token: string) => void
        'expired-callback'?: () => void
        'error-callback'?: () => void
      }) => string
    }
  }
}

type Props = {
  onTokenChange: (token: string) => void
  resetKey?: number
  className?: string
}

type Config = {
  turnstile?: boolean
  siteKey?: string
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function TurnstileChallenge({ onTokenChange, resetKey = 0, className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [siteKey, setSiteKey] = useState('')
  const [scriptReady, setScriptReady] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    void fetch('/api/security/turnstile/config', { cache: 'no-store', credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as Config
        if (!response.ok || data.turnstile !== true || !data.siteKey) {
          throw new Error('Security verification is unavailable.')
        }
        if (!cancelled) setSiteKey(data.siteKey)
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
          onTokenChange('')
        }
      })
    return () => { cancelled = true }
  }, [onTokenChange])

  useEffect(() => {
    if (!siteKey) return
    const existing = document.querySelector<HTMLScriptElement>('script[data-otya-turnstile]')
    const ready = () => setScriptReady(true)
    if (existing) {
      if (window.turnstile) ready()
      else existing.addEventListener('load', ready, { once: true })
      return () => existing.removeEventListener('load', ready)
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.dataset.otyaTurnstile = 'true'
    script.addEventListener('load', ready, { once: true })
    script.addEventListener('error', () => {
      setStatus('error')
      onTokenChange('')
    }, { once: true })
    document.head.appendChild(script)
  }, [onTokenChange, siteKey])

  useEffect(() => {
    if (!siteKey || !scriptReady || !hostRef.current || !window.turnstile) return

    const host = hostRef.current
    setStatus('loading')
    onTokenChange('')
    host.replaceChildren()
    window.turnstile.render(host, {
      sitekey: siteKey,
      theme: 'dark',
      size: 'flexible',
      callback: (token: string) => {
        setStatus('ready')
        onTokenChange(token)
      },
      'expired-callback': () => {
        setStatus('loading')
        onTokenChange('')
      },
      'error-callback': () => {
        setStatus('error')
        onTokenChange('')
      },
    })

    return () => host.replaceChildren()
  }, [onTokenChange, resetKey, scriptReady, siteKey])

  return <div className={`otya-turnstile-shell ${className}`}>
    <div className="flex items-start gap-3">
      <span className="otya-security-badge" aria-hidden="true">✓</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">Cloudflare protection</p>
        <p className="mt-0.5 text-xs leading-5 otya-muted">Verify you are human before Otya accepts this public authentication request.</p>
      </div>
    </div>
    <div ref={hostRef} className="mt-3 min-h-[65px] w-full overflow-hidden rounded-xl" aria-label="Cloudflare security verification" />
    {status === 'error' && <p className="mt-2 text-xs text-red-300">Security verification could not load. Refresh this page or try again shortly.</p>}
  </div>
}
