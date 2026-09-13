import { generateOtp, verifyJwt } from './crypto'
import { sendResendEmail } from './resend'
import { assertSchemaReady, getUserById, type D1Database } from './db'

interface KVNamespaceLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface AdminMfaEnv {
  AUTH_DB: D1Database
  AUTH_KV: KVNamespaceLike
  AUTH_JWT_SECRET: string
  RESEND_API_KEY?: string
  ADMIN_EMAILS?: string
  INTERNAL_SECRET?: string
}

const OTP_TTL = 10 * 60
const OTP_WINDOW_TTL = 15 * 60
const OTP_MAX_SENDS = 5
const OTP_MAX_ATTEMPTS = 8
const TELEGRAM_WINDOW_TTL = 10 * 60
const COMPLETE_TTL = 5 * 60
const TELEGRAM_CHALLENGE_PREFIX = 'admin_mfa_challenge:'
// Next is a private owner device, not a browser admin session. Once the owner
// completes the strong enrollment ceremony, keep the trusted device usable and
// renew it at most weekly. A new enrollment automatically replaces the previous
// trusted phone. Logout/revocation still removes access immediately.
const OWNER_GRANT_TTL = 30 * 24 * 60 * 60
const OWNER_GRANT_RENEW_AFTER = 7 * 24 * 60 * 60
const OWNER_GRANT_HEADER = 'X-OTYA-Owner-Grant'
const OWNER_DEVICE_HEADER = 'X-OTYA-Device-ID'

type OwnerGrantRecord = {
  digest: string
  device_hash: string
  issued_at: number
  renewed_at: number
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function allowlist(env: AdminMfaEnv): Set<string> {
  return new Set((env.ADMIN_EMAILS ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean))
}

async function currentUser(request: Request, env: AdminMfaEnv) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = await verifyJwt(auth.slice(7), env.AUTH_JWT_SECRET)
  if (!payload?.sub) return null
  await assertSchemaReady(env.AUTH_DB)
  return getUserById(env.AUTH_DB, payload.sub)
}

async function bump(env: AdminMfaEnv, key: string, max: number, ttl: number): Promise<boolean> {
  const raw = await env.AUTH_KV.get(key)
  const count = raw ? Number.parseInt(raw, 10) : 0
  if (count >= max) return false
  await env.AUTH_KV.put(key, String(count + 1), { expirationTtl: ttl })
  return true
}

function randomToken(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes))
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function digest(value: string): Promise<string> {
  const raw = new TextEncoder().encode(value)
  const hashed = await crypto.subtle.digest('SHA-256', raw)
  return toHex(new Uint8Array(hashed))
}

async function otpDigest(userId: string, otp: string): Promise<string> {
  return digest(`otya-admin-mfa:${userId}:${otp.trim().toUpperCase()}`)
}

async function telegramChallengeDigest(challenge: string): Promise<string> {
  return digest(`otya-admin-telegram-challenge:${challenge.trim()}`)
}

function deviceIdFrom(request: Request): string {
  const raw = request.headers.get(OWNER_DEVICE_HEADER)?.trim() ?? ''
  return /^[A-Za-z0-9._:-]{20,180}$/.test(raw) ? raw : ''
}

async function deviceDigest(deviceId: string): Promise<string> {
  return digest(`otya-owner-device:${deviceId}`)
}

