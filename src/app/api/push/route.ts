import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'
import { getFcmAccessToken, sendFcmWithToken } from '@/lib/fcm'
import { verifyAdminSession } from '@/lib/admin_auth'

const CHUNK_SIZE = 100
const OTYA_DOWNLOAD_URL = 'https://petersmartlink.com/download/otya-player'

function officialNotificationUrl(value: string): string | null {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password ||
        (url.port && url.port !== '443') ||
        (host !== 'petersmartlink.com' && !host.endsWith('.petersmartlink.com'))) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://petersmartlink.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  if (!await verifyAdminSession(req, recordEnv)) return errorJson('Unauthorized', 401)

  const serviceAccountJson = recordEnv.FCM_SERVICE_ACCOUNT_JSON as string | undefined
  if (!serviceAccountJson) return errorJson('FCM_SERVICE_ACCOUNT_JSON not configured', 503)

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return errorJson('Invalid JSON body', 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorJson('JSON body must be an object', 400)
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : ''
  const msgBody = typeof body.body === 'string' ? body.body.trim().slice(0, 500) : ''
  const url = typeof body.url === 'string' ? body.url.trim().slice(0, 1000) : ''
  const deviceIdRaw = body.deviceId ?? body.device_id
  const deviceId = typeof deviceIdRaw === 'string' ? deviceIdRaw.trim().slice(0, 128) : ''
  if (!title || !msgBody) return errorJson('title and body required', 400)

  const db = getDB(recordEnv)
  let tokens: string[] = []
  if (deviceId) {
    const row = await db.prepare(
      'SELECT fcm_token FROM devices WHERE device_id = ? AND fcm_token IS NOT NULL'
    ).bind(deviceId).first<{ fcm_token: string }>()
    if (row?.fcm_token) tokens = [row.fcm_token]
  } else {
    let offset = 0
    const pageSize = 1000
    while (true) {
      const { results } = await db.prepare(
        'SELECT fcm_token FROM devices WHERE fcm_token IS NOT NULL LIMIT ? OFFSET ?'
      ).bind(pageSize, offset).all<{ fcm_token: string }>()
      tokens.push(...results.map(r => r.fcm_token))
      if (results.length < pageSize) break
      offset += pageSize
    }
  }

  tokens = [...new Set(tokens.filter(Boolean))]
  if (tokens.length === 0) {
    return secureJson({ ok: true, sent: 0, failed: 0, total: 0, message: 'No registered devices', ts: Date.now() })
  }

  let projectId = ''
  try {
    projectId = (JSON.parse(serviceAccountJson) as { project_id?: string }).project_id?.trim() ?? ''
  } catch {
    return errorJson('FCM service account is invalid', 503)
  }
  if (!projectId) return errorJson('FCM project_id is missing', 503)

  const link = url ? officialNotificationUrl(url) : OTYA_DOWNLOAD_URL
  if (!link) return errorJson('url must use an official PeterSmart Link HTTPS host', 400)
  let accessToken: string
  try {
    accessToken = await getFcmAccessToken(serviceAccountJson)
  } catch (e) {
    console.error('[push] Failed to obtain FCM access token:', e)
    return errorJson('FCM authentication failed', 503)
  }

  let totalSent = 0
  let totalFailed = 0
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE)
    try {
      const { sent, failed } = await sendFcmWithToken(chunk, title, msgBody, link, accessToken, projectId)
      totalSent += sent
      totalFailed += failed
    } catch (e) {
      console.error(`[push] chunk ${i}–${i + CHUNK_SIZE} failed:`, e)
      totalFailed += chunk.length
    }
  }

  return secureJson({ ok: true, sent: totalSent, failed: totalFailed, total: tokens.length, ts: Date.now() })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
