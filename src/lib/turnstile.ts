import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest } from 'next/server'

const TURNSTILE_VERIFY_TIMEOUT_MS = 8000

type TurnstileVerification = {
  success?: boolean
  hostname?: string
  'error-codes'?: string[]
}

export type TurnstileResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 503; error: string; code: string }

async function cloudflareEnv(): Promise<Record<string, unknown>> {
  const { env } = await getCloudflareContext({ async: true })
  return env as Record<string, unknown>
}

export async function getTurnstilePublicConfig() {
  const env = await cloudflareEnv()
  const siteKey = typeof env.TURNSTILE_SITE_KEY === 'string'
    ? env.TURNSTILE_SITE_KEY.trim()
    : ''
  return { turnstile: Boolean(siteKey), siteKey }
}

function invalidTurnstile(): TurnstileResult {
  return {
    ok: false,
    status: 403,
    error: 'The security check could not be verified. Please try again.',
    code: 'TURNSTILE_INVALID',
  }
}

export async function verifyTurnstileToken(
  token: unknown,
  request: NextRequest,
): Promise<TurnstileResult> {
  const value = typeof token === 'string' ? token.trim() : ''
  if (!value) {
    return {
      ok: false,
      status: 400,
      error: 'Complete the security check and try again.',
      code: 'TURNSTILE_REQUIRED',
    }
  }

  const env = await cloudflareEnv()
  const secret = typeof env.TURNSTILE_SECRET_KEY === 'string'
    ? env.TURNSTILE_SECRET_KEY.trim()
    : ''
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: 'Security verification is temporarily unavailable.',
      code: 'TURNSTILE_UNAVAILABLE',
    }
  }

  const form = new FormData()
  form.set('secret', secret)
  form.set('response', value)
  const remoteIp = request.headers.get('CF-Connecting-IP')?.trim()
  if (remoteIp) form.set('remoteip', remoteIp)

  let response: Response
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      cache: 'no-store',
      signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
    })
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'Security verification is temporarily unavailable.',
      code: 'TURNSTILE_UNAVAILABLE',
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 503,
      error: 'Security verification is temporarily unavailable.',
      code: 'TURNSTILE_UNAVAILABLE',
    }
  }

  const result = await response.json().catch(() => ({})) as TurnstileVerification
  if (result.success !== true) return invalidTurnstile()

  // A valid Turnstile proof is also bound to the hostname where the browser
  // challenge was solved. This prevents a token minted on another allowed
  // Turnstile hostname from being replayed against an Otya auth endpoint.
  const expectedHostname = request.nextUrl.hostname.trim().toLowerCase()
  const verifiedHostname = typeof result.hostname === 'string'
    ? result.hostname.trim().toLowerCase()
    : ''
  if (!expectedHostname || verifiedHostname !== expectedHostname) {
    return invalidTurnstile()
  }

  return { ok: true }
}
