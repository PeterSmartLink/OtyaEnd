import openNextWorker from '../.open-next/worker.js'
import backendWorker from './telegram-entrypoint.mjs'
import { handleTogetherControl } from './together-control.mjs'
export { OtyaReleaseWorkflow } from './telegram-entrypoint.mjs'

const APP_HOST = 'petersmartlink.com'
const DOCS_HOST = 'docs.petersmartlink.com'
const STATUS_HOST = 'status.petersmartlink.com'
const SPACE_HOST = 'space.petersmartlink.com'

const CANONICAL_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://telegram.org https://challenges.cloudflare.com https://pagead2.googlesyndication.com https://partner.googleadservices.com https://tpc.googlesyndication.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://challenges.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: https://pagead2.googlesyndication.com",
  "connect-src 'self' https://petersmartlink.com https://space.petersmartlink.com https://accounts.google.com https://telegram.org https://oauth.telegram.org https://challenges.cloudflare.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.google-analytics.com",
  "frame-src https://accounts.google.com https://oauth.telegram.org https://challenges.cloudflare.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function authenticateTogetherUser(request, env) {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ') || !env.AUTH?.fetch) return null

  try {
    const response = await env.AUTH.fetch(new Request('https://otya-auth/auth/verify', {
      method: 'GET',
      headers: { Authorization: authorization },
    }))
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok !== true || !data?.user_id) return null
    return {
      id: String(data.user_id),
      email: typeof data.email === 'string' ? data.email.toLowerCase() : null,
    }
  } catch {
    return null
  }
}

function redirectToHost(url, hostname, pathname) {
  const target = new URL(url)
  target.protocol = 'https:'
  target.hostname = hostname
  target.pathname = pathname
  target.search = ''
  target.hash = ''
  return Response.redirect(target.toString(), 302)
}

function isSharedAppAssetPath(pathname) {
  return pathname.startsWith('/_next/')
    || pathname === '/favicon.ico'
    || pathname === '/robots.txt'
    || /\.(?:svg|png|webp|jpg|jpeg|gif|ico|css|js|woff2?)$/i.test(pathname)
}

function isSpaceSurfacePath(pathname) {
  return pathname === '/space'
    || pathname === '/space/'
    || pathname === '/telegram'
    || pathname === '/telegram/'
    || pathname === '/ask'
    || pathname.startsWith('/ask/')
    || pathname === '/account'
    || pathname.startsWith('/account/')
    || pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/sign-in'
    || pathname === '/sign-in/'
    || pathname.startsWith('/api/')
    || isSharedAppAssetPath(pathname)
}

// Public Otya IDs are intentionally human-friendly and safe to display.
// Internal users.id values, provider subjects, emails and auth tokens never
// belong in the browser path.
function matchSpaceConsoleRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'u' || !/^2IS\d{8}$/i.test(parts[1] || '')) return null

  const publicId = parts[1].toUpperCase()
  const section = parts.slice(2).join('/') || 'overview'
  const direct = new Map([
    ['overview', '/space/'],
    ['account', '/account/'],
    ['account/sign-in-methods', '/account/sign-in-methods/'],
    ['providers', '/account/sign-in-methods/'],
    ['security', '/account/security/'],
    ['devices', '/account/devices/'],
    ['storage', '/account/storage/'],
    ['activity', '/account/activity/'],
    ['notifications', '/account/notifications/'],
    ['settings', '/account/settings/'],
    ['next', '/ask/'],
    ['telegram', '/telegram/'],
    ['admin', '/admin'],
  ])
  const target = direct.get(section)
  if (target) return { publicId, section, target }
  return { publicId, section: 'overview', target: '/space/', unknown: true }
}

function isCoreBackendRoute(pathname) {
  return pathname === '/auth'
    || pathname.startsWith('/auth/')
    || pathname === '/api/ai'
    || pathname.startsWith('/api/ai/')
    || pathname.startsWith('/api/admin/ai/')
    || pathname === '/api/admin/release-workflow'
    || pathname === '/api/admin/release-workflow/status'
    || pathname === '/api/telegram/webhook'
    || pathname === '/api/admin/telegram/test'
    || pathname === '/api/admin/telegram/webhook'
    || pathname.startsWith('/api/telegram/')
}

function applyCanonicalBrowserPolicy(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('text/html')) return response
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', CANONICAL_CSP)
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function dispatchOpenNext(request, env, ctx) {
  return applyCanonicalBrowserPolicy(await openNextWorker.fetch(request, env, ctx))
}

