import { verifyJwt } from './crypto'
import {
  refreshTokenDigest,
  refreshTokenSessionId,
  revokeRefreshTokenByDigest,
  type RefreshTokenKv,
} from './refresh-token-store'

interface KVNamespaceLike extends RefreshTokenKv {}

export interface SessionEnv {
  AUTH_KV: KVNamespaceLike
  AUTH_JWT_SECRET: string
}

type SessionRecord = {
  id: string
  userId: string
  tokenDigest: string
  createdAt: string
  lastUsedAt: string
  tokenRenewedAt: string
  ip?: string
  userAgent?: string
}

type StoredSessionRecord = Partial<SessionRecord> & {
  id?: string
  userId?: string
  refreshToken?: string
  createdAt?: string
  lastUsedAt?: string
  tokenRenewedAt?: string
  ip?: string
  userAgent?: string
}

const SESSION_TTL = 30 * 24 * 60 * 60
const SESSION_RENEW_AFTER = 7 * 24 * 60 * 60 * 1000
const DIGEST_RE = /^[a-f0-9]{64}$/

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

async function requireUser(request: Request, env: SessionEnv): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = await verifyJwt(auth.slice(7), env.AUTH_JWT_SECRET)
  return payload?.sub ?? null
}

function clientIp(request: Request): string | undefined {
  const value = request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
  return value || undefined
}

function tokenIndexKeyById(id: string): string {
  return `auth_session_token:${id}`
}

async function tokenIndexKey(refreshToken: string): Promise<string> {
  return tokenIndexKeyById(await refreshTokenSessionId(refreshToken))
}

async function readSession(kv: KVNamespaceLike, userId: string, id: string): Promise<SessionRecord | null> {
  const key = `auth_session:${userId}:${id}`
  const raw = await kv.get(key)
  if (!raw) return null

  let parsed: StoredSessionRecord
  try {
    parsed = JSON.parse(raw) as StoredSessionRecord
  } catch {
    return null
  }
  if (parsed.id !== id || parsed.userId !== userId || !parsed.createdAt || !parsed.lastUsedAt) return null

  const tokenRenewedAt = parsed.tokenRenewedAt || parsed.createdAt
  if (typeof parsed.tokenDigest === 'string' && DIGEST_RE.test(parsed.tokenDigest)) {
    return {
      id,
      userId,
      tokenDigest: parsed.tokenDigest,
      createdAt: parsed.createdAt,
      lastUsedAt: parsed.lastUsedAt,
      tokenRenewedAt,
      ip: parsed.ip,
      userAgent: parsed.userAgent,
    }
  }

  // One-release compatibility for session records created before refresh-token
  // containment. Convert the raw bearer to a one-way digest immediately and
  // overwrite the session record so future KV reads no longer expose it.
  if (typeof parsed.refreshToken === 'string' && parsed.refreshToken) {
    const tokenDigest = await refreshTokenDigest(parsed.refreshToken)
    const upgraded: SessionRecord = {
      id,
      userId,
      tokenDigest,
      createdAt: parsed.createdAt,
      lastUsedAt: parsed.lastUsedAt,
      tokenRenewedAt,
      ip: parsed.ip,
      userAgent: parsed.userAgent,
    }
    await kv.put(key, JSON.stringify(upgraded), { expirationTtl: SESSION_TTL })
    return upgraded
  }

  return null
}

async function deleteSessionRecord(kv: KVNamespaceLike, session: SessionRecord): Promise<void> {
  await revokeRefreshTokenByDigest(kv, session.userId, session.tokenDigest)
  await Promise.all([
    kv.delete(`auth_session:${session.userId}:${session.id}`),
    kv.delete(tokenIndexKeyById(session.id)),
  ])
}

export async function recordSessionFromAuthResponse(
  request: Request,
  response: Response,
  env: SessionEnv,
): Promise<void> {
  if (!response.ok) return
  try {
    const data = await response.clone().json() as {
      refresh_token?: string
      user?: { id?: string }
    }
    const refreshToken = data.refresh_token
    const userId = data.user?.id
    if (!refreshToken || !userId) return

    const tokenDigest = await refreshTokenDigest(refreshToken)
    const id = tokenDigest.slice(0, 32)
    const now = new Date().toISOString()
    const record: SessionRecord = {
      id,
      userId,
      tokenDigest,
      createdAt: now,
      lastUsedAt: now,
      tokenRenewedAt: now,
      ip: clientIp(request),
      userAgent: request.headers.get('User-Agent')?.slice(0, 240) || undefined,
    }
    await Promise.all([
      env.AUTH_KV.put(`auth_session:${userId}:${id}`, JSON.stringify(record), { expirationTtl: SESSION_TTL }),
      env.AUTH_KV.put(tokenIndexKeyById(id), JSON.stringify({ userId, id }), { expirationTtl: SESSION_TTL }),
    ])
  } catch (error) {
    console.error('[auth/session] Could not record session:', (error as Error)?.message)
  }
}

