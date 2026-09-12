/**
 * OTYA Auth production entrypoint.
 *
 * Production wrapper for Resend, Google verification, Telegram account linking,
 * account profile controls, phone verification, two-step verification, session
 * controls, Drive backup and explicit legal/marketing consent.
 */

import legacyWorker from './index'
import { handleBackupRoute } from './backup_route'
import { handleTelegramLogin } from './telegram-login'
import { handleAccountProfile } from './account-profile'
import { handlePhoneVerification } from './phone-verification'
import {
  handleSessionRoute,
  recordSessionFromAuthResponse,
  removeSessionFromLogout,
  touchSessionFromRefresh,
} from './session-manager'
import {
  handleTwoFactorRoute,
  revokeIssuedRefreshToken,
  verifySecondFactor,
} from './two-factor'
import { sendResendEmail, type ResendEmail } from './resend'
import {
  handleConsentRoute,
  recordRegistrationConsent,
  TERMS_VERSION,
  PRIVACY_VERSION,
} from './consent'

interface LegacyEmailMessage {
  from: { email: string; name?: string }
  to: { email: string }[]
  subject: string
  text: string
}

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[]
    list_complete: boolean
    cursor?: string
  }>
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta: { changes: number; last_row_id?: number } }>
  run(): Promise<{ meta: { changes: number; last_row_id?: number } }>
}

interface D1Database {
  prepare(query: string): D1Statement
  exec(query: string): Promise<{ count: number; duration: number }>
}

interface ResendEnv extends Record<string, unknown> {
  RESEND_API_KEY?: string
  GOOGLE_CLIENT_ID?: string
  PREVERIFIED_GOOGLE_PAYLOAD?: GoogleTokenPayload
  TELEGRAM_LOGIN_CLIENT_ID?: string
  TELEGRAM_LOGIN_CLIENT_SECRET?: string
  TELEGRAM_LOGIN_REDIRECT_URI?: string
  TELEGRAM_GATEWAY_TOKEN?: string
  ACCOUNT_ENCRYPTION_KEY?: string
  AUTH_JWT_SECRET: string
  AUTH_KV: KVNamespace
  AUTH_DB: D1Database
  CORS_ORIGIN?: string
}

const GOOGLE_RATE_LIMIT = 20
const GOOGLE_RATE_TTL = 15 * 60
const GOOGLE_VERIFY_TIMEOUT_MS = 8000
const PRIMARY_ORIGIN = 'https://petersmartlink.com'
const OTYA_NOREPLY_EMAIL = 'noreply@petersmartlink.com'
const OTYA_SUPPORT_EMAIL = 'support@petersmartlink.com'
const OTYA_NOREPLY_FROM = `OTYA <${OTYA_NOREPLY_EMAIL}>`
const LEGAL_ACCEPTANCE_REQUIRED = 428

function normalizeEmailText(text: string): string {
  return text.replace(
    '(1 letter + 3 digits — enter it exactly as shown)',
    '(1 uppercase letter + 4 digits — enter it exactly as shown, e.g. A1234)',
  )
}

function createEmailAdapter(apiKey: string | undefined) {
  return {
    async send(message: LegacyEmailMessage): Promise<void> {
      const email: ResendEmail = {
        from: OTYA_NOREPLY_FROM,
        to: message.to.map((recipient) => recipient.email),
        subject: message.subject,
        text: `${normalizeEmailText(message.text)}\n\nNeed help? Contact ${OTYA_SUPPORT_EMAIL}.`,
      }
      await sendResendEmail(apiKey, email)
    },
  }
}

function jsonError(
  message: string,
  status: number,
  env: ResendEnv,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': env.CORS_ORIGIN ?? PRIMARY_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Otya-Drive-Token',
      'Vary': 'Origin',
    },
  })
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    ?? 'unknown'
}

