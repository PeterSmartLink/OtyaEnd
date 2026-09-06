import productionRouter from './production-router.mjs'
import { handleTogetherControl } from './together-control.mjs'

export { OtyaReleaseWorkflow } from './production-router.mjs'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function authenticateTogetherUser(request, env) {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ') || !env.AUTH?.fetch) return null

  try {
    const response = await env.AUTH.fetch(new Request('https://otya-auth/auth/verify', {
      method: 'GET',
      headers: { Authorization: authorization },
    }))
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok !== true || !data?.user_id) return null
    return {
      id: String(data.user_id),
      email: typeof data.email === 'string' ? data.email.toLowerCase() : null,
    }
  } catch {
    return null
  }
}

/// Branch-only routing wrapper for OTYA New Way.
///
/// Together is intercepted before the mature production browser/router stack.
/// Every non-Together request is delegated unchanged, which keeps the existing
/// website, auth, admin, release, Telegram and media APIs outside this change.
export default {
  ...productionRouter,
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/together/')) {
      return productionRouter.fetch(request, env, ctx)
    }

    if (!env.KV || !env.AUTH?.fetch) {
      return json({ error: 'Together control plane unavailable' }, 503)
    }

    const user = await authenticateTogetherUser(request, env)
    return handleTogetherControl(request, env, user)
  },
}
