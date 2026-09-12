import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { appCheckEnforced, verifyFirebaseAppCheck } from '@/lib/firebase_app_check'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://petersmartlink.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck, X-Otya-Device-Id',
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text.slice(0, max) : null
}

function cleanInt(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null
}

// POST /api/feedback — public app telemetry endpoint.
// App Check attests the app installation while still allowing pre-login reports.
export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  const appCheck = await verifyFirebaseAppCheck(req, recordEnv)
  if (appCheckEnforced(recordEnv) && !appCheck.valid) {
    return errorJson('App attestation required', 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return errorJson('Invalid JSON body', 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorJson('JSON body must be an object', 400)
  }

  const deviceId    = cleanText(body.device_id, 128)
  const appVersion  = cleanText(body.app_version, 64)
  const versionCode = cleanInt(body.version_code)
  const category    = cleanText(body.category, 80) ?? 'other'
  const description = cleanText(body.description, 2000)
  const userEmail   = cleanText(body.user_email, 254)

  if (!description) return errorJson('description is required', 400)
  if (userEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
    return errorJson('user_email is invalid', 400)
  }

  const db = getDB(recordEnv)
  const result = await db.prepare(`
    INSERT INTO feedback (device_id, app_version, version_code, category, description, user_email)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(deviceId, appVersion, versionCode, category, description, userEmail).run()

  const feedbackId = (result.meta as Record<string, unknown>)?.last_row_id as number | undefined
  const aiQueue = recordEnv.AI_QUEUE as { send(body: unknown): Promise<void> } | undefined

  if (feedbackId && aiQueue) {
    try {
      await aiQueue.send({ type: 'moderate_feedback', feedbackId, description })
    } catch (e) {
      console.error('[feedback] Failed to queue AI moderation:', (e as Error)?.message)
    }
    try {
      await aiQueue.send({ type: 'categorize_feedback', feedbackId, description })
    } catch (e) {
      console.error('[feedback] Failed to queue AI categorization:', (e as Error)?.message)
    }
  }

  return secureJson({
    ok: true,
    app_check: appCheck.valid ? 'valid' : appCheck.configured ? 'unverified' : 'not-configured',
    ts: Date.now(),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
