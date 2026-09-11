import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  adminConfigured,
  adminSessionCookie,
  clearAdminSessionCookie,
  cookieValue,
  createAdminSession,
  getOtyaAccountAdminEmail,
  verifyAdminSession,
} from '@/lib/admin_auth'
import { getDB } from '@/lib/d1'
import { recordSecurityEvent } from '@/lib/operations'

const ACCESS_COOKIE = '__Secure-otya_access'
const AUTH_STEP_TIMEOUT_MS = 8000

type AuthBinding = { fetch(request: Request): Promise<Response> }

async function authStep(
  request: NextRequest,
  recordEnv: Record<string, unknown>,
  path: string,
  body?: unknown,
): Promise<Response> {
  const auth = recordEnv.AUTH as AuthBinding | undefined
  const accessToken = cookieValue(request, ACCESS_COOKIE)
  if (!auth?.fetch || !accessToken) {
    return NextResponse.json({ error: 'Sign in to your OTYA account first.' }, { status: 401 })
  }

  return auth.fetch(new Request(`https://auth${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? '{}' : JSON.stringify(body),
    signal: AbortSignal.timeout(AUTH_STEP_TIMEOUT_MS),
  }))
}

async function auditAdminSession(
  request: Request,
  recordEnv: Record<string, unknown>,
  eventType: 'admin_session_elevated' | 'admin_session_ended',
): Promise<void> {
  try {
    await recordSecurityEvent(getDB(recordEnv), {
      eventType,
      severity: 'info',
      actorType: 'admin',
      source: 'admin-session',
      correlationId: request.headers.get('CF-Ray'),
    })
  } catch (error) {
    console.warn('[admin/session] security audit write failed:', (error as Error)?.message)
  }
}

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  const configured = adminConfigured(recordEnv)

  // A valid elevated cookie is self-contained and already proves that this is
  // an allowlisted Otya admin. Do not block every Admin page load on another
  // private AUTH service lookup once elevation has succeeded.
  const authenticated = configured ? await verifyAdminSession(request, recordEnv) : false
  const accountAdmin = authenticated || Boolean(await getOtyaAccountAdminEmail(request, recordEnv))

  return NextResponse.json(
    { ok: true, configured, authenticated, accountAdmin },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  if (!adminConfigured(recordEnv)) {
    return NextResponse.json({ error: 'Owner verification is not configured.' }, { status: 503 })
  }

  const accountEmail = await getOtyaAccountAdminEmail(request, recordEnv)
  if (!accountEmail) {
    return NextResponse.json({ error: 'Sign in with the OTYA owner account first.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { action?: string; otp?: string }
  const action = body.action ?? ''

  try {
    if (action === 'start') {
      const upstream = await authStep(request, recordEnv, '/auth/admin/start')
      const data = await upstream.json().catch(() => ({}))
      return NextResponse.json(data, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } })
    }

    if (action === 'verify-otp') {
      const upstream = await authStep(request, recordEnv, '/auth/admin/verify-otp', { otp: body.otp })
      const data = await upstream.json().catch(() => ({}))
      return NextResponse.json(data, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } })
    }

    if (action === 'complete') {
      const upstream = await authStep(request, recordEnv, '/auth/admin/consume')
      const data = await upstream.json().catch(() => ({})) as { ok?: boolean; email?: string; error?: string }
      if (!upstream.ok || data.ok !== true || data.email?.toLowerCase() !== accountEmail) {
        return NextResponse.json({ error: data.error ?? 'Complete Telegram verification first.' }, { status: 401 })
      }

      const session = await createAdminSession(recordEnv, accountEmail)
      await auditAdminSession(request, recordEnv, 'admin_session_elevated')
      return NextResponse.json({ ok: true }, {
        headers: {
          'Set-Cookie': adminSessionCookie(session),
          'Cache-Control': 'no-store',
        },
      })
    }
  } catch (error) {
    console.error('[admin/session] verification service unavailable:', (error as Error)?.message)
    return NextResponse.json(
      { error: 'Admin verification service is temporarily unavailable. Try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json({ error: 'Unsupported owner verification step.' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  await auditAdminSession(request, env as Record<string, unknown>, 'admin_session_ended')
  return NextResponse.json({ ok: true }, {
    headers: {
      'Set-Cookie': clearAdminSessionCookie(),
      'Cache-Control': 'no-store',
    },
  })
}
