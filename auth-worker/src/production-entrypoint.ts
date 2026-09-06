import authWorker from './entrypoint'
import { assertSchemaReady } from './db'
import { handleAdminMfa, type AdminMfaEnv } from './admin-mfa'
import { handleTelegramLogin, type TelegramLoginEnv } from './telegram-login'
import { handleGoogleLink } from './google-link'
import { deliverNewDeviceAlert, deliverRegistrationEmails } from './production-email'
import { handleSecureOtpRoute, type SecureOtpEnv } from './secure-otp'
import { handleSecureAccountRoute, type SecureAccountEnv } from './secure-account'

interface GoogleTokenPayload {
  aud?: string
  iss?: string
  exp?: string | number
  email?: string
  email_verified?: string | boolean
}

type ProductionEnv = Record<string, unknown> & AdminMfaEnv & TelegramLoginEnv & SecureOtpEnv & SecureAccountEnv & {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_WEB_CLIENT_ID?: string
}

let identitySchemaReady: Promise<void> | null = null
const GOOGLE_VERIFY_TIMEOUT_MS = 8000

function configuredGoogleAudiences(env: ProductionEnv): Set<string> {
  return new Set(
    [env.GOOGLE_CLIENT_ID, env.GOOGLE_WEB_CLIENT_ID]
      .map(value => typeof value === 'string' ? value.trim() : '')
      .filter(Boolean),
  )
}

export function isAllowedGoogleAudience(audience: string | undefined, env: ProductionEnv): boolean {
  if (!audience) return false
  return configuredGoogleAudiences(env).has(audience)
}

function authError(message: string, status: number, code?: string): Response {
  return new Response(JSON.stringify({ error: message, ...(code ? { code } : {}) }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function googleError(message: string, status: number): Response {
  return authError(message, status)
}

async function ensureIdentitySchema(env: ProductionEnv): Promise<Response | null> {
  try {
    if (!identitySchemaReady) {
      identitySchemaReady = assertSchemaReady(env.AUTH_DB).catch(error => {
        identitySchemaReady = null
        throw error
      })
    }
    await identitySchemaReady
    return null
  } catch (error) {
    console.error('[auth] Identity schema unavailable:', (error as Error)?.message)
    return authError('Otya Account is temporarily unavailable. Please try again shortly.', 503, 'AUTH_SCHEMA_UNAVAILABLE')
  }
}

function createsIdentitySession(request: Request, url: URL): boolean {
  return request.method === 'POST' && ['/auth/register', '/auth/login', '/auth/google'].includes(url.pathname)
}

async function verifiedGoogleAudience(request: Request, env: ProductionEnv): Promise<string | Response> {
  const audiences = configuredGoogleAudiences(env)
  if (audiences.size === 0) return googleError('Google auth not configured', 503)

  let body: Record<string, unknown>
  try { body = await request.clone().json() as Record<string, unknown> }
  catch { return googleError('Invalid JSON body', 400) }

  const idToken = body.id_token
  if (typeof idToken !== 'string' || !idToken) return googleError('id_token is required', 400)

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(GOOGLE_VERIFY_TIMEOUT_MS),
      },
    )
    if (!response.ok) return googleError('Invalid Google ID token', 401)

    const payload = await response.json() as GoogleTokenPayload
    const verifiedEmail = payload.email_verified === true || payload.email_verified === 'true'
    const issuerOk = payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com'
    const expiry = Number(payload.exp ?? 0)
    const now = Math.floor(Date.now() / 1000)

    if (!isAllowedGoogleAudience(payload.aud, env) || !issuerOk || !Number.isFinite(expiry) || expiry <= now || !verifiedEmail || !payload.email) {
      return googleError('Google account verification failed', 401)
    }
    return payload.aud as string
  } catch {
    return googleError('Google verification service unavailable', 503)
  }
}

