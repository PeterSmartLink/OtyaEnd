import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

type Context = { params: Promise<{ operation: string }> }
type ServiceBinding = { fetch(request: Request): Promise<Response> }

type OwnerEnv = Record<string, unknown> & {
  AUTH?: ServiceBinding
  AI_SUPPORT?: ServiceBinding
  INTERNAL_SECRET?: string
  ADMIN_EMAIL?: string
}

const VERIFY_TIMEOUT_MS = 5000
const ACTION_TIMEOUT_MS = 15000
const ACTION_ID = /^[0-9a-f-]{20,80}$/i
const APPROVAL_TOKEN = /^[0-9a-f-]{20,120}$/i

function json(data: unknown, status: number) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function verifyOwnerGrant(request: NextRequest, env: OwnerEnv): Promise<{ ok: boolean; email?: string }> {
  const authorization = request.headers.get('Authorization')?.trim() ?? ''
  const grant = request.headers.get('X-OTYA-Owner-Grant')?.trim() ?? ''
  if (!authorization.startsWith('Bearer ') || !grant || !env.AUTH?.fetch) return { ok: false }

  try {
    const upstream = await env.AUTH.fetch(new Request('https://auth/auth/admin/verify-grant', {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'X-OTYA-Owner-Grant': grant,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    }))
    const data = await upstream.json().catch(() => ({})) as { ok?: boolean; email?: string }
    return upstream.ok && data.ok === true
      ? { ok: true, email: String(data.email ?? '').trim().toLowerCase() || undefined }
      : { ok: false }
  } catch {
    return { ok: false }
  }
}

export async function POST(request: NextRequest, context: Context) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as OwnerEnv
  const owner = await verifyOwnerGrant(request, recordEnv)
  if (!owner.ok) return json({ error: 'Owner verification is required.' }, 401)
  if (!recordEnv.AI_SUPPORT?.fetch || !recordEnv.INTERNAL_SECRET) {
    return json({ error: 'Next owner service is not configured.' }, 503)
  }

  const { operation } = await context.params
  if (operation !== 'approve' && operation !== 'cancel') {
    return json({ error: 'Unsupported owner action operation.' }, 404)
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const approvalToken = typeof body.approval_token === 'string' ? body.approval_token.trim() : ''
  if (!ACTION_ID.test(id)) return json({ error: 'A valid action ID is required.' }, 400)
  if (operation === 'approve' && !APPROVAL_TOKEN.test(approvalToken)) {
    return json({ error: 'A valid approval token is required.' }, 400)
  }

  const upstreamBody = operation === 'approve'
    ? { id, approval_token: approvalToken }
    : { id }

  try {
    const upstream = await recordEnv.AI_SUPPORT.fetch(new Request(
      `https://otya-next/api/admin/ai/actions/${operation}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-OTYA-Internal-Secret': recordEnv.INTERNAL_SECRET,
          'X-OTYA-Admin-ID': 'primary',
          'X-OTYA-Admin-Email': owner.email ?? String(recordEnv.ADMIN_EMAIL ?? 'admin'),
          'X-OTYA-Channel': 'next-android',
        },
        body: JSON.stringify(upstreamBody),
        signal: AbortSignal.timeout(ACTION_TIMEOUT_MS),
      },
    ))

    const payload = await upstream.text()
    const headers = new Headers({
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    return new NextResponse(payload, { status: upstream.status, headers })
  } catch {
    return json({ error: 'Owner action service is temporarily unavailable.' }, 503)
  }
}
