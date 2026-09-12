// app/api/crash-report/route.ts
// POST /api/crash-report
// Accepts crash reports from the Flutter app and stores them in D1.
//
// Crash capture runs before login, so anonymous telemetry is supported.
// App Check attests the app installation independently of user authentication.
//
// IMPORTANT: crash ingestion must never fan out one Queue message per crash.
// Repeating client/framework failures are grouped and deduplicated here so an
// old or broken test build cannot exhaust the account-wide Queues allowance.

import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { verifyRequest } from '@/lib/auth'
import { dualAuth } from '@/lib/auth-service'
import { appCheckEnforced, verifyFirebaseAppCheck } from '@/lib/firebase_app_check'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://petersmartlink.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck, X-Otya-Timestamp, X-Otya-Signature, X-Otya-Device-Id',
}

const DUPLICATE_WINDOW_MINUTES = 10

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  return cleaned ? cleaned.slice(0, max) : null
}

function telemetryText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  let cleaned = value.trim().slice(0, Math.max(max * 2, max))
  if (!cleaned) return null

  cleaned = cleaned
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer <redacted>')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<redacted-jwt>')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '<redacted-email>')
    .replace(/(?:file:\/\/)?\/(?:storage\/emulated\/\d+|sdcard)\/[^\r\n]*/gi, '<redacted-device-path>')
    .replace(/(?:file:\/\/)?\/(?:data\/user\/\d+|data\/data)\/com\.otyaplayer\.app\/[^\r\n]*/gi, '<redacted-app-path>')
    .replace(/(["']?(?:access_token|refresh_token|id_token|password|api_key)["']?\s*[:=]\s*)["']?[^\s,"'}&]+/gi, '$1<redacted>')
    .replace(/([?&](?:token|key|code|secret|password)=)[^&#\s]+/gi, '$1<redacted>')

  cleaned = cleaned.trim()
  return cleaned ? cleaned.slice(0, max) : null
}

function integer(value: unknown): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null
}

function canonicalCrashText(errorType: string | null, description: string | null, stackTrace: string | null): string {
  return [errorType, description, stackTrace]
    .filter(Boolean)
    .map(value => String(value).toLowerCase())
    .join('\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '<uuid>')
    .replace(/0x[0-9a-f]+/gi, '0x<address>')
    .replace(/:\d+:\d+/g, ':<line>:<column>')
    .replace(/\b\d{5,}\b/g, '<number>')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

async function crashGroupId(errorType: string | null, description: string | null, stackTrace: string | null): Promise<string> {
  const canonical = canonicalCrashText(errorType, description, stackTrace) || 'unknown-crash'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `crash-${hex.slice(0, 32)}`
}

async function rateAllowed(recordEnv: Record<string, unknown>, req: NextRequest, deviceId: string | null): Promise<boolean> {
  const limiter = recordEnv.RATE_LIMITER as { limit(input: { key: string }): Promise<{ success: boolean }> } | undefined
  if (!limiter?.limit) return true
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown'
  try {
    const result = await limiter.limit({ key: `crash:${deviceId || ip}` })
    return result.success === true
  } catch (error) {
    console.warn('[crash-report] Rate limiter unavailable:', (error as Error)?.message)
    return true
  }
}

export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  const appCheck = await verifyFirebaseAppCheck(req, recordEnv)
  if (appCheckEnforced(recordEnv) && !appCheck.valid) {
    return errorJson('App attestation required', 401)
  }

  const auth = await dualAuth(req, env, verifyRequest)

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return errorJson('Invalid JSON body', 400)
  }

  const deviceId    = text(body.device_id, 128)
  const appVersion  = text(body.app_version, 64)
  const versionCode = integer(body.version_code)
  const errorType   = text(body.error_type, 160)
  const stackTrace  = telemetryText(body.stack_trace, 4000)
  const description = telemetryText(body.description, 2000)

  if (!description && !errorType) {
    return errorJson('description or error_type is required', 400)
  }

  if (!await rateAllowed(recordEnv, req, deviceId)) {
    // A telemetry endpoint should fail closed without encouraging client retry
    // storms. 202 means the report was intentionally sampled/suppressed.
    return secureJson({ ok: true, accepted: false, reason: 'rate_limited', ts: Date.now() }, { status: 202 })
  }

  const userId = auth.mode === 'jwt' ? auth.user_id : null
  const db = getDB(recordEnv)
  const groupId = await crashGroupId(errorType, description, stackTrace)

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS crash_reports (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id    TEXT,
        user_id      TEXT,
        app_version  TEXT,
        version_code INTEGER,
        error_type   TEXT,
        stack_trace  TEXT,
        description  TEXT,
        group_id     TEXT,
        ai_processed INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now'))
      )
    `).run()
  } catch (e) {
    console.error('[crash-report] CREATE TABLE failed:', (e as Error)?.message)
  }

  // Suppress the same crash from the same installation for a short period.
  // This is deliberately server-side because older APKs may not contain the
  // newer in-app telemetry deduplication logic yet.
  try {
    const duplicate = await db.prepare(`
      SELECT id
      FROM crash_reports
      WHERE group_id = ?
        AND COALESCE(device_id, '') = COALESCE(?, '')
        AND created_at >= datetime('now', ?)
      ORDER BY id DESC
      LIMIT 1
    `).bind(groupId, deviceId, `-${DUPLICATE_WINDOW_MINUTES} minutes`).first()

    if (duplicate?.id) {
      return secureJson({
        ok: true,
        accepted: false,
        reason: 'duplicate',
        group_id: groupId,
        authenticated: auth.mode !== 'none',
        app_check: appCheck.valid ? 'valid' : appCheck.configured ? 'unverified' : 'not-configured',
        ts: Date.now(),
      }, { status: 202 })
    }
  } catch (e) {
    console.warn('[crash-report] Duplicate check failed:', (e as Error)?.message)
  }

  try {
    await db.prepare(`
      INSERT INTO crash_reports
        (device_id, user_id, app_version, version_code, error_type, stack_trace, description, group_id, ai_processed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      deviceId,
      userId,
      appVersion,
      versionCode,
      errorType,
      stackTrace,
      description,
      groupId,
    ).run()
  } catch (e) {
    console.error('[crash-report] INSERT failed:', (e as Error)?.message)
    return errorJson('Failed to save crash report', 500)
  }

  return secureJson({
    ok: true,
    accepted: true,
    group_id: groupId,
    authenticated: auth.mode !== 'none',
    app_check: appCheck.valid ? 'valid' : appCheck.configured ? 'unverified' : 'not-configured',
    ts: Date.now(),
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
