import type { D1Database } from './db'

export interface AuthSecurityEventEnv {
  AUTH_DB: D1Database
}

const DIRECT_EVENT_TYPES: Record<string, string> = {
  '/auth/register': 'registration',
  '/auth/login': 'password_login',
  '/auth/google': 'google_login',
  '/auth/logout': 'logout',
  '/auth/forgot-password': 'password_reset_requested',
  '/auth/reset-password': 'password_reset',
  '/auth/send-verification': 'verification_code_requested',
  '/auth/verify-email': 'email_verification',
  '/auth/delete-account': 'account_deletion',
  '/auth/google/link': 'google_link',
}

function safeSuffix(value: string): string {
  return value
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 64)
}

export function authSecurityEventType(pathname: string): string | null {
  const direct = DIRECT_EVENT_TYPES[pathname]
  if (direct) return direct

  if (pathname.startsWith('/auth/admin/')) {
    const suffix = safeSuffix(pathname.slice('/auth/admin/'.length))
    return suffix ? `admin_${suffix}` : 'admin_auth'
  }

  if (pathname.startsWith('/auth/telegram/')) {
    const suffix = safeSuffix(pathname.slice('/auth/telegram/'.length))
    return suffix ? `telegram_${suffix}` : 'telegram_auth'
  }

  return null
}

export function authSecurityOutcome(status: number): string {
  if (status >= 200 && status < 300) return 'success'
  if (status === 401 || status === 403) return 'denied'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'error'
  return 'rejected'
}

async function responseUserId(response: Response): Promise<string | null> {
  if (!response.ok) return null
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null

  try {
    const data = await response.clone().json() as Record<string, unknown>
    if (typeof data.user_id === 'string' && data.user_id) return data.user_id
    const user = data.user
    if (user && typeof user === 'object' && !Array.isArray(user)) {
      const id = (user as Record<string, unknown>).id
      if (typeof id === 'string' && id) return id
    }
  } catch {
    // Security logging must never alter an otherwise valid auth response.
  }
  return null
}

/**
 * Persist material authentication/security decisions without credentials or
 * high-risk request data. This function is intentionally failure-isolated:
 * the identity request keeps its original result if the evidence store is
 * temporarily unavailable.
 */
export async function recordAuthSecurityEvent(
  request: Request,
  response: Response,
  env: AuthSecurityEventEnv,
): Promise<void> {
  const pathname = new URL(request.url).pathname
  const eventType = authSecurityEventType(pathname)
  if (!eventType || !env.AUTH_DB?.prepare) return

  try {
    const userId = await responseUserId(response)
    const requestId = (request.headers.get('cf-ray') ?? '').trim().slice(0, 128) || null
    await env.AUTH_DB.prepare(`
      INSERT INTO auth_security_events (
        event_type, user_id, status, http_status, request_id
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      eventType,
      userId,
      authSecurityOutcome(response.status),
      response.status,
      requestId,
    ).run()
  } catch (error) {
    console.error('[auth/security-events] Could not persist security evidence:', (error as Error)?.message)
  }
}

export async function withAuthSecurityEvent(
  request: Request,
  response: Response,
  env: AuthSecurityEventEnv,
): Promise<Response> {
  await recordAuthSecurityEvent(request, response, env)
  return response
}
