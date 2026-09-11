/**
 * otya-auth — Cloudflare Worker
 *
 * Handles all user authentication for the Otya ecosystem.
 * Called by the main otya-backend worker via Service Binding (env.AUTH).
 *
 * Routes:
 *   POST /auth/register           — email + password signup
 *   POST /auth/login              — email + password login (brute-force protected)
 *   POST /auth/refresh            — refresh access token
 *   POST /auth/logout             — revoke refresh token
 *   POST /auth/google             — Google ID token login/signup
 *   POST /auth/forgot-password    — send OTP via email
 *   POST /auth/reset-password     — verify OTP, update password
 *   POST /auth/delete-account     — delete user account + notify OTYA Backend
 *   GET  /auth/verify             — validate JWT (called by otya-backend via Service Binding)
 *   POST /auth/send-verification  — send email verification OTP
 *   POST /auth/verify-email       — verify email via OTP (Bearer JWT + body { otp })
 *   GET  /auth/me                 — return user profile (JWT required)
 *   PATCH /auth/me                — update user profile (JWT required)
 *   POST /auth/backup             — write backup to Google Drive App Folder
 *   GET  /auth/backup             — read backup from Google Drive App Folder
 *   DELETE /auth/backup           — delete backup from Google Drive App Folder
 *
 * Bindings (wrangler.toml):
 *   AUTH_DB  — D1 database
 *   AUTH_KV  — KV namespace (refresh tokens, OTPs, login attempts, drive file IDs)
 *   EMAIL    — Email binding (Cloudflare Email Workers)
 *
 * Secrets (wrangler secret put):
 *   AUTH_JWT_SECRET          — HS256 signing secret for JWTs
 *   GOOGLE_CLIENT_ID         — Google OAuth client ID for ID token verification
 *   OTYA_STORE_INTERNAL_URL  — URL of the OTYA Backend internal endpoint
 *   INTERNAL_SECRET          — Shared secret for OTYA Backend internal calls
 */

import {
  generateUuid,
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  generateOtp,
  generateRefreshToken,
  type JwtPayload,
} from './crypto'

import {
  assertSchemaReady,
  getUserByEmail,
  getUserById,
  insertUser,
  upsertGoogleUser,
  updatePasswordHash,
  deleteUser,
  type D1Database,
} from './db'

import {
  findBackupFile,
  createBackupFile,
  updateBackupFile,
  downloadBackupFile,
  deleteBackupFile,
} from './drive'

// ── Env interface ─────────────────────────────────────────────────────────────

interface Env {
  AUTH_DB:                  D1Database
  AUTH_KV:                  KVNamespace
  EMAIL?:                   { send(msg: EmailMessage): Promise<void> }
  AUTH_JWT_SECRET:          string
  GOOGLE_CLIENT_ID?:        string
  CORS_ORIGIN?:             string
  OTYA_STORE_INTERNAL_URL?: string
  INTERNAL_SECRET?:         string
}

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number }): Promise<{
    keys: { name: string }[]
    list_complete: boolean
    cursor?: string
  }>
}

interface EmailMessage {
  from:    { email: string; name?: string }
  to:      { email: string }[]
  subject: string
  text:    string
}

// ── Module-level init flag (Bug 9 fix) ────────────────────────────────────────
// assertSchemaReady runs CREATE TABLE IF NOT EXISTS — idempotent but adds latency.
// We only run it once per Worker instance (cold start), not on every request.
let dbInitialised = false

// ── Token TTLs ────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_TTL_SECS   = 15 * 60           // 15 minutes
const REFRESH_TOKEN_TTL_SECS  = 30 * 24 * 60 * 60 // 30 days
const OTP_TTL_SECS            = 10 * 60            // 10 minutes
const VERIFY_OTP_TTL_SECS     = 10 * 60            // 10 minutes
const LOGIN_ATTEMPT_TTL_SECS  = 15 * 60            // 15 minutes
const MAX_LOGIN_ATTEMPTS      = 5
const MAX_LOGIN_ATTEMPTS_IP   = 20                 // per IP per 15 minutes
const LOGIN_IP_RATE_TTL_SECS  = 15 * 60            // 15 minutes
const LAST_LOGIN_IP_TTL_SECS  = 90 * 24 * 60 * 60 // 90 days

// ── CORS helpers ──────────────────────────────────────────────────────────────

/**
 * Allowed origins for CORS.
 * Mobile apps (OTYA Player, SmartPOS, GR App) send no Origin header when
 * making native HTTP requests — those are allowed by returning the primary
 * origin so the browser-side fetch polyfill (if any) still works.
 */
const ALLOWED_ORIGINS = new Set([
  'https://petersmartlink.com',
  'https://www.petersmartlink.com',
])

