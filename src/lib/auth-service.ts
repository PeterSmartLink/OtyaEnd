/**
 * Auth Service helper — verifies OTYA access tokens through the Auth Worker
 * service binding.
 *
 * The mobile client is an untrusted environment: no shared application secret
 * is ever accepted as proof of identity. Protected Backend endpoints require
 * a short-lived Bearer access token issued by OTYA Auth.
 */

export interface JwtVerifyResult {
  ok:       boolean
  user_id?: string
  email?:   string
  error?:   string
}

export async function verifyJwtViaService(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  token: string,
): Promise<JwtVerifyResult> {
  const authService = env.AUTH as { fetch(req: Request): Promise<Response> } | undefined

  if (!authService) {
    console.error('[auth-service] AUTH binding is not configured')
    return { ok: false, error: 'Auth service not available' }
  }

  try {
    const res = await authService.fetch(
      new Request('https://auth/auth/verify', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      }),
    )

    if (!res.ok) {
      return { ok: false, error: 'Invalid or expired token' }
    }

    const data = await res.json() as Partial<JwtVerifyResult> | null
    if (data?.ok !== true || typeof data.user_id !== 'string' || !data.user_id.trim()) {
      return { ok: false, error: 'Invalid auth service response' }
    }
    return { ok: true, user_id: data.user_id, ...(typeof data.email === 'string' ? { email: data.email } : {}) }
  } catch (e) {
    console.error('[auth-service] verifyJwtViaService failed:', (e as Error)?.message)
    return { ok: false, error: 'Auth service error' }
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

/**
 * Protected Backend authentication.
 *
 * The third parameter is retained as a compatibility argument so existing
 * route handlers can migrate without a large coordinated edit. It is ignored.
 * HMAC application-secret authentication has intentionally been removed:
 * anything embedded in an APK can be extracted and therefore cannot be a
 * server-side secret.
 */
export type DualAuthResult =
  | { mode: 'jwt'; user_id: string; email: string }
  | { mode: 'none'; error: string }

export async function dualAuth(
  req: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _legacyHmacVerify?: (req: Request, env: any) => Promise<{ ok: boolean; error?: string }>,
): Promise<DualAuthResult> {
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) {
    return { mode: 'none', error: 'Authorization header required' }
  }

  const result = await verifyJwtViaService(env, token)
  if (result.ok && result.user_id && result.email) {
    return { mode: 'jwt', user_id: result.user_id, email: result.email }
  }

  return { mode: 'none', error: result.error ?? 'Invalid or expired token' }
}