async function checkGoogleRateLimit(request: Request, env: ResendEnv): Promise<boolean> {
  const key = `google_ip_rate:${clientIp(request)}`
  const raw = await env.AUTH_KV.get(key)
  const current = raw ? Number.parseInt(raw, 10) : 0
  if (current >= GOOGLE_RATE_LIMIT) return false
  await env.AUTH_KV.put(key, String(current + 1), { expirationTtl: GOOGLE_RATE_TTL })
  return true
}

function hasCurrentLegalAcceptance(body: Record<string, unknown>): boolean {
  return body.terms_accepted === true
    && body.privacy_accepted === true
    && body.terms_version === TERMS_VERSION
    && body.privacy_version === PRIVACY_VERSION
}

function legalAcceptanceError(env: ResendEnv): Response {
  return jsonError(
    'Accept the current Terms of Service and Privacy Policy to create your OTYA account.',
    LEGAL_ACCEPTANCE_REQUIRED,
    env,
    {
      code: 'LEGAL_ACCEPTANCE_REQUIRED',
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    },
  )
}

interface GoogleTokenPayload {
  sub?: string
  aud?: string
  iss?: string
  exp?: string | number
  iat?: string | number
  email?: string
  email_verified?: string | boolean
  name?: string
  picture?: string
}

interface PreparedGoogleRequest {
  request?: Request
  error?: Response
  newUser?: boolean
  marketingConsent?: boolean
  payload?: GoogleTokenPayload
}

function isValidGooglePayload(payload: GoogleTokenPayload | undefined, clientId: string): payload is GoogleTokenPayload {
  if (!payload) return false
  const verified = payload.email_verified === true || payload.email_verified === 'true'
  const issuerOk = payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com'
  const expiry = Number(payload.exp ?? 0)
  const now = Math.floor(Date.now() / 1000)
  return payload.aud === clientId
    && issuerOk
    && Number.isFinite(expiry)
    && expiry > now
    && verified
    && Boolean(payload.email)
    && Boolean(payload.sub)
}

async function validateGoogleRequest(
  request: Request,
  env: ResendEnv,
): Promise<PreparedGoogleRequest> {
  if (!env.GOOGLE_CLIENT_ID) return { error: jsonError('Google auth not configured', 503, env) }
  if (!(await checkGoogleRateLimit(request, env))) {
    return { error: jsonError('Too many Google sign-in attempts. Try again later.', 429, env) }
  }

  let bodyText: string
  let body: Record<string, unknown>
  try {
    bodyText = await request.text()
    body = JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    return { error: jsonError('Invalid JSON body', 400, env) }
  }

  const idToken = body.id_token
  if (typeof idToken !== 'string' || !idToken) {
    return { error: jsonError('id_token is required', 400, env) }
  }

  try {
    let payload = env.PREVERIFIED_GOOGLE_PAYLOAD
    if (!payload) {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(GOOGLE_VERIFY_TIMEOUT_MS),
        },
      )
      if (!response.ok) return { error: jsonError('Invalid Google ID token', 401, env) }
      payload = await response.json() as GoogleTokenPayload
    }

    if (!isValidGooglePayload(payload, env.GOOGLE_CLIENT_ID)) {
      return { error: jsonError('Google account verification failed', 401, env) }
    }

    const normalizedEmail = payload.email!.toLowerCase().trim()
    const bySubject = await env.AUTH_DB.prepare(
      'SELECT id FROM users WHERE google_id = ? LIMIT 1',
    ).bind(payload.sub).first<{ id?: string }>()
    const byEmail = await env.AUTH_DB.prepare(
      'SELECT id FROM users WHERE lower(email) = ? LIMIT 1',
    ).bind(normalizedEmail).first<{ id?: string }>()

    if (bySubject?.id && byEmail?.id && bySubject.id !== byEmail.id) {
      return { error: jsonError('This Google identity conflicts with another OTYA account.', 409, env, { code: 'GOOGLE_IDENTITY_CONFLICT' }) }
    }

    // Google `sub` is the immutable provider identity. A previously linked
    // Google account is therefore an existing OTYA identity even when its
    // Google email differs from the user's chosen primary OTYA email.
    const existing = bySubject ?? byEmail
    const newUser = !existing?.id

    if (newUser && !hasCurrentLegalAcceptance(body)) {
      return { error: legalAcceptanceError(env) }
    }

    return {
      request: new Request(request, { body: bodyText }),
      newUser,
      marketingConsent: body.marketing_consent === true,
      payload,
    }
  } catch (error) {
    console.error('[auth/google] Google verification failed:', (error as Error)?.message)
    return { error: jsonError('Google verification service unavailable', 503, env) }
  }
}