export async function touchSessionFromRefresh(
  request: Request,
  refreshToken: string,
  env: SessionEnv,
): Promise<void> {
  try {
    const indexRaw = await env.AUTH_KV.get(await tokenIndexKey(refreshToken))
    if (!indexRaw) return
    const index = JSON.parse(indexRaw) as { userId?: string; id?: string }
    if (!index.userId || !index.id) return
    const session = await readSession(env.AUTH_KV, index.userId, index.id)
    if (!session) return

    const now = new Date()
    const renewedAt = new Date(session.tokenRenewedAt).getTime()
    const shouldRenewToken = !Number.isFinite(renewedAt)
      || now.getTime() - renewedAt >= SESSION_RENEW_AFTER

    session.lastUsedAt = now.toISOString()
    session.ip = clientIp(request) ?? session.ip
    session.userAgent = request.headers.get('User-Agent')?.slice(0, 240) || session.userAgent

    if (shouldRenewToken) {
      // Sliding sign-in: an actively used session remains valid until logout,
      // password/security revocation or explicit session removal. The safe KV
      // wrapper hashes these keys, so the bearer token is not persisted raw.
      await Promise.all([
        env.AUTH_KV.put(`rt:${refreshToken}`, session.userId, { expirationTtl: SESSION_TTL }),
        env.AUTH_KV.put(`rt_user:${session.userId}:${refreshToken}`, '1', { expirationTtl: SESSION_TTL }),
        env.AUTH_KV.put(tokenIndexKeyById(session.id), JSON.stringify({ userId: session.userId, id: session.id }), { expirationTtl: SESSION_TTL }),
      ])
      session.tokenRenewedAt = now.toISOString()
    }

    await env.AUTH_KV.put(
      `auth_session:${session.userId}:${session.id}`,
      JSON.stringify(session),
      { expirationTtl: SESSION_TTL },
    )
  } catch (error) {
    console.error('[auth/session] Could not touch session:', (error as Error)?.message)
  }
}

export async function removeSessionFromLogout(refreshToken: string, env: SessionEnv): Promise<void> {
  try {
    const indexRaw = await env.AUTH_KV.get(await tokenIndexKey(refreshToken))
    if (!indexRaw) return
    const index = JSON.parse(indexRaw) as { userId?: string; id?: string }
    if (!index.userId || !index.id) return
    const session = await readSession(env.AUTH_KV, index.userId, index.id)
    if (session) await deleteSessionRecord(env.AUTH_KV, session)
  } catch (error) {
    console.error('[auth/session] Could not remove session:', (error as Error)?.message)
  }
}

async function listUserSessions(kv: KVNamespaceLike, userId: string): Promise<SessionRecord[]> {
  const rows: SessionRecord[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix: `auth_session:${userId}:`, limit: 1000, cursor })
    for (const key of page.keys) {
      const id = key.name.slice(`auth_session:${userId}:`.length)
      if (!id) continue
      const row = await readSession(kv, userId, id)
      if (row) rows.push(row)
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  rows.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
  return rows
}

export async function handleSessionRoute(request: Request, env: SessionEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/auth/sessions')) return null
  const userId = await requireUser(request, env)
  if (!userId) return json({ error: 'Sign in to OTYA first' }, 401)

  if (request.method === 'GET' && url.pathname === '/auth/sessions') {
    const sessions = await listUserSessions(env.AUTH_KV, userId)
    return json({
      ok: true,
      sessions: sessions.map((session) => ({
        id: session.id,
        created_at: session.createdAt,
        last_used_at: session.lastUsedAt,
        ip: session.ip ?? null,
        user_agent: session.userAgent ?? null,
      })),
    })
  }

  if (request.method === 'DELETE' && url.pathname === '/auth/sessions') {
    let body: { session_id?: string }
    try {
      body = await request.json() as { session_id?: string }
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    if (!body.session_id) return json({ error: 'session_id is required' }, 400)
    const session = await readSession(env.AUTH_KV, userId, body.session_id)
    if (!session) return json({ error: 'Session not found' }, 404)
    await deleteSessionRecord(env.AUTH_KV, session)
    return json({ ok: true })
  }

  if (request.method === 'POST' && url.pathname === '/auth/sessions/revoke-all') {
    const sessions = await listUserSessions(env.AUTH_KV, userId)
    for (const session of sessions) await deleteSessionRecord(env.AUTH_KV, session)
    return json({ ok: true, revoked: sessions.length })
  }

  return json({ error: 'Method not allowed' }, 405)
}
