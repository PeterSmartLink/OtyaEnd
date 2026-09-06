import { verifyJwt } from './crypto'
import { assertSchemaReady, getUserByEmail, type D1Database } from './db'

interface Env {
  AUTH_DB: D1Database
  AUTH_JWT_SECRET: string
}

const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 24
const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'api',
  'help',
  'moderator',
  'official',
  'otya',
  'security',
  'staff',
  'support',
  'system',
])

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

async function userIdFromRequest(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return (await verifyJwt(auth.slice(7), env.AUTH_JWT_SECRET))?.sub ?? null
}

const clean = (value: unknown, max: number): string | null => {
  if (value === null) return null
  if (typeof value !== 'string') return null
  const normalized = value.trim().slice(0, max)
  return normalized || null
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const withoutAt = value.trim().replace(/^@+/, '').toLowerCase()
  return withoutAt || null
}

function validUsername(value: string | null): value is string {
  if (!value) return false
  if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) return false
  if (!/^[a-z][a-z0-9_]*$/.test(value)) return false
  return !RESERVED_USERNAMES.has(value)
}

function validEmail(value: string | null): value is string {
  return value !== null && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validRecoveryEmail(value: string | null): boolean {
  return value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validCountryCode(value: string | null): boolean {
  return value === null || /^[A-Z]{2}$/.test(value)
}

function validLocale(value: string | null): boolean {
  return value === null || /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/.test(value)
}

function validTimezone(value: string | null): boolean {
  if (value === null) return true
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function uniqueConstraint(error: unknown): boolean {
  const message = String(error).toLowerCase()
  return message.includes('unique constraint') ||
    message.includes('constraint failed') ||
    message.includes('sqlite_constraint')
}

async function lookupPublicUsername(
  usernameQuery: string,
  env: Env,
): Promise<Response> {
  const username = normalizeUsername(usernameQuery)
  if (!validUsername(username)) {
    return json({
      error: 'Enter a valid Otya username.',
      code: 'INVALID_USERNAME',
    }, 400)
  }

  const user = await env.AUTH_DB.prepare(`
    SELECT otya_id, username, name, avatar_url
    FROM users
    WHERE lower(username) = lower(?)
    LIMIT 1
  `).bind(username).first<Record<string, unknown>>()

  if (!user) {
    return json({ error: 'Otya user not found.', code: 'USERNAME_NOT_FOUND' }, 404)
  }

  return json({ ok: true, user })
}

export async function handleAccountProfile(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/auth/account') return null
  if (request.method !== 'GET' && request.method !== 'PATCH') return json({ error: 'Method not allowed' }, 405)

  let userId: string | null = null
  try {
    userId = await userIdFromRequest(request, env)
  } catch (error) {
    console.error('[auth/account] Token verification failed:', (error as Error)?.message)
    return json({ error: 'Your Otya session could not be verified. Please sign in again.' }, 401)
  }
  if (!userId) return json({ error: 'Sign in required' }, 401)

  try {
    await assertSchemaReady(env.AUTH_DB)
  } catch (error) {
    console.error('[auth/account] Schema readiness check failed:', (error as Error)?.message)
    return json({ error: 'Otya account storage is temporarily unavailable. Please try again.' }, 503)
  }

  try {
    const lookupUsername = url.searchParams.get('lookup_username')
    if (request.method === 'GET' && lookupUsername !== null) {
      return lookupPublicUsername(lookupUsername, env)
    }

    if (request.method === 'PATCH') {
      const body = await request.json().catch(() => null) as Record<string, unknown> | null
      if (!body) return json({ error: 'Invalid JSON body' }, 400)

      const allowed = [
        'email',
        'username',
        'name',
        'avatar_url',
        'recovery_email',
        'country_code',
        'locale',
        'timezone',
      ] as const
      if (!allowed.some(key => Object.prototype.hasOwnProperty.call(body, key))) {
        return json({ error: 'No supported profile fields supplied' }, 400)
      }

      const updates: string[] = ["updated_at = datetime('now')"]
      const values: unknown[] = []

      if ('email' in body) {
        const email = clean(body.email, 254)?.toLowerCase() ?? null
        if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400)

        const current = await env.AUTH_DB.prepare('SELECT email FROM users WHERE id = ? LIMIT 1')
          .bind(userId)
          .first<{ email?: string | null }>()
        if (!current) return json({ error: 'Account not found. Please sign in again.' }, 404)

        const currentEmail = current.email?.trim().toLowerCase() ?? null
        if (currentEmail && currentEmail !== email) {
          return json({
            error: 'Changing an existing primary email requires the dedicated verified email-change flow.',
            code: 'EMAIL_CHANGE_REQUIRES_VERIFICATION',
          }, 409)
        }

        const owner = await getUserByEmail(env.AUTH_DB, email)
        if (owner && owner.id !== userId) {
          return json({ error: 'That email is already connected to another Otya account.', code: 'EMAIL_IN_USE' }, 409)
        }

        if (!currentEmail) {
          updates.push('email = ?', 'is_verified = 0')
          values.push(email)
        }
      }

      if ('username' in body) {
        const username = normalizeUsername(body.username)
        if (!validUsername(username)) {
          return json({
            error: 'Username must be 3–24 characters, start with a letter, and use only letters, numbers or underscore.',
            code: 'INVALID_USERNAME',
          }, 400)
        }

        const current = await env.AUTH_DB.prepare(`
          SELECT username, username_changed_at
          FROM users WHERE id = ? LIMIT 1
        `).bind(userId).first<{ username?: string | null; username_changed_at?: string | null }>()
        if (!current) return json({ error: 'Account not found. Please sign in again.' }, 404)

        const existing = current.username?.trim().toLowerCase() ?? null
        if (existing !== username) {
          const changedAt = current.username_changed_at ? Date.parse(current.username_changed_at) : Number.NaN
          if (existing && Number.isFinite(changedAt)) {
            const availableAtMs = changedAt + USERNAME_CHANGE_COOLDOWN_MS
            if (Date.now() < availableAtMs) {
              return json({
                error: 'Your Otya username can be changed once every 30 days.',
                code: 'USERNAME_CHANGE_COOLDOWN',
                available_at: new Date(availableAtMs).toISOString(),
              }, 429)
            }
          }

          const owner = await env.AUTH_DB.prepare(`
            SELECT id FROM users WHERE lower(username) = lower(?) LIMIT 1
          `).bind(username).first<{ id: string }>()
          if (owner && owner.id !== userId) {
            return json({ error: 'That Otya username is already taken.', code: 'USERNAME_TAKEN' }, 409)
          }

          updates.push('username = ?', "username_changed_at = datetime('now')")
          values.push(username)
        }
      }

      if ('name' in body) {
        updates.push('name = ?')
        values.push(clean(body.name, 120))
      }
      if ('avatar_url' in body) {
        const avatar = clean(body.avatar_url, 1000)
        if (avatar && !/^https:\/\//i.test(avatar)) return json({ error: 'avatar_url must use HTTPS' }, 400)
        updates.push('avatar_url = ?')
        values.push(avatar)
      }
      if ('recovery_email' in body) {
        const recovery = clean(body.recovery_email, 254)?.toLowerCase() ?? null
        if (!validRecoveryEmail(recovery)) return json({ error: 'Invalid recovery email' }, 400)
        updates.push('recovery_email = ?', 'recovery_email_verified_at = NULL')
        values.push(recovery)
      }
      if ('country_code' in body) {
        const country = clean(body.country_code, 2)?.toUpperCase() ?? null
        if (!validCountryCode(country)) return json({ error: 'country_code must be a two-letter code' }, 400)
        updates.push('country_code = ?')
        values.push(country)
      }
      if ('locale' in body) {
        const locale = clean(body.locale, 35)
        if (!validLocale(locale)) return json({ error: 'Invalid locale' }, 400)
        updates.push('locale = ?')
        values.push(locale)
      }
      if ('timezone' in body) {
        const timezone = clean(body.timezone, 80)
        if (!validTimezone(timezone)) return json({ error: 'Invalid timezone' }, 400)
        updates.push('timezone = ?')
        values.push(timezone)
      }

      values.push(userId)
      try {
        await env.AUTH_DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
      } catch (error) {
        if (uniqueConstraint(error) && 'username' in body) {
          return json({ error: 'That Otya username is already taken.', code: 'USERNAME_TAKEN' }, 409)
        }
        throw error
      }
    }

    const user = await env.AUTH_DB.prepare(`
      SELECT id, otya_id, username, username_changed_at, email, name, avatar_url, is_verified,
             phone_number, phone_verified_at, phone_verification_method,
             recovery_email, recovery_email_verified_at, country_code, locale,
             timezone, created_at, updated_at
      FROM users WHERE id = ?
    `).bind(userId).first<Record<string, unknown>>()
    if (!user) return json({ error: 'Account not found. Please sign in again.' }, 404)

    // Connected identities and product history are useful account metadata, but
    // they must never make the primary account profile unavailable if a legacy
    // deployment is still completing its schema migration.
    let identities: Record<string, unknown>[] = []
    let products: Record<string, unknown>[] = []
    try {
      identities = (await env.AUTH_DB.prepare(`
        SELECT provider, provider_username, linked_at, last_used_at
        FROM linked_identities WHERE user_id = ? ORDER BY provider
      `).bind(userId).all<Record<string, unknown>>()).results
    } catch (error) {
      console.error('[auth/account] Linked identities read failed:', (error as Error)?.message)
    }
    try {
      products = (await env.AUTH_DB.prepare(`
        SELECT product_id, status, first_seen_at, last_seen_at
        FROM user_products WHERE user_id = ? ORDER BY last_seen_at DESC
      `).bind(userId).all<Record<string, unknown>>()).results
    } catch (error) {
      console.error('[auth/account] Product history read failed:', (error as Error)?.message)
    }

    return json({ ok: true, user, identities, products })
  } catch (error) {
    console.error('[auth/account] Account request failed:', (error as Error)?.message)
    return json({ error: 'Could not load your Otya account. Please try again.' }, 503)
  }
}
