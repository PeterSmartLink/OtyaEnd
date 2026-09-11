import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { extractBearerToken, verifyJwtViaService } from '@/lib/auth-service'
import { getDB } from '@/lib/d1'
import { errorJson, secureJson } from '@/lib/response'

const MAX_LIMIT = 100

async function currentUser(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) return { error: errorJson('Authorization header required', 401) }
  const auth = await verifyJwtViaService(env as Record<string, unknown>, token)
  if (!auth.ok || !auth.user_id) return { error: errorJson(auth.error ?? 'Unauthorized', 401) }
  return { env: env as Record<string, unknown>, userId: auth.user_id }
}

export async function GET(req: NextRequest) {
  const identity = await currentUser(req)
  if ('error' in identity) return identity.error

  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? 40)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 40))
  const unreadOnly = req.nextUrl.searchParams.get('unread') === '1'
  const db = getDB(identity.env)

  const unreadClause = unreadOnly ? 'AND read_at IS NULL' : ''
  const { results } = await db.prepare(`
    SELECT id, user_id, event_type, severity, title, body, data_json, source,
           delivery_channel, delivery_status, read_at, created_at, expires_at
    FROM notification_events
    WHERE (user_id = ? OR user_id IS NULL)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ${unreadClause}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(identity.userId, limit).all()

  const unread = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM notification_events
    WHERE (user_id = ? OR user_id IS NULL)
      AND read_at IS NULL
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `).bind(identity.userId).first<{ count: number }>()

  return secureJson({
    notifications: results.map((row) => ({
      ...row,
      data: typeof row.data_json === 'string' ? safeParse(row.data_json) : null,
      data_json: undefined,
    })),
    unread_count: Number(unread?.count ?? 0),
    ts: Date.now(),
  })
}

export async function POST(req: NextRequest) {
  const identity = await currentUser(req)
  if ('error' in identity) return identity.error

  const body = await req.json().catch(() => null) as { id?: unknown; all?: unknown; unread?: unknown } | null
  if (!body) return errorJson('Invalid JSON body', 400)
  const db = getDB(identity.env)

  if (body.all === true) {
    if (body.unread === true) {
      await db.prepare(`
        UPDATE notification_events
        SET read_at = NULL
        WHERE user_id = ?
      `).bind(identity.userId).run()
      return secureJson({ ok: true, all: true, unread: true, ts: Date.now() })
    }
    await db.prepare(`
      UPDATE notification_events
      SET read_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND read_at IS NULL
    `).bind(identity.userId).run()
    return secureJson({ ok: true, all: true, ts: Date.now() })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return errorJson('id or all=true is required', 400)

  const readAt = body.unread === true ? null : new Date().toISOString()
  await db.prepare(`
    UPDATE notification_events
    SET read_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(readAt, id, identity.userId).run()

  return secureJson({ ok: true, id, unread: body.unread === true, ts: Date.now() })
}

function safeParse(value: string): unknown {
  try { return JSON.parse(value) } catch { return null }
}