const PRIMARY_ORIGIN = 'https://petersmartlink.com'

/**
 * Return CORS headers for the given request.
 *
 * - If the request Origin is in the allowlist → reflect it back.
 * - If Origin is absent (native mobile HTTP) → return the primary origin.
 * - If Origin is present but NOT in the allowlist → still return the primary
 *   origin (the browser will block the response; we don't expose a wildcard).
 */
function corsHeaders(env: Env, req?: Request): Record<string, string> {
  const requestOrigin = req?.headers.get('Origin') ?? null
  const allowedOrigin =
    requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : (env.CORS_ORIGIN ?? PRIMARY_ORIGIN)

  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Otya-Drive-Token',
    'Vary': 'Origin',
  }
}

// ── Response helpers ──────────────────────────────────────────────────────────

function jsonOk(data: unknown, env: Env, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(env, req),
    },
  })
}

function jsonErr(message: string, env: Env, status = 400, req?: Request): Response {
  return jsonOk({ error: message }, env, status, req)
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

async function issueAccessToken(userId: string, email: string | null, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return signJwt({ sub: userId, email, iat: now, exp: now + ACCESS_TOKEN_TTL_SECS }, secret)
}

// ── Refresh token helpers (Bug 10 fix: dual-key pattern) ─────────────────────
//
// We store TWO KV entries per refresh token:
//   rt:{token}             -> user_id   (for fast token validation)
//   rt_user:{uid}:{token}  -> "1"       (for fast per-user revocation)
//
// This makes revokeAllRefreshTokens O(user_tokens) instead of O(all_tokens).

async function issueRefreshToken(kv: KVNamespace, userId: string): Promise<string> {
  const token = generateRefreshToken()
  await kv.put(`rt:${token}`, userId, { expirationTtl: REFRESH_TOKEN_TTL_SECS })
  await kv.put(`rt_user:${userId}:${token}`, '1', { expirationTtl: REFRESH_TOKEN_TTL_SECS })
  return token
}

async function revokeRefreshToken(kv: KVNamespace, token: string): Promise<void> {
  const userId = await kv.get(`rt:${token}`)
  await kv.delete(`rt:${token}`)
  if (userId) {
    await kv.delete(`rt_user:${userId}:${token}`)
  }
}

async function revokeAllRefreshTokens(kv: KVNamespace, userId: string): Promise<void> {
  // List all tokens for this user using the rt_user: prefix — O(user_tokens)
  let cursor: string | undefined
  do {
    const result = await kv.list({ prefix: `rt_user:${userId}:`, limit: 1000 })
    for (const key of result.keys) {
      // key.name = "rt_user:{userId}:{token}"
      const token = key.name.slice(`rt_user:${userId}:`.length)
      await kv.delete(key.name)
      await kv.delete(`rt:${token}`)
    }
    cursor = result.list_complete ? undefined : result.cursor
  } while (cursor)
}

// ── Registration / OTP rate limiting helpers (Task 2) ────────────────────────

const REG_RATE_TTL_SECS       = 60 * 60  // 1 hour
const OTP_RATE_TTL_SECS       = 60 * 60  // 1 hour
const VERIFY_RATE_TTL_SECS    = 60 * 60  // 1 hour
const VERIFY_ATTEMPT_TTL_SECS = 10 * 60  // 10 minutes
const RESET_ATTEMPT_TTL_SECS  = 10 * 60  // 10 minutes
const MAX_REG_PER_IP          = 5
const MAX_OTP_PER_EMAIL       = 3
const MAX_VERIFY_SENDS        = 3
const MAX_VERIFY_ATTEMPTS     = 8
const MAX_RESET_ATTEMPTS      = 8

interface RateLimitResult {
  allowed: boolean
  count:   number
}

async function checkRateLimit(
  kv:  KVNamespace,
  key: string,
  max: number,
  ttl: number,
): Promise<RateLimitResult> {
  const raw   = await kv.get(key)
  const count = raw ? parseInt(raw, 10) : 0
  if (count >= max) return { allowed: false, count }
  const next = count + 1
  await kv.put(key, String(next), { expirationTtl: ttl })
  return { allowed: true, count: next }
}

// ── Brute force protection helpers (Task 3) ───────────────────────────────────

async function getLoginAttempts(kv: KVNamespace, email: string): Promise<number> {
  const val = await kv.get(`login_attempts:${email}`)
  return val ? parseInt(val, 10) : 0
}

async function incrementLoginAttempts(kv: KVNamespace, email: string): Promise<number> {
  const current = await getLoginAttempts(kv, email)
  const next = current + 1
  await kv.put(`login_attempts:${email}`, String(next), { expirationTtl: LOGIN_ATTEMPT_TTL_SECS })
  return next
}

async function resetLoginAttempts(kv: KVNamespace, email: string): Promise<void> {
  await kv.delete(`login_attempts:${email}`)
}

// ── New device login alert helper (Task 4) ────────────────────────────────────

function getClientIp(req: Request): string {
  return (
    req.headers.get('CF-Connecting-IP') ??
    req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

async function checkAndAlertNewDeviceLogin(
  kv: KVNamespace,
  env: Env,
  userId: string,
  email: string,
  req: Request,
): Promise<void> {
  const currentIp = getClientIp(req)
  const kvKey     = `last_login_ip:${userId}`

  try {
    const storedIp = await kv.get(kvKey)

    // Update stored IP (fire-and-forget — don't block login)
    kv.put(kvKey, currentIp, { expirationTtl: LAST_LOGIN_IP_TTL_SECS }).catch(() => {})

    // Send alert only if IP changed and we had a stored IP
    if (storedIp && storedIp !== currentIp && env.EMAIL) {
      const now = new Date().toUTCString()
      env.EMAIL.send({
        from:    { email: 'noreply@petersmartlink.com', name: 'OTYA Player Security' },
        to:      [{ email }],
        subject: 'New login to your OTYA Player account',
        text: [
          'Hi there,',
          '',
          'We detected a new login to your OTYA Player account from a different location.',
          '',
          `IP address : ${currentIp}`,
          `Time       : ${now}`,
          '',
          'If this was you, no action is needed.',
          '',
          'If you did NOT log in, please change your password immediately at:',
          'https://petersmartlink.com',
          '',
          '— The OTYA Player Security Team',
        ].join('\n'),
      }).catch(e => console.error('[auth] New device alert email failed:', (e as Error)?.message))
    }
  } catch (e) {
    // Non-fatal — don't block login on KV errors
    console.error('[auth] checkAndAlertNewDeviceLogin failed:', (e as Error)?.message)
  }
}

// ── Google ID token verification ──────────────────────────────────────────────

interface GoogleTokenPayload {
  sub:            string
  email:          string
  email_verified: boolean
  name?:          string
  picture?:       string
  aud:            string
  iss:            string
  exp:            number
  iat:            number
}

/**
 * Verify a Google ID token using Google's tokeninfo endpoint.
 * Validates signature server-side — no JWKS fetching needed.
 */
async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleTokenPayload | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    )
    if (!res.ok) return null

    const payload = await res.json() as GoogleTokenPayload

    if (payload.aud !== clientId) return null
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      return null
    }

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) return null

    return payload
  } catch {
    return null
  }
}

