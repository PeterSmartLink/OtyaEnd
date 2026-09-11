import { verifyJwt } from './crypto'
import {
  createBackupFile,
  deleteBackupFile,
  downloadBackupFile,
  findBackupFile,
  updateBackupFile,
} from './drive'
import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedBackupEnvelope,
} from './backup_crypto'

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface BackupRouteEnv {
  AUTH_KV: KVNamespace
  AUTH_JWT_SECRET: string
  CORS_ORIGIN?: string
}

interface BackupPostBody {
  drive_token?: unknown
  data?: unknown
}

interface BackupDeleteBody {
  drive_token?: unknown
}

const PRIMARY_ORIGIN = 'https://petersmartlink.com'
const DRIVE_FILE_ID_TTL = 365 * 24 * 60 * 60

function headers(env: BackupRouteEnv): Record<string, string> {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': env.CORS_ORIGIN ?? PRIMARY_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Otya-Drive-Token',
    'Vary': 'Origin',
  }
}

function json(data: unknown, env: BackupRouteEnv, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: headers(env) })
}

async function authenticatedUserId(request: Request, env: BackupRouteEnv): Promise<string | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = await verifyJwt(auth.slice(7), env.AUTH_JWT_SECRET)
  return payload?.sub ?? null
}

function validDriveToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20 && value.length <= 8192
}

function validateRecoverySnapshot(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Backup data must be an object'
  const value = data as Record<string, unknown>
  if (value.schema_version !== 1 || value.payload_type !== 'otya_recovery_snapshot') {
    return 'Unsupported OTYA backup schema'
  }
  const forbidden = [
    'password', 'password_hash', 'otp', 'jwt', 'access_token', 'refresh_token',
    'api_key', 'secret', 'fcm_service_credentials', 'media_files', 'safe_media',
  ]
  for (const key of forbidden) {
    if (key in value) return `Forbidden backup field: ${key}`
  }
  return null
}

async function resolveBackupFileId(
  env: BackupRouteEnv,
  userId: string,
  driveToken: string,
): Promise<string | null> {
  const cacheKey = `drive_file:${userId}`
  const cached = await env.AUTH_KV.get(cacheKey)
  if (cached) return cached
  const found = await findBackupFile(driveToken)
  if (found) {
    await env.AUTH_KV.put(cacheKey, found, { expirationTtl: DRIVE_FILE_ID_TTL })
  }
  return found
}

export async function handleBackupRoute(
  request: Request,
  env: BackupRouteEnv,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/auth/backup') return null

  const userId = await authenticatedUserId(request, env)
  if (!userId) return json({ error: 'Unauthorized' }, env, 401)

  if (request.method === 'POST') {
    let body: BackupPostBody
    try {
      body = await request.json() as BackupPostBody
    } catch {
      return json({ error: 'Invalid JSON body' }, env, 400)
    }
    if (!validDriveToken(body.drive_token)) {
      return json({ error: 'Google Drive permission is required' }, env, 400)
    }
    const validationError = validateRecoverySnapshot(body.data)
    if (validationError) return json({ error: validationError }, env, 400)

    try {
      const encrypted = await encryptBackupPayload(body.data, userId, env.AUTH_JWT_SECRET)
      const existingId = await resolveBackupFileId(env, userId, body.drive_token)
      let fileId = existingId
      if (existingId) {
        await updateBackupFile(body.drive_token, existingId, encrypted)
      } else {
        fileId = await createBackupFile(body.drive_token, encrypted)
        await env.AUTH_KV.put(`drive_file:${userId}`, fileId, { expirationTtl: DRIVE_FILE_ID_TTL })
      }
      await env.AUTH_KV.put(`drive_backup_at:${userId}`, new Date().toISOString(), {
        expirationTtl: DRIVE_FILE_ID_TTL,
      })
      return json({ ok: true, encrypted: true, encryption_version: 1 }, env)
    } catch (error) {
      console.error('[auth] encrypted Drive backup failed:', error instanceof Error ? error.message : 'unknown')
      return json({ error: 'Google Drive backup could not be completed' }, env, 502)
    }
  }

  if (request.method === 'GET') {
    // Prefer the header so new clients never put Drive credentials in URLs.
    // Retain the query fallback until older installed clients have upgraded.
    const driveToken = request.headers.get('X-Otya-Drive-Token') ?? url.searchParams.get('drive_token')
    if (!validDriveToken(driveToken)) {
      return json({ error: 'Google Drive permission is required' }, env, 400)
    }

    try {
      const fileId = await resolveBackupFileId(env, userId, driveToken)
      if (!fileId) return json({ ok: true, data: null, last_backup_at: null }, env)
      const stored = await downloadBackupFile(driveToken, fileId)
      let data: unknown
      if (isEncryptedBackupEnvelope(stored)) {
        data = await decryptBackupPayload(stored, userId, env.AUTH_JWT_SECRET)
      } else {
        // Legacy migration path. Any pre-encryption recovery snapshot is read
        // once for compatibility; the next backup rewrites it encrypted.
        const validationError = validateRecoverySnapshot(stored)
        if (validationError) throw new Error(validationError)
        data = stored
      }
      const validationError = validateRecoverySnapshot(data)
      if (validationError) throw new Error(validationError)
      const lastBackupAt = await env.AUTH_KV.get(`drive_backup_at:${userId}`)
      return json({ ok: true, data, last_backup_at: lastBackupAt }, env)
    } catch (error) {
      console.error('[auth] encrypted Drive restore failed:', error instanceof Error ? error.message : 'unknown')
      return json({ error: 'Google Drive backup is unavailable or corrupted' }, env, 422)
    }
  }

  if (request.method === 'DELETE') {
    let body: BackupDeleteBody
    try {
      body = await request.json() as BackupDeleteBody
    } catch {
      return json({ error: 'Invalid JSON body' }, env, 400)
    }
    if (!validDriveToken(body.drive_token)) {
      return json({ error: 'Google Drive permission is required' }, env, 400)
    }

    try {
      const fileId = await resolveBackupFileId(env, userId, body.drive_token)
      if (fileId) await deleteBackupFile(body.drive_token, fileId)
      await env.AUTH_KV.delete(`drive_file:${userId}`)
      await env.AUTH_KV.delete(`drive_backup_at:${userId}`)
      return json({ ok: true }, env)
    } catch (error) {
      console.error('[auth] Drive backup delete failed:', error instanceof Error ? error.message : 'unknown')
      return json({ error: 'Google Drive backup could not be deleted' }, env, 502)
    }
  }

  return json({ error: 'Method not allowed' }, env, 405)
}