async function dispatchSurface(request, url, env, ctx, pathname = url.pathname) {
  const target = new URL(url)
  target.protocol = 'https:'
  target.pathname = pathname
  const headers = new Headers(request.headers)
  headers.set('X-Forwarded-Host', url.hostname)
  headers.set('X-Forwarded-Proto', 'https')
  const init = { method: request.method, headers, redirect: 'manual' }
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body
  return dispatchOpenNext(new Request(target.toString(), init), env, ctx)
}

export default {
  ...backendWorker,
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const host = url.hostname.toLowerCase()

    if (url.pathname.startsWith('/api/together/')) {
      if (!env.KV || !env.AUTH?.fetch) {
        return json({ error: 'Together control plane unavailable' }, 503)
      }
      const user = await authenticateTogetherUser(request, env)
      return handleTogetherControl(request, env, user)
    }

    if (isCoreBackendRoute(url.pathname)) return backendWorker.fetch(request, env, ctx)

    if (url.pathname === '/api/version' || url.pathname === '/api/version/') {
      url.pathname = '/latest'
      const headers = new Headers(request.headers)
      headers.set('X-OTYA-Version-Alias', 'api-version')
      return dispatchOpenNext(new Request(url, { method: request.method, headers }), env, ctx)
    }

    if (host === SPACE_HOST) {
      const consoleRoute = matchSpaceConsoleRoute(url.pathname)
      if (consoleRoute) {
        if (consoleRoute.unknown && (request.method === 'GET' || request.method === 'HEAD')) {
          return redirectToHost(url, SPACE_HOST, `/u/${consoleRoute.publicId}/overview`)
        }
        return dispatchSurface(request, url, env, ctx, consoleRoute.target)
      }

      if (url.pathname === '/' || url.pathname === '/space' || url.pathname === '/space/') {
        return dispatchSurface(request, url, env, ctx, '/space/')
      }
      if (url.pathname === '/account') return dispatchSurface(request, url, env, ctx, '/account/')
      if (url.pathname === '/sign-in') return dispatchSurface(request, url, env, ctx, '/sign-in/')
      if (isSpaceSurfacePath(url.pathname)) return dispatchSurface(request, url, env, ctx)
      if (request.method === 'GET' || request.method === 'HEAD') return redirectToHost(url, SPACE_HOST, '/')
      return dispatchSurface(request, url, env, ctx)
    }

    if (host === DOCS_HOST) {
      if (url.pathname === '/' || url.pathname === '/docs' || url.pathname === '/docs/') return dispatchSurface(request, url, env, ctx, '/docs/')
      if (url.pathname === '/help' || url.pathname === '/help/') return dispatchSurface(request, url, env, ctx, '/help/')
      if (isSharedAppAssetPath(url.pathname)) return dispatchSurface(request, url, env, ctx)
      if (request.method === 'GET' || request.method === 'HEAD') return redirectToHost(url, DOCS_HOST, '/')
      return dispatchSurface(request, url, env, ctx)
    }

    if (host === STATUS_HOST) {
      if (url.pathname === '/' || url.pathname === '/status' || url.pathname === '/status/') return dispatchSurface(request, url, env, ctx, '/status/')
      if (isSharedAppAssetPath(url.pathname)) return dispatchSurface(request, url, env, ctx)
      if (request.method === 'GET' || request.method === 'HEAD') return redirectToHost(url, STATUS_HOST, '/')
      return dispatchSurface(request, url, env, ctx)
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      if (host === APP_HOST && (url.pathname === '/account' || url.pathname === '/account/')) return redirectToHost(url, SPACE_HOST, '/account/')
      if (host === APP_HOST && (url.pathname === '/sign-in' || url.pathname === '/sign-in/')) return redirectToHost(url, SPACE_HOST, '/sign-in/')
      if (host === APP_HOST && (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))) return redirectToHost(url, SPACE_HOST, url.pathname)
      if (host === APP_HOST && (url.pathname === '/help' || url.pathname === '/help/' || url.pathname === '/docs' || url.pathname === '/docs/')) return redirectToHost(url, DOCS_HOST, '/')
      if (host === APP_HOST && (url.pathname === '/status' || url.pathname === '/status/')) return redirectToHost(url, STATUS_HOST, '/')
    }

    return dispatchOpenNext(request, env, ctx)
  },
}