// ── JWT extraction helper ─────────────────────────────────────────────────────

async function requireJwt(req: Request, env: Env): Promise<JwtPayload | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  return verifyJwt(token, env.AUTH_JWT_SECRET)
}

// ── Email verification helper ─────────────────────────────────────────────────

async function sendVerificationOtp(env: Env, userId: string, email: string): Promise<void> {
  const otp = generateOtp()
  await env.AUTH_KV.put(`verify_otp:${userId}`, otp, { expirationTtl: VERIFY_OTP_TTL_SECS })

  if (env.EMAIL) {
    await env.EMAIL.send({
      from:    { email: 'noreply@petersmartlink.com', name: 'OTYA Player' },
      to:      [{ email }],
      subject: 'Your OTYA Player verification code',
      text: [
        'Please verify your email address to complete your OTYA Player account setup.',
        '',
        'Your verification code is:',
        '',
        `    ${otp}`,
        '',
        'This code expires in 10 minutes.',
        '',
        'If you did not create an account, please ignore this email.',
        '— The OTYA Team',
      ].join('\n'),
    })
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

/** POST /auth/register */
async function handleRegister(req: Request, env: Env): Promise<Response> {
  // ── IP-based registration rate limit ──────────────────────────────────────
  const ip = getClientIp(req)
  const regRate = await checkRateLimit(env.AUTH_KV, `reg_rate:${ip}`, MAX_REG_PER_IP, REG_RATE_TTL_SECS)
  if (!regRate.allowed) {
    return jsonErr('Too many registrations from this IP. Try again in 1 hour.', env, 429)
  }

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { email, password, name } = body as { email?: string; password?: string; name?: string }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return jsonErr('Valid email is required', env)
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return jsonErr('Password must be at least 8 characters', env)
  }

  const normalizedEmail = email.toLowerCase().trim()

  const existing = await getUserByEmail(env.AUTH_DB, normalizedEmail)
  if (existing) return jsonErr('Email already registered', env, 409)

  const userId       = generateUuid()
  const passwordHash = await hashPassword(password)

  await insertUser(env.AUTH_DB, {
    id:            userId,
    email:         normalizedEmail,
    password_hash: passwordHash,
    google_id:     null,
    name:          typeof name === 'string' ? name.trim() : null,
    avatar_url:    null,
  })

  const accessToken  = await issueAccessToken(userId, normalizedEmail, env.AUTH_JWT_SECRET)
  const refreshToken = await issueRefreshToken(env.AUTH_KV, userId)

  // Send welcome email (non-fatal)
  if (env.EMAIL) {
    try {
      await env.EMAIL.send({
        from:    { email: 'noreply@petersmartlink.com', name: 'OTYA Player' },
        to:      [{ email: normalizedEmail }],
        subject: 'Welcome to OTYA Player!',
        text: [
          `Hi ${name ?? 'there'}!`,
          '',
          'Welcome to OTYA Player. Your account has been created successfully.',
          '',
          'Enjoy your music!',
          '— The OTYA Team',
        ].join('\n'),
      })
    } catch (e) {
      console.error('[auth/register] Failed to send welcome email:', (e as Error)?.message)
    }
  }

  // Send verification OTP (non-fatal)
  try {
    await sendVerificationOtp(env, userId, normalizedEmail)
  } catch (e) {
    console.error('[auth/register] Failed to send verification OTP:', (e as Error)?.message)
  }

  return jsonOk({
    ok:            true,
    access_token:  accessToken,
    refresh_token: refreshToken,
    user: {
      id:          userId,
      email:       normalizedEmail,
      name:        typeof name === 'string' ? name.trim() : null,
      is_verified: 0,
    },
  }, env, 201)
}

/** POST /auth/login */
async function handleLogin(req: Request, env: Env): Promise<Response> {
  // ── IP-based rate limit (Bug 6 fix) ──────────────────────────────────────
  // Max 20 login attempts per IP per 15 minutes (across all accounts).
  const ip = getClientIp(req)
  const ipRate = await checkRateLimit(
    env.AUTH_KV, `login_ip_rate:${ip}`, MAX_LOGIN_ATTEMPTS_IP, LOGIN_IP_RATE_TTL_SECS,
  )
  if (!ipRate.allowed) {
    return jsonErr('Too many login attempts from this IP. Try again in 15 minutes.', env, 429)
  }

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { email, password } = body as { email?: string; password?: string }

  if (!email || !password) return jsonErr('email and password are required', env)

  const normalizedEmail = (email as string).toLowerCase().trim()

  // ── Per-email brute force check ───────────────────────────────────────────
  const attempts = await getLoginAttempts(env.AUTH_KV, normalizedEmail)
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    return jsonErr('Too many failed attempts. Try again in 15 minutes.', env, 429)
  }

  const user = await getUserByEmail(env.AUTH_DB, normalizedEmail)

  if (!user || !user.password_hash) {
    await incrementLoginAttempts(env.AUTH_KV, normalizedEmail)
    return jsonErr('Invalid email or password', env, 401)
  }

  const valid = await verifyPassword(password as string, user.password_hash)
  if (!valid) {
    await incrementLoginAttempts(env.AUTH_KV, normalizedEmail)
    return jsonErr('Invalid email or password', env, 401)
  }

  // Successful login — reset attempt counter
  await resetLoginAttempts(env.AUTH_KV, normalizedEmail)

  const accessToken  = await issueAccessToken(user.id, user.email, env.AUTH_JWT_SECRET)
  const refreshToken = await issueRefreshToken(env.AUTH_KV, user.id)

  // New device login alert (Task 4) — fire-and-forget
  if (user.email) checkAndAlertNewDeviceLogin(env.AUTH_KV, env, user.id, user.email, req).catch(() => {})

  return jsonOk({
    ok:            true,
    access_token:  accessToken,
    refresh_token: refreshToken,
    user: {
      id:          user.id,
      email:       user.email,
      name:        user.name,
      avatar_url:  user.avatar_url,
      is_verified: user.is_verified,
    },
  }, env)
}

