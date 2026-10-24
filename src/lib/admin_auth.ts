const COOKIE_NAME = 'otya_admin_session'
const ACCOUNT_ACCESS_COOKIE = '__Secure-otya_access'
const SESSION_TTL_SECONDS = 60 * 60
const AUTH_LOOKUP_TIMEOUT_MS = 5000

type AuthBinding = { fetch(request: Request): Promise<Response> }
type AdminEnv = Record<string, unknown> & { AUTH?: AuthBinding }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function b64url(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromB64url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return b64url(new Uint8Array(mac))
}

export function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get('cookie') ?? ''
  return cookie.split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) ?? ''
}

export function adminEmails(env: AdminEnv): Set<string> {
  const values = [text(env.ADMIN_EMAIL), ...text(env.ADMIN_EMAILS).split(',')]
  return new Set(values.map(v => v.trim().toLowerCase()).filter(Boolean))
}

function adminSessionSecret(env: AdminEnv): string {
  return text(env.ADMIN_SESSION_SECRET)
}

export function adminConfigured(env: AdminEnv): boolean {
  return adminEmails(env).size > 0
    && Boolean(env.AUTH?.fetch)
    && Boolean(adminSessionSecret(env))
}

export async function createAdminSession(env: AdminEnv, email: string): Promise<string> {
  const secret = adminSessionSecret(env)
  if (!secret) throw new Error('Admin session signing is not configured')
  const payload = JSON.stringify({
    email: email.trim().toLowerCase(),
    mfa: true,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  })
  const encoded = b64url(new TextEncoder().encode(payload))
  return `${encoded}.${await sign(encoded, secret)}`
}

async function verifySignedAdminCookie(request: Request, env: AdminEnv): Promise<boolean> {
  const secret = adminSessionSecret(env)
  if (!secret) return false

  const raw = cookieValue(request, COOKIE_NAME)
  if (!raw) return false
  const [encoded, signature] = raw.split('.')
  if (!encoded || !signature) return false
  const expectedSignature = await sign(encoded, secret)
  if (!timingSafeEqual(signature, expectedSignature)) return false

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(encoded))) as { email?: string; mfa?: boolean; exp?: number }
    return typeof payload.email === 'string'
      && adminEmails(env).has(payload.email.toLowerCase())
      && payload.mfa === true
      && typeof payload.exp === 'number'
      && payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export async function getOtyaAccountAdminEmail(request: Request, env: AdminEnv): Promise<string | null> {
  const accessToken = cookieValue(request, ACCOUNT_ACCESS_COOKIE)
  const allowed = adminEmails(env)
  if (!accessToken || !allowed.size || !env.AUTH?.fetch) return null
  try {
    const upstream = await env.AUTH.fetch(new Request('https://auth/auth/account', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(AUTH_LOOKUP_TIMEOUT_MS),
    }))
    if (!upstream.ok) return null
    const data = await upstream.json().catch(() => ({})) as { email?: string; user?: { email?: string } }
    const email = String(data.user?.email ?? data.email ?? '').trim().toLowerCase()
    return email && allowed.has(email) ? email : null
  } catch {
    return null
  }
}

export async function verifyAdminSession(request: Request, env: AdminEnv): Promise<boolean> {
  return verifySignedAdminCookie(request, env)
}

function legacyAdminTokenAuthorized(request: Request, env: AdminEnv): boolean {
  const expected = text(env.ADMIN_TOKEN)
  if (!expected) return false
  const actual = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  return Boolean(actual) && timingSafeEqual(actual, expected)
}

export async function isAdminAuthorized(request: Request, env: AdminEnv): Promise<boolean> {
  if (await verifyAdminSession(request, env)) return true
  return legacyAdminTokenAuthorized(request, env)
}

export function adminSessionCookie(session: string): string {
  return `${COOKIE_NAME}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}


/** Return the email embedded in a valid, signed MFA admin session. */
export async function getAdminSessionEmail(request: Request, env: AdminEnv): Promise<string | null> {
  if (!await verifySignedAdminCookie(request, env)) return null
  const raw = cookieValue(request, COOKIE_NAME)
  const encoded = raw.split('.')[0]
  if (!encoded) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(encoded))) as { email?: unknown }
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    return email && adminEmails(env).has(email) ? email : null
  } catch {
    return null
  }
}