async function prepareRegistration(
  request: Request,
  env: ResendEnv,
): Promise<{ request?: Request; marketingConsent?: boolean; error?: Response }> {
  let bodyText: string
  let body: Record<string, unknown>
  try {
    bodyText = await request.text()
    body = JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    return { error: jsonError('Invalid JSON body', 400, env) }
  }

  if (!hasCurrentLegalAcceptance(body)) {
    return { error: legalAcceptanceError(env) }
  }

  return {
    request: new Request(request, { body: bodyText }),
    marketingConsent: body.marketing_consent === true,
  }
}

async function persistConsentFromResponse(
  response: Response,
  env: ResendEnv,
  marketingConsent: boolean,
): Promise<void> {
  const cloned = response.clone()
  const data = await cloned.json() as { user?: { id?: string } }
  const userId = data.user?.id
  if (userId) await recordRegistrationConsent(env, userId, marketingConsent)
}

export default {
  async fetch(request: Request, env: ResendEnv): Promise<Response> {
    const resendEnv = { ...env, EMAIL: createEmailAdapter(env.RESEND_API_KEY) }
    const url = new URL(request.url)

    if (url.pathname === '/auth/account' && request.method !== 'OPTIONS') {
      const accountResponse = await handleAccountProfile(request, env)
      if (accountResponse) return accountResponse
    }

    if (url.pathname.startsWith('/auth/telegram/') && request.method !== 'OPTIONS') {
      const telegramResponse = await handleTelegramLogin(request, env)
      if (telegramResponse) return telegramResponse
    }

    if (url.pathname.startsWith('/auth/phone/') && request.method !== 'OPTIONS') {
      const phoneResponse = await handlePhoneVerification(request, env)
      if (phoneResponse) return phoneResponse
    }

    if (url.pathname.startsWith('/auth/2fa/') && request.method !== 'OPTIONS') {
      const twoFactorResponse = await handleTwoFactorRoute(request, env)
      if (twoFactorResponse) return twoFactorResponse
    }

    if (url.pathname.startsWith('/auth/sessions') && request.method !== 'OPTIONS') {
      const sessionResponse = await handleSessionRoute(request, env)
      if (sessionResponse) return sessionResponse
    }

    if (url.pathname === '/auth/consent' && request.method !== 'OPTIONS') {
      const response = await handleConsentRoute(request, env)
      if (response) return response
    }

    if (url.pathname === '/auth/backup' && request.method !== 'OPTIONS') {
      const backupResponse = await handleBackupRoute(request, env)
      if (backupResponse) return backupResponse
    }

    let forwardedRequest = request
    let registrationMarketingConsent = false
    let googleNewUser = false
    let googleMarketingConsent = false
    let googlePayload: GoogleTokenPayload | undefined
    let loginSecondFactor: { code?: string; recoveryCode?: string } | null = null
    let refreshTokenForTouch: string | null = null
    let refreshTokenForLogout: string | null = null

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      try {
        const body = await request.clone().json() as Record<string, unknown>
        loginSecondFactor = {
          code: typeof body.totp_code === 'string' ? body.totp_code : undefined,
          recoveryCode: typeof body.recovery_code === 'string' ? body.recovery_code : undefined,
        }
      } catch {}
    }

    if (request.method === 'POST' && url.pathname === '/auth/refresh') {
      try {
        const body = await request.clone().json() as { refresh_token?: string }
        refreshTokenForTouch = body.refresh_token ?? null
      } catch {}
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      try {
        const body = await request.clone().json() as { refresh_token?: string }
        refreshTokenForLogout = body.refresh_token ?? null
      } catch {}
    }

    if (request.method === 'POST' && url.pathname === '/auth/register') {
      const prepared = await prepareRegistration(request, env)
      if (prepared.error) return prepared.error
      forwardedRequest = prepared.request ?? request
      registrationMarketingConsent = prepared.marketingConsent === true
    }

    if (request.method === 'POST' && url.pathname === '/auth/google') {
      const checked = await validateGoogleRequest(request, env)
      if (checked.error) return checked.error
      forwardedRequest = checked.request ?? request
      googleNewUser = checked.newUser === true
      googleMarketingConsent = checked.marketingConsent === true
      googlePayload = checked.payload
    }

    const legacyEnv = googlePayload
      ? { ...resendEnv, PREVERIFIED_GOOGLE_PAYLOAD: googlePayload }
      : resendEnv
    const response = await legacyWorker.fetch(
      forwardedRequest,
      legacyEnv as Parameters<typeof legacyWorker.fetch>[1],
    )

    if (response.ok && request.method === 'POST' && url.pathname === '/auth/login') {
      try {
        const data = await response.clone().json() as {
          refresh_token?: string
          user?: { id?: string }
        }
        const userId = data.user?.id
        if (userId) {
          const result = await verifySecondFactor(
            env,
            userId,
            loginSecondFactor?.code,
            loginSecondFactor?.recoveryCode,
          )
          if (result !== 'not-enabled' && result !== 'valid') {
            await revokeIssuedRefreshToken(env, userId, data.refresh_token)
            if (result === 'unavailable') {
              return jsonError(
                'Two-step verification is temporarily unavailable. Try again later.',
                503,
                env,
                { code: 'TWO_FACTOR_UNAVAILABLE' },
              )
            }
            if (result === 'invalid') {
              return jsonError(
                'The authenticator or recovery code is invalid.',
                401,
                env,
                { code: 'TWO_FACTOR_INVALID' },
              )
            }
            return jsonError(
              'Enter your authenticator code or a recovery code.',
              401,
              env,
              { code: 'TWO_FACTOR_REQUIRED' },
            )
          }
        }
      } catch (error) {
        console.error('[auth/2fa] Login post-check failed:', (error as Error)?.message)
        return jsonError('Could not verify account security settings.', 503, env)
      }
    }

    if (response.ok && request.method === 'POST' && url.pathname === '/auth/register') {
      try {
        await persistConsentFromResponse(response, env, registrationMarketingConsent)
      } catch (error) {
        console.error('[auth/consent] Could not persist registration consent:', (error as Error)?.message)
      }
    }

    if (response.ok && request.method === 'POST' && url.pathname === '/auth/google' && googleNewUser) {
      try {
        await persistConsentFromResponse(response, env, googleMarketingConsent)
      } catch (error) {
        console.error('[auth/consent] Could not persist Google registration consent:', (error as Error)?.message)
      }
    }

    if (
      response.ok
      && request.method === 'POST'
      && (url.pathname === '/auth/login' || url.pathname === '/auth/register' || url.pathname === '/auth/google')
    ) {
      await recordSessionFromAuthResponse(request, response, env)
    }

    if (response.ok && refreshTokenForTouch) {
      await touchSessionFromRefresh(request, refreshTokenForTouch, env)
    }

    if (refreshTokenForLogout) {
      await removeSessionFromLogout(refreshTokenForLogout, env)
    }

    return response
  },
}