/** POST /auth/refresh */
async function handleRefresh(req: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { refresh_token } = body as { refresh_token?: string }
  if (!refresh_token) return jsonErr('refresh_token is required', env)

  const userId = await env.AUTH_KV.get(`rt:${refresh_token}`)
  if (!userId) return jsonErr('Invalid or expired refresh token', env, 401)

  const user = await getUserById(env.AUTH_DB, userId)
  if (!user) {
    await revokeRefreshToken(env.AUTH_KV, refresh_token)
    return jsonErr('User not found', env, 401)
  }

  const accessToken = await issueAccessToken(user.id, user.email, env.AUTH_JWT_SECRET)

  return jsonOk({
    ok:           true,
    access_token: accessToken,
    user: {
      id:          user.id,
      email:       user.email,
      name:        user.name,
      avatar_url:  user.avatar_url,
      is_verified: user.is_verified,
    },
  }, env)
}

/** POST /auth/logout */
async function handleLogout(req: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { refresh_token } = body as { refresh_token?: string }
  if (!refresh_token) return jsonErr('refresh_token is required', env)

  await revokeRefreshToken(env.AUTH_KV, refresh_token)
  return jsonOk({ ok: true }, env)
}

/** POST /auth/google */
async function handleGoogle(req: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { id_token } = body as { id_token?: string }
  if (!id_token) return jsonErr('id_token is required', env)

  if (!env.GOOGLE_CLIENT_ID) {
    return jsonErr('Google auth not configured', env, 503)
  }

  const googlePayload = await verifyGoogleIdToken(id_token, env.GOOGLE_CLIENT_ID)
  if (!googlePayload) return jsonErr('Invalid Google ID token', env, 401)

  const { sub: googleId, email, name, picture } = googlePayload
  const normalizedEmail = email.toLowerCase().trim()

  const user = await upsertGoogleUser(env.AUTH_DB, {
    id:         generateUuid(),
    email:      normalizedEmail,
    google_id:  googleId,
    name:       name ?? null,
    avatar_url: picture ?? null,
  })

  if (!user) return jsonErr('Failed to create or update user', env, 500)

  const accessToken  = await issueAccessToken(user.id, user.email, env.AUTH_JWT_SECRET)
  const refreshToken = await issueRefreshToken(env.AUTH_KV, user.id)

  // New device login alert (Task 4) — fire-and-forget
  if (user.email) checkAndAlertNewDeviceLogin(env.AUTH_KV, env, user.id, user.email, req).catch(() => {})

  return jsonOk({
    ok:            true,
    access_token:  accessToken,
    refresh_token: refreshToken,
    user: {
      id:          user.id,
      email:       user.email,
      name:        user.name,
      avatar_url:  user.avatar_url,
      is_verified: user.is_verified,
    },
  }, env)
}

