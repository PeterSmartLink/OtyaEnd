// app/api/device/route.ts
// POST /api/device
// Upserts device info into D1 `devices` table.
// Called on first launch / version change and FCM registration sync by Flutter.
//
// Authentication model:
//   - Verified JWT: links the installation to the token's user_id.
//   - Firebase App Check: attests that the request came from an OTYA app build.
//     It starts in monitor mode and can later be enforced without an app update.
//   - Anonymous/legacy unsigned install: allowed for non-sensitive installation
//     metadata only while App Check remains in monitor mode. user_id is forced
//     to null so logout/account switching cannot retain stale account ownership.

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { verifyRequest } from '@/lib/auth'
import { dualAuth } from '@/lib/auth-service'
import { appCheckEnforced, verifyFirebaseAppCheck } from '@/lib/firebase_app_check'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'

export interface DevicePayload {
  device_id:        string
  app_version:      string
  version_code?:    number
  app_build?:       number
  abi?:             string
  arch?:            string
  fcm_token?:       string
  user_id?:         string
  platform?:        string
  model?:           string
  android_version?: string
  locale?:          string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://petersmartlink.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck, X-Otya-Timestamp, X-Otya-Signature, X-Otya-Device-Id',
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  return text.slice(0, maxLength)
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>

  const appCheck = await verifyFirebaseAppCheck(request, recordEnv)
  if (appCheckEnforced(recordEnv) && !appCheck.valid) {
    return errorJson('App attestation required', 401)
  }

  // Attempt JWT verification, but do not reject a clean anonymous install.
  const auth = await dualAuth(request, env, verifyRequest)
  if (request.headers.has('Authorization') && auth.mode !== 'jwt') {
    return errorJson('Invalid or expired authorization', 401)
  }

  let body: DevicePayload
  try {
    body = await request.json() as DevicePayload
  } catch {
    return errorJson('Invalid JSON body', 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorJson('JSON body must be an object', 400)
  }

  const deviceId = cleanText(body.device_id, 128)
  if (!deviceId) return errorJson('device_id is required', 400)

  const rawVersionCode = body.version_code ?? body.app_build ?? 0
  const versionCode = Number.isFinite(Number(rawVersionCode))
    ? Math.max(0, Math.trunc(Number(rawVersionCode)))
    : 0

  const abi = cleanText(body.abi ?? body.arch, 32) ?? 'arm64'
  const platform = cleanText(body.platform, 32) ?? 'android'

  // Only a verified JWT may establish account ownership. App Check proves the
  // app installation, not the user's identity. A later anonymous registration
  // intentionally clears an older user_id so signing out or switching accounts
  // cannot keep routing private account pushes to the previous user on this phone.
  const resolvedUserId = auth.mode === 'jwt' ? auth.user_id : null

  const db = getDB(recordEnv)

  await db.prepare(`
    INSERT INTO devices
      (device_id, user_id, fcm_token, app_version, version_code, abi, platform,
       model, android_version, locale, registered_at, last_seen_at)
    VALUES
      (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'), datetime('now'))
    ON CONFLICT(device_id) DO UPDATE SET
      app_version     = excluded.app_version,
      version_code    = excluded.version_code,
      abi             = excluded.abi,
      platform        = excluded.platform,
      model           = COALESCE(excluded.model,           devices.model),
      android_version = COALESCE(excluded.android_version, devices.android_version),
      locale          = COALESCE(excluded.locale,          devices.locale),
      fcm_token       = COALESCE(excluded.fcm_token,       devices.fcm_token),
      user_id         = excluded.user_id,
      last_seen_at    = datetime('now')
  `).bind(
    deviceId,
    resolvedUserId,
    cleanText(body.fcm_token, 4096),
    cleanText(body.app_version, 64) ?? '0.0.0',
    versionCode,
    abi,
    platform,
    cleanText(body.model, 256),
    cleanText(body.android_version, 64),
    cleanText(body.locale, 32),
  ).run()

  return secureJson({
    ok: true,
    authenticated: auth.mode === 'jwt',
    app_check: appCheck.valid ? 'valid' : appCheck.configured ? 'unverified' : 'not-configured',
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