async function ownerGrantDigest(userId: string, deviceId: string, token: string): Promise<string> {
  return digest(`otya-owner-grant:${userId}:${deviceId}:${token.trim()}`)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function requireAllowedAdmin(request: Request, env: AdminMfaEnv) {
  const user = await currentUser(request, env)
  if (!user?.email || !allowlist(env).has(user.email.toLowerCase())) return null
  return user
}

async function issueMobileOwnerGrant(env: AdminMfaEnv, userId: string, deviceId: string): Promise<string> {
  const grant = randomToken()
  const now = Math.floor(Date.now() / 1000)
  const record: OwnerGrantRecord = {
    digest: await ownerGrantDigest(userId, deviceId, grant),
    device_hash: await deviceDigest(deviceId),
    issued_at: now,
    renewed_at: now,
  }
  // One trusted owner phone at a time. Enrolling another phone replaces this
  // record, which silently revokes the previous device without a browser step.
  await env.AUTH_KV.put(
    `admin_owner_grant:${userId}`,
    JSON.stringify(record),
    { expirationTtl: OWNER_GRANT_TTL },
  )
  return grant
}

async function readOwnerGrant(env: AdminMfaEnv, userId: string): Promise<OwnerGrantRecord | null> {
  const raw = await env.AUTH_KV.get(`admin_owner_grant:${userId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<OwnerGrantRecord>
    if (!parsed.digest || !parsed.device_hash || !parsed.issued_at || !parsed.renewed_at) return null
    return parsed as OwnerGrantRecord
  } catch {
    // Old one-hour string grants intentionally do not migrate into a trusted
    // device. The owner completes the stronger enrollment once on Next.
    return null
  }
}

async function verifyMobileOwnerGrant(request: Request, env: AdminMfaEnv, userId: string): Promise<boolean> {
  const grant = request.headers.get(OWNER_GRANT_HEADER)?.trim() ?? ''
  const deviceId = deviceIdFrom(request)
  if (!grant || !deviceId) return false

  const record = await readOwnerGrant(env, userId)
  if (!record) return false
  const suppliedDevice = await deviceDigest(deviceId)
  if (!timingSafeEqual(record.device_hash, suppliedDevice)) return false
  const supplied = await ownerGrantDigest(userId, deviceId, grant)
  if (!timingSafeEqual(record.digest, supplied)) return false

  // Sliding trusted-device session, but deliberately bounded to one KV renewal
  // write per week instead of a write on every AI request.
  const now = Math.floor(Date.now() / 1000)
  if (now - record.renewed_at >= OWNER_GRANT_RENEW_AFTER) {
    record.renewed_at = now
    await env.AUTH_KV.put(
      `admin_owner_grant:${userId}`,
      JSON.stringify(record),
      { expirationTtl: OWNER_GRANT_TTL },
    )
  }
  return true
}

export async function consumeAdminMfaCompletion(request: Request, env: AdminMfaEnv): Promise<{ ok: boolean; email?: string }> {
  const user = await requireAllowedAdmin(request, env)
  if (!user) return { ok: false }
  const marker = await env.AUTH_KV.get(`admin_mfa_complete:${user.id}`)
  if (!marker) return { ok: false }
  await env.AUTH_KV.delete(`admin_mfa_complete:${user.id}`)
  return { ok: true, email: user.email!.toLowerCase() }
}

export async function markAdminTelegramComplete(env: AdminMfaEnv, userId: string): Promise<void> {
  const pending = await env.AUTH_KV.get(`admin_mfa_telegram:${userId}`)
  if (!pending) throw new Error('Admin email verification expired')
  await env.AUTH_KV.delete(`admin_mfa_telegram:${userId}`)
  await env.AUTH_KV.delete(`${TELEGRAM_CHALLENGE_PREFIX}${pending}`)
  await env.AUTH_KV.put(`admin_mfa_complete:${userId}`, randomToken(), { expirationTtl: COMPLETE_TTL })
}

export async function adminTelegramPending(env: AdminMfaEnv, userId: string): Promise<boolean> {
  return Boolean(await env.AUTH_KV.get(`admin_mfa_telegram:${userId}`))
}

export async function confirmAdminTelegramChallenge(
  env: AdminMfaEnv,
  challenge: string,
  telegramUserId: string,
): Promise<boolean> {
  const normalizedChallenge = challenge.trim()
  const telegramSubject = telegramUserId.trim()
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(normalizedChallenge)) return false
  if (!/^\d{4,24}$/.test(telegramSubject)) return false

  const challengeHash = await telegramChallengeDigest(normalizedChallenge)
  const userId = await env.AUTH_KV.get(`${TELEGRAM_CHALLENGE_PREFIX}${challengeHash}`)
  if (!userId) return false

  const pending = await env.AUTH_KV.get(`admin_mfa_telegram:${userId}`)
  if (!pending || !timingSafeEqual(pending, challengeHash)) return false

  await assertSchemaReady(env.AUTH_DB)
  const user = await getUserById(env.AUTH_DB, userId)
  if (!user?.email || !allowlist(env).has(user.email.toLowerCase())) return false

  const linked = await env.AUTH_DB.prepare(
    "SELECT user_id FROM linked_identities WHERE provider = 'telegram' AND provider_subject = ? LIMIT 1",
  ).bind(telegramSubject).first<{ user_id?: string }>()
  if (!linked?.user_id || linked.user_id !== userId) return false

  await env.AUTH_DB.prepare(
    "UPDATE linked_identities SET last_used_at = datetime('now') WHERE provider = 'telegram' AND provider_subject = ? AND user_id = ?",
  ).bind(telegramSubject, userId).run()
  await markAdminTelegramComplete(env, userId)
  return true
}

export async function handleAdminMfa(request: Request, env: AdminMfaEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/auth/admin/')) return null
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (url.pathname === '/auth/admin/telegram-challenge/confirm') {
    const suppliedSecret = request.headers.get('X-OTYA-Internal-Secret')?.trim() ?? ''
    if (!env.INTERNAL_SECRET || !suppliedSecret || !timingSafeEqual(suppliedSecret, env.INTERNAL_SECRET)) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const body = await request.json().catch(() => ({})) as {
      challenge?: string
      telegram_user_id?: string | number
    }
    const ok = await confirmAdminTelegramChallenge(
      env,
      String(body.challenge ?? ''),
      String(body.telegram_user_id ?? ''),
    )
    return ok
      ? json({ ok: true, owner_verified: true })
      : json({ error: 'This Next enrollment challenge is invalid, expired, or belongs to another Telegram account.', code: 'TELEGRAM_CHALLENGE_INVALID' }, 401)
  }

  const user = await requireAllowedAdmin(request, env)
  if (!user) return json({ error: 'Additional verification is required.' }, 403)

  if (url.pathname === '/auth/admin/start') {
    if (!env.RESEND_API_KEY) return json({ error: 'Admin verification email is unavailable.' }, 503)
    if (!(await bump(env, `admin_mfa_send:${user.id}`, OTP_MAX_SENDS, OTP_WINDOW_TTL))) {
      return json({ error: 'Too many verification requests. Try again later.' }, 429)
    }

    const otp = generateOtp()
    await env.AUTH_KV.put(`admin_mfa_otp:${user.id}`, await otpDigest(user.id, otp), { expirationTtl: OTP_TTL })
    await sendResendEmail(env.RESEND_API_KEY, {
      from: 'OTYA <noreply@petersmartlink.com>',
      to: [user.email!],
      subject: 'Trust this phone for Next',
      text: [
        'A request was made to enroll a trusted owner phone for Next.',
        '',
        `Verification code: ${otp}`,
        '',
        'This code expires in 10 minutes. Telegram confirmation is also required for first-time device enrollment.',
        '',
        'After enrollment, Next stays signed in on this phone until you sign out, revoke it, replace the trusted phone, or a security event requires re-verification.',
        '',
        'If you did not request this, do not share the code and review your OTYA account security.',
      ].join('\n'),
    })
    return json({ ok: true, next: 'otp' })
  }

  if (url.pathname === '/auth/admin/verify-otp') {
    if (!(await bump(env, `admin_mfa_attempt:${user.id}`, OTP_MAX_ATTEMPTS, OTP_WINDOW_TTL))) {
      return json({ error: 'Too many verification attempts. Request a new code later.' }, 429)
    }
    const body = await request.json().catch(() => ({})) as { otp?: string }
    const supplied = String(body.otp ?? '').trim().toUpperCase()
    if (!/^[A-Z][0-9]{4}$/.test(supplied)) return json({ error: 'Invalid or expired verification code.' }, 401)

    const storedDigest = await env.AUTH_KV.get(`admin_mfa_otp:${user.id}`)
    const suppliedDigest = await otpDigest(user.id, supplied)
    if (!storedDigest || !timingSafeEqual(suppliedDigest, storedDigest)) {
      return json({ error: 'Invalid or expired verification code.' }, 401)
    }

    await env.AUTH_KV.delete(`admin_mfa_otp:${user.id}`)
    await env.AUTH_KV.delete(`admin_mfa_attempt:${user.id}`)

    const oldChallengeHash = await env.AUTH_KV.get(`admin_mfa_telegram:${user.id}`)
    if (oldChallengeHash) await env.AUTH_KV.delete(`${TELEGRAM_CHALLENGE_PREFIX}${oldChallengeHash}`)

    const telegramChallenge = randomToken(18)
    const challengeHash = await telegramChallengeDigest(telegramChallenge)
    await env.AUTH_KV.put(`admin_mfa_telegram:${user.id}`, challengeHash, { expirationTtl: TELEGRAM_WINDOW_TTL })
    await env.AUTH_KV.put(`${TELEGRAM_CHALLENGE_PREFIX}${challengeHash}`, user.id, { expirationTtl: TELEGRAM_WINDOW_TTL })
    return json({
      ok: true,
      next: 'telegram',
      telegram_challenge: telegramChallenge,
      expires_in: TELEGRAM_WINDOW_TTL,
    })
  }

  if (url.pathname === '/auth/admin/consume') {
    const marker = await env.AUTH_KV.get(`admin_mfa_complete:${user.id}`)
    if (!marker) return json({ error: 'Complete Telegram verification first.' }, 401)
    await env.AUTH_KV.delete(`admin_mfa_complete:${user.id}`)
    return json({ ok: true, email: user.email!.toLowerCase() })
  }

  if (url.pathname === '/auth/admin/mobile-grant') {
    const marker = await env.AUTH_KV.get(`admin_mfa_complete:${user.id}`)
    if (!marker) return json({ error: 'Complete Telegram verification first.' }, 401)
    const deviceId = deviceIdFrom(request)
    if (!deviceId) return json({ error: 'A valid Next device identity is required.' }, 400)
    await env.AUTH_KV.delete(`admin_mfa_complete:${user.id}`)
    const grant = await issueMobileOwnerGrant(env, user.id, deviceId)
    return json({
      ok: true,
      email: user.email!.toLowerCase(),
      owner_grant: grant,
      trusted_device: true,
      expires_in: OWNER_GRANT_TTL,
      renew_after: OWNER_GRANT_RENEW_AFTER,
    })
  }

  if (url.pathname === '/auth/admin/verify-grant') {
    const ok = await verifyMobileOwnerGrant(request, env, user.id)
    return ok
      ? json({
          ok: true,
          email: user.email!.toLowerCase(),
          trusted_device: true,
          expires_in: OWNER_GRANT_TTL,
          renew_after: OWNER_GRANT_RENEW_AFTER,
        })
      : json({ error: 'Owner device verification is required.' }, 401)
  }

  if (url.pathname === '/auth/admin/revoke-grant') {
    await env.AUTH_KV.delete(`admin_owner_grant:${user.id}`)
    return json({ ok: true })
  }

  return json({ error: 'Not found' }, 404)
}