/** POST /auth/forgot-password */
async function handleForgotPassword(req: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { email } = body as { email?: string }
  if (!email) return jsonErr('email is required', env)

  const normalizedEmail = (email as string).toLowerCase().trim()

  // ── Per-email OTP rate limit ───────────────────────────────────────────────
  // Apply before the user lookup to prevent timing-based enumeration.
  const otpRate = await checkRateLimit(
    env.AUTH_KV, `otp_rate:${normalizedEmail}`, MAX_OTP_PER_EMAIL, OTP_RATE_TTL_SECS,
  )
  if (!otpRate.allowed) {
    // Return generic success to prevent email enumeration
    return jsonOk({ ok: true, message: 'If that email exists, an OTP has been sent.' }, env)
  }

  // Always return success to prevent email enumeration
  const user = await getUserByEmail(env.AUTH_DB, normalizedEmail)
  if (!user) {
    return jsonOk({ ok: true, message: 'If that email exists, an OTP has been sent.' }, env)
  }

  const otp = generateOtp()
  await env.AUTH_KV.put(`otp:${normalizedEmail}`, otp, { expirationTtl: OTP_TTL_SECS })

  if (env.EMAIL) {
    try {
      await env.EMAIL.send({
        from:    { email: 'noreply@petersmartlink.com', name: 'OTYA Player' },
        to:      [{ email: normalizedEmail }],
        subject: 'Your OTYA Player password reset code',
        text: [
          'You requested a password reset for your OTYA Player account.',
          '',
          'Your reset code is:',
          '',
          `    ${otp}`,
          '',
          '(1 letter + 3 digits — enter it exactly as shown)',
          '',
          'This code expires in 10 minutes.',
          '',
          'If you did not request this, please ignore this email.',
          '— The OTYA Team',
        ].join('\n'),
      })
    } catch (e) {
      console.error('[auth/forgot-password] Failed to send OTP email:', (e as Error)?.message)
    }
  }

  return jsonOk({ ok: true, message: 'If that email exists, an OTP has been sent.' }, env)
}

