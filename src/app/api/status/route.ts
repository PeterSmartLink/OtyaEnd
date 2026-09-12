import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

const SERVICE_TIMEOUT_MS = 4000

type ServiceBinding = {
  fetch(input: Request): Promise<Response>
}

type PublicState = 'operational' | 'degraded'

async function probeService(
  binding: ServiceBinding | undefined,
  url: string,
  healthyStatuses: ReadonlySet<number>,
  requireOkBody = false,
): Promise<boolean> {
  if (!binding?.fetch) return false
  try {
    const response = await binding.fetch(new Request(url, {
      method: 'GET',
      signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
    }))
    if (!healthyStatuses.has(response.status)) {
      try { await response.body?.cancel() } catch {}
      return false
    }
    if (!requireOkBody) {
      try { await response.body?.cancel() } catch {}
      return true
    }
    const body = await response.json().catch(() => null) as { ok?: unknown } | null
    return body?.ok === true
  } catch {
    return false
  }
}

export async function GET() {
  const { env } = await getCloudflareContext()
  const runtimeEnv = env as unknown as Record<string, unknown>
  const auth = runtimeEnv.AUTH as ServiceBinding | undefined
  const next = runtimeEnv.AI_SUPPORT as ServiceBinding | undefined

  const [accountsOk, nextOk] = await Promise.all([
    // An unauthenticated /auth/me returning 401 proves the Auth Worker is
    // reachable and enforcing its boundary without exposing account data.
    probeService(auth, 'https://otya-auth/auth/me', new Set([401])),
    probeService(next, 'https://otya-next/health', new Set([200]), true),
  ])

  const components: Record<string, PublicState> = {
    website: 'operational',
    accounts: accountsOk ? 'operational' : 'degraded',
    next: nextOk ? 'operational' : 'degraded',
  }
  const overall: PublicState = Object.values(components).every(
    state => state === 'operational',
  ) ? 'operational' : 'degraded'

  return new Response(JSON.stringify({
    status: overall,
    components,
    checkedAt: new Date().toISOString(),
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
