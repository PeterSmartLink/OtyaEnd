import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

type Context = { params: Promise<{ path: string[] }> }
type ServiceBinding = { fetch(request: Request): Promise<Response> }

type OwnerEnv = Record<string, unknown> & {
  AUTH?: ServiceBinding
  AI_SUPPORT?: ServiceBinding
  INTERNAL_SECRET?: string
  ADMIN_EMAIL?: string
}

const VERIFY_TIMEOUT_MS = 5000

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

async function forward(request: NextRequest, context: Context) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as OwnerEnv
  const owner = await verifyOwnerGrant(request, recordEnv)
  if (!owner.ok) {
    return NextResponse.json(
      { error: 'Owner verification is required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  if (!recordEnv.AI_SUPPORT?.fetch || !recordEnv.INTERNAL_SECRET) {
    return NextResponse.json(
      { error: 'Next owner service is not configured.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const { path } = await context.params
  const incoming = new URL(request.url)
  const target = new URL(`/api/admin/ai/console/${path.join('/')}`, incoming.origin)
  target.search = incoming.search

  const headers = new Headers(request.headers)
  headers.delete('authorization')
  headers.delete('cookie')
  headers.delete('x-otya-owner-grant')
  headers.set('X-OTYA-Internal-Secret', recordEnv.INTERNAL_SECRET)
  headers.set('X-OTYA-Admin-ID', 'primary')
  headers.set('X-OTYA-Admin-Email', owner.email ?? String(recordEnv.ADMIN_EMAIL ?? 'admin'))
  headers.set('X-OTYA-Channel', 'next-android')

  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await request.arrayBuffer()

  const response = await recordEnv.AI_SUPPORT.fetch(new Request(target, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  }))

  const outHeaders = new Headers(response.headers)
  outHeaders.set('Cache-Control', 'no-store')
  outHeaders.set('X-Content-Type-Options', 'nosniff')
  return new NextResponse(response.body, { status: response.status, headers: outHeaders })
}

export async function GET(request: NextRequest, context: Context) { return forward(request, context) }
export async function POST(request: NextRequest, context: Context) { return forward(request, context) }