/** POST /auth/reset-password */
async function handleResetPassword(req: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { email, otp, new_password } = body as {
    email?: string
    otp?: string
    new_password?: string
  }

  if (!email || !otp || !new_password) {
    return jsonErr('email, otp, and new_password are required', env)
  }
  if ((new_password as string).length < 8) {
    return jsonErr('Password must be at least 8 characters', env)
  }

  const normalizedEmail = (email as string).toLowerCase().trim()
  const resetRate = await checkRateLimit(
    env.AUTH_KV,
    `reset_attempt:${normalizedEmail}:${getClientIp(req)}`,
    MAX_RESET_ATTEMPTS,
    RESET_ATTEMPT_TTL_SECS,
  )
  if (!resetRate.allowed) {
    return jsonErr('Too many reset attempts. Request a new code and try again later.', env, 429)
  }

  const storedOtp = await env.AUTH_KV.get(`otp:${normalizedEmail}`)

  if (!storedOtp || storedOtp.toUpperCase() !== otp.trim().toUpperCase()) {
    return jsonErr('Invalid or expired OTP', env, 401)
  }

  const user = await getUserByEmail(env.AUTH_DB, normalizedEmail)
  if (!user) return jsonErr('User not found', env, 404)

  const newHash = await hashPassword(new_password as string)
  await updatePasswordHash(env.AUTH_DB, user.id, newHash)
  await env.AUTH_KV.delete(`otp:${normalizedEmail}`)
  await env.AUTH_KV.delete(`reset_attempt:${normalizedEmail}:${getClientIp(req)}`)
  await revokeAllRefreshTokens(env.AUTH_KV, user.id)

  return jsonOk({ ok: true, message: 'Password updated successfully. Please sign in again.' }, env)
}

/** POST /auth/delete-account */
async function handleDeleteAccount(req: Request, env: Env): Promise<Response> {
  const payload = await requireJwt(req, env)
  if (!payload) return jsonErr('Authorization header required or token invalid', env, 401)

  const user = await getUserById(env.AUTH_DB, payload.sub)
  if (!user) return jsonErr('User not found', env, 404)

  await deleteUser(env.AUTH_DB, payload.sub)
  await revokeAllRefreshTokens(env.AUTH_KV, payload.sub)

  // Clean up Drive file ID from KV
  await env.AUTH_KV.delete(`drive_file:${payload.sub}`)

  // Notify OTYA Backend to delete all user data (Gap 5) — fire-and-forget
  if (env.OTYA_STORE_INTERNAL_URL && env.INTERNAL_SECRET) {
    fetch(`${env.OTYA_STORE_INTERNAL_URL}/api/internal/delete-user`, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'X-Internal-Secret': env.INTERNAL_SECRET,
      },
      body: JSON.stringify({ user_id: payload.sub }),
    }).catch(e => console.error('[auth/delete-account] Failed to notify OTYA Backend:', (e as Error)?.message))
  }

  return jsonOk({ ok: true, message: 'Account deleted.' }, env)
}

/** GET /auth/verify — called by otya-backend via Service Binding */
async function handleVerify(req: Request, env: Env): Promise<Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonErr('Authorization header required', env, 401)
  }

  const token   = authHeader.slice(7)
  const payload = await verifyJwt(token, env.AUTH_JWT_SECRET)

  if (!payload) {
    return jsonOk({ ok: false, error: 'Invalid or expired token' }, env, 401)
  }

  return jsonOk({
    ok:      true,
    user_id: payload.sub,
    email:   payload.email,
  }, env)
}

/** POST /auth/send-verification */
async function handleSendVerification(req: Request, env: Env): Promise<Response> {
  const payload = await requireJwt(req, env)
  if (!payload) return jsonErr('Authorization header required or token invalid', env, 401)

  const user = await getUserById(env.AUTH_DB, payload.sub)
  if (!user) return jsonErr('User not found', env, 404)
  if (!user.email) return jsonErr('Add an email address to your OTYA Account before verifying email.', env, 400)

  if (user.is_verified) {
    return jsonOk({ ok: true, message: 'Email already verified.' }, env)
  }

  const sendRate = await checkRateLimit(
    env.AUTH_KV, `verify_send:${payload.sub}`, MAX_VERIFY_SENDS, VERIFY_RATE_TTL_SECS,
  )
  if (!sendRate.allowed) {
    return jsonErr('Too many verification codes requested. Try again later.', env, 429)
  }

  try {
    await sendVerificationOtp(env, user.id, user.email)
  } catch (e) {
    console.error('[auth/send-verification] Failed:', (e as Error)?.message)
    return jsonErr('Failed to send verification OTP', env, 500)
  }

  return jsonOk({ ok: true, message: 'Verification OTP sent.' }, env)
}