async function normalizeAccountResponse(response: Response, env: ProductionEnv): Promise<Response> {
  if (!response.ok) return response
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return response

  let data: Record<string, unknown>
  try { data = await response.clone().json() as Record<string, unknown> }
  catch { return response }

  const user = data.user
  if (!user || typeof user !== 'object' || Array.isArray(user)) return response
  const account = user as Record<string, unknown>
  const id = typeof account.id === 'string' ? account.id : ''
  if (!id) return response

  const hasPublicId = typeof account.otya_id === 'string' && account.otya_id.length > 0
  const hasUsername = typeof account.username === 'string' && account.username.length > 0
  if (hasPublicId && hasUsername) return response

  try {
    let normalizedData: Record<string, unknown> = data

    // Keep the immutable public OTYA ID normalization contract unchanged.
    // Username is additive and is resolved independently so an older schema can
    // never turn a successful sign-in into an outage during rollout.
    if (!hasPublicId) {
      const row = await env.AUTH_DB.prepare(
        'SELECT otya_id FROM users WHERE id = ? LIMIT 1',
      ).bind(id).first<{ otya_id?: string | null }>()
      if (row?.otya_id) {
        normalizedData = { ...data, user: { ...account, otya_id: row.otya_id } }
      }
    }

    if (!hasUsername) {
      try {
        const usernameRow = await env.AUTH_DB.prepare(
          'SELECT username FROM users WHERE id = ? LIMIT 1',
        ).bind(id).first<{ username?: string | null }>()
        if (usernameRow?.username) {
          const normalizedUser = normalizedData.user as Record<string, unknown>
          normalizedData = { ...normalizedData, user: { ...normalizedUser, username: usernameRow.username } }
        }
      } catch (error) {
        console.error('[auth] Could not attach OTYA username:', (error as Error)?.message)
      }
    }

    if (normalizedData === data) return response
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    return new Response(JSON.stringify(normalizedData), {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    console.error('[auth] Could not attach public OTYA identity:', (error as Error)?.message)
    return response
  }
}

export default {
  async fetch(request: Request, env: ProductionEnv): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/auth/admin/')) {
      const response = await handleAdminMfa(request, env)
      if (response) return response
    }

    if (url.pathname.startsWith('/auth/telegram/')) {
      const response = await handleTelegramLogin(request, env)
      if (response) return response
    }

    const googleLinkResponse = await handleGoogleLink(request, env)
    if (googleLinkResponse) return googleLinkResponse

    const secureAccountResponse = await handleSecureAccountRoute(request, env)
    if (secureAccountResponse) return secureAccountResponse

    const secureOtpResponse = await handleSecureOtpRoute(request, env)
    if (secureOtpResponse) return secureOtpResponse

    if (createsIdentitySession(request, url)) {
      const schemaError = await ensureIdentitySchema(env)
      if (schemaError) return schemaError
    }

    if (request.method === 'POST' && url.pathname === '/auth/google') {
      const audience = await verifiedGoogleAudience(request, env)
      if (audience instanceof Response) return audience
      const requestEnv = { ...env, GOOGLE_CLIENT_ID: audience, EMAIL: undefined }
      const response = await authWorker.fetch(request, requestEnv as Parameters<typeof authWorker.fetch>[1])
      if (response.ok) {
        await deliverNewDeviceAlert(request, response, env).catch(error => {
          console.error('[auth/email] Google new-device alert failed:', (error as Error)?.message)
        })
      }
      return normalizeAccountResponse(response, env)
    }

    const compatibilityEnv = { ...env, EMAIL: undefined }
    const response = await authWorker.fetch(request, compatibilityEnv as Parameters<typeof authWorker.fetch>[1])

    if (request.method === 'POST' && url.pathname === '/auth/register' && response.ok) {
      // Production registration owns the verification code. The compatibility
      // worker may create temporary legacy state, but no compatibility email is
      // allowed and the Resend pipeline replaces the active code exactly once.
      await deliverRegistrationEmails(response, env).catch(error => {
        console.error('[auth/email] Registration verification delivery failed:', (error as Error)?.message)
      })
    }

    if (request.method === 'POST' && url.pathname === '/auth/login' && response.ok) {
      await deliverNewDeviceAlert(request, response, env).catch(error => {
        console.error('[auth/email] Password new-device alert failed:', (error as Error)?.message)
      })
    }

    return normalizeAccountResponse(response, env)
  },
}