/** POST /auth/verify-email — verify email via OTP (Bearer JWT + body { otp }) */
async function handleVerifyEmail(req: Request, env: Env): Promise<Response> {
  const payload = await requireJwt(req, env)
  if (!payload) return jsonErr('Authorization header required or token invalid', env, 401)

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { otp } = body as { otp?: string }
  if (!otp || typeof otp !== 'string') {
    return jsonErr('otp is required', env, 400)
  }

  const verifyRate = await checkRateLimit(
    env.AUTH_KV, `verify_attempt:${payload.sub}`, MAX_VERIFY_ATTEMPTS, VERIFY_ATTEMPT_TTL_SECS,
  )
  if (!verifyRate.allowed) {
    return jsonErr('Too many verification attempts. Request a new code and try again later.', env, 429)
  }

  const storedOtp = await env.AUTH_KV.get(`verify_otp:${payload.sub}`)
  if (!storedOtp) {
    return jsonErr('No pending verification OTP — request a new one', env, 400)
  }

  // Case-insensitive comparison, trim whitespace
  if (storedOtp.toUpperCase() !== otp.trim().toUpperCase()) {
    return jsonErr('Invalid or expired OTP', env, 401)
  }

  try {
    await env.AUTH_DB.prepare(
      "UPDATE users SET is_verified = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(payload.sub).run()
  } catch (e) {
    console.error('[auth/verify-email] D1 update failed:', (e as Error)?.message)
    return jsonErr('Failed to verify email', env, 500)
  }

  await env.AUTH_KV.delete(`verify_otp:${payload.sub}`)
  await env.AUTH_KV.delete(`verify_attempt:${payload.sub}`)

  return jsonOk({ ok: true, message: 'Email verified successfully.' }, env)
}

/** GET /auth/me (Task 6) */
async function handleGetMe(req: Request, env: Env): Promise<Response> {
  const payload = await requireJwt(req, env)
  if (!payload) return jsonErr('Authorization header required or token invalid', env, 401)

  const user = await getUserById(env.AUTH_DB, payload.sub)
  if (!user) return jsonErr('User not found', env, 404)

  return jsonOk({
    ok: true,
    user: {
      id:          user.id,
      email:       user.email,
      name:        user.name,
      avatar_url:  user.avatar_url,
      is_verified: user.is_verified,
      created_at:  user.created_at,
    },
  }, env)
}

/** PATCH /auth/me (Task 6) */
async function handlePatchMe(req: Request, env: Env): Promise<Response> {
  const payload = await requireJwt(req, env)
  if (!payload) return jsonErr('Authorization header required or token invalid', env, 401)

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { name, avatar_url } = body as { name?: string; avatar_url?: string }

  if (name === undefined && avatar_url === undefined) {
    return jsonErr('At least one of name or avatar_url is required', env, 400)
  }

  // Build update query dynamically based on provided fields
  const setClauses: string[] = ["updated_at = datetime('now')"]
  const binds: unknown[]     = []

  if (name !== undefined) {
    setClauses.push('name = ?')
    binds.push(typeof name === 'string' ? name.trim() : null)
  }
  if (avatar_url !== undefined) {
    setClauses.push('avatar_url = ?')
    binds.push(typeof avatar_url === 'string' ? avatar_url.trim() : null)
  }

  binds.push(payload.sub)

  try {
    await env.AUTH_DB.prepare(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...binds).run()
  } catch (e) {
    console.error('[auth/me PATCH] D1 update failed:', (e as Error)?.message)
    return jsonErr('Failed to update profile', env, 500)
  }

  const user = await getUserById(env.AUTH_DB, payload.sub)
  if (!user) return jsonErr('User not found', env, 404)

  return jsonOk({
    ok: true,
    user: {
      id:          user.id,
      email:       user.email,
      name:        user.name,
      avatar_url:  user.avatar_url,
      is_verified: user.is_verified,
      created_at:  user.created_at,
    },
  }, env)
}

// ── Drive backup handlers (Task 2) ────────────────────────────────────────────

/** POST /auth/backup */
async function handleBackupPost(req: Request, env: Env): Promise<Response> {
  const payload = await requireJwt(req, env)
  if (!payload) return jsonErr('Authorization header required or token invalid', env, 401)

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { drive_token, data } = body as { drive_token?: string; data?: unknown }
  if (!drive_token || typeof drive_token !== 'string') {
    return jsonErr('drive_token is required', env, 400)
  }
  if (data === undefined) {
    return jsonErr('data is required', env, 400)
  }

  try {
    // Check if we already have a file ID cached in KV
    let fileId = await env.AUTH_KV.get(`drive_file:${payload.sub}`)

    if (!fileId) {
      // Search Drive for existing file
      fileId = await findBackupFile(drive_token)
    }

    if (fileId) {
      // Update existing file
      await updateBackupFile(drive_token, fileId, data)
    } else {
      // Create new file
      fileId = await createBackupFile(drive_token, data)
    }

    // Cache the file ID in KV (90 days TTL)
    await env.AUTH_KV.put(`drive_file:${payload.sub}`, fileId, { expirationTtl: 90 * 24 * 60 * 60 })

    return jsonOk({ ok: true, file_id: fileId }, env)
  } catch (e) {
    console.error('[auth/backup POST] Drive operation failed:', (e as Error)?.message)
    return jsonErr(`Drive backup failed: ${(e as Error)?.message ?? 'unknown error'}`, env, 502)
  }
}

/** GET /auth/backup */
async function handleBackupGet(req: Request, env: Env): Promise<Response> {
  const payload = await requireJwt(req, env)
  if (!payload) return jsonErr('Authorization header required or token invalid', env, 401)

  const url         = new URL(req.url)
  const drive_token = req.headers.get('X-Otya-Drive-Token') ?? url.searchParams.get('drive_token')
  if (!drive_token) return jsonErr('Google Drive permission is required', env, 400)

  try {
    let fileId = await env.AUTH_KV.get(`drive_file:${payload.sub}`)

    if (!fileId) {
      fileId = await findBackupFile(drive_token)
      if (!fileId) {
        return jsonOk({ ok: true, data: null }, env)
      }
      await env.AUTH_KV.put(`drive_file:${payload.sub}`, fileId, { expirationTtl: 90 * 24 * 60 * 60 })
    }

    const data = await downloadBackupFile(drive_token, fileId)
    return jsonOk({ ok: true, data }, env)
  } catch (e) {
    console.error('[auth/backup GET] Drive operation failed:', (e as Error)?.message)
    return jsonErr(`Drive restore failed: ${(e as Error)?.message ?? 'unknown error'}`, env, 502)
  }
}

/** DELETE /auth/backup */
async function handleBackupDelete(req: Request, env: Env): Promise<Response> {
  const payload = await requireJwt(req, env)
  if (!payload) return jsonErr('Authorization header required or token invalid', env, 401)

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return jsonErr('Invalid JSON body', env) }

  const { drive_token } = body as { drive_token?: string }
  if (!drive_token || typeof drive_token !== 'string') {
    return jsonErr('drive_token is required', env, 400)
  }

  try {
    const fileId = await env.AUTH_KV.get(`drive_file:${payload.sub}`)

    if (fileId) {
      await deleteBackupFile(drive_token, fileId)
      await env.AUTH_KV.delete(`drive_file:${payload.sub}`)
    }

    return jsonOk({ ok: true }, env)
  } catch (e) {
    console.error('[auth/backup DELETE] Drive operation failed:', (e as Error)?.message)
    return jsonErr(`Drive delete failed: ${(e as Error)?.message ?? 'unknown error'}`, env, 502)
  }
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Ensure schema once per Worker instance (Bug 9 fix — not on every request)
    if (!dbInitialised) {
      try {
        await assertSchemaReady(env.AUTH_DB)
        dbInitialised = true
      } catch (e) {
        console.error('[auth] assertSchemaReady failed:', (e as Error)?.message)
      }
    }

    const url    = new URL(request.url)
    const path   = url.pathname
    const method = request.method.toUpperCase()

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env, request),
      })
    }

    try {
      if (method === 'POST' && path === '/auth/register') {
        return handleRegister(request, env)
      }
      if (method === 'POST' && path === '/auth/login') {
        return handleLogin(request, env)
      }
      if (method === 'POST' && path === '/auth/refresh') {
        return handleRefresh(request, env)
      }
      if (method === 'POST' && path === '/auth/logout') {
        return handleLogout(request, env)
      }
      if (method === 'POST' && path === '/auth/google') {
        return handleGoogle(request, env)
      }
      if (method === 'POST' && path === '/auth/forgot-password') {
        return handleForgotPassword(request, env)
      }
      if (method === 'POST' && path === '/auth/reset-password') {
        return handleResetPassword(request, env)
      }
      if (method === 'POST' && path === '/auth/delete-account') {
        return handleDeleteAccount(request, env)
      }
      if (method === 'GET' && path === '/auth/verify') {
        return handleVerify(request, env)
      }
      if (method === 'POST' && path === '/auth/send-verification') {
        return handleSendVerification(request, env)
      }
      if (method === 'POST' && path === '/auth/verify-email') {
        return handleVerifyEmail(request, env)
      }
      if (method === 'GET' && path === '/auth/me') {
        return handleGetMe(request, env)
      }
      if (method === 'PATCH' && path === '/auth/me') {
        return handlePatchMe(request, env)
      }
      if (method === 'POST' && path === '/auth/backup') {
        return handleBackupPost(request, env)
      }
      if (method === 'GET' && path === '/auth/backup') {
        return handleBackupGet(request, env)
      }
      if (method === 'DELETE' && path === '/auth/backup') {
        return handleBackupDelete(request, env)
      }

      return jsonErr('Not found', env, 404)
    } catch (e) {
      console.error('[auth] Unhandled error:', (e as Error)?.message, (e as Error)?.stack)
      return jsonErr('Internal server error', env, 500)
    }
  },
} satisfies ExportedHandler<Env>
