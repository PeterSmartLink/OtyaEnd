import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'

const MAX_BODY_BYTES = 256 * 1024
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60
const RESEND_API_TIMEOUT_MS = 5000
const WEBHOOK_SECRET_CACHE_MS = 5 * 60 * 1000
const OPERATIONAL_EVENTS = new Set([
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.complained',
  'email.bounced',
  'email.failed',
  'email.suppressed',
])

type WebhookEnv = Record<string, unknown> & {
  RESEND_API_KEY?: string
  RESEND_WEBHOOK_ID?: string
  RESEND_WEBHOOK_SECRET?: string
}

type ResendWebhookEvent = {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    message_id?: string
    [key: string]: unknown
  }
}

let secretPromise: Promise<string> | null = null
let secretExpiresAt = 0
let schemaPromise: Promise<void> | null = null

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function concreteBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index++) diff |= left[index] ^ right[index]
  return diff === 0
}

async function resolveWebhookSecret(env: WebhookEnv): Promise<string> {
  const configured = typeof env.RESEND_WEBHOOK_SECRET === 'string'
    ? env.RESEND_WEBHOOK_SECRET.trim()
    : ''
  if (configured) return configured

  if (secretPromise && Date.now() < secretExpiresAt) return secretPromise
  secretExpiresAt = Date.now() + WEBHOOK_SECRET_CACHE_MS
  secretPromise = (async () => {
    const apiKey = typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : ''
    const webhookId = typeof env.RESEND_WEBHOOK_ID === 'string' ? env.RESEND_WEBHOOK_ID.trim() : ''
    if (!apiKey || !webhookId) throw new Error('Resend webhook verification is not configured')

    const response = await fetch(`https://api.resend.com/webhooks/${encodeURIComponent(webhookId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(RESEND_API_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Resend webhook metadata lookup failed with HTTP ${response.status}`)

    const data = await response.json() as { signing_secret?: unknown }
    const secret = typeof data.signing_secret === 'string' ? data.signing_secret.trim() : ''
    if (!secret.startsWith('whsec_')) throw new Error('Resend did not return a valid webhook signing secret')
    return secret
  })().catch((error) => {
    secretPromise = null
    secretExpiresAt = 0
    throw error
  })
  return secretPromise
}

async function verifySignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  const timestamp = Number(svixTimestamp)
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false
  }
  if (!secret.startsWith('whsec_')) return false

  let keyBytes: Uint8Array
  try {
    keyBytes = decodeBase64(secret.slice('whsec_'.length))
  } catch {
    return false
  }

  const key = await crypto.subtle.importKey(
    'raw',
    concreteBuffer(keyBytes),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedContent),
  ))

  for (const candidate of svixSignature.trim().split(/\s+/)) {
    const [version, encoded] = candidate.split(',', 2)
    if (version !== 'v1' || !encoded) continue
    try {
      if (equalBytes(expected, decodeBase64(encoded))) return true
    } catch {}
  }
  return false
}

async function claimEvent(env: WebhookEnv, svixId: string, event: ResendWebhookEvent): Promise<boolean> {
  // Schema is provisioned only by the versioned migration; webhook requests never mutate DDL.
  const db = getDB(env)
  const eventType = typeof event.type === 'string' ? event.type.slice(0, 80) : 'unknown'
  const emailId = typeof event.data?.email_id === 'string' ? event.data.email_id.slice(0, 128) : null
  const messageId = typeof event.data?.message_id === 'string' ? event.data.message_id.slice(0, 512) : null
  const eventCreatedAt = typeof event.created_at === 'string' ? event.created_at.slice(0, 64) : null
  const result = await db.prepare(`
    INSERT OR IGNORE INTO resend_webhook_events
      (svix_id, event_type, email_id, message_id, event_created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(svixId.slice(0, 256), eventType, emailId, messageId, eventCreatedAt).run()
  return Number((result.meta as Record<string, unknown>)?.changes ?? 0) > 0
}

function recordAnalytics(env: WebhookEnv, event: ResendWebhookEvent, duplicate: boolean): void {
  const analytics = env.OTYA_ANALYTICS as {
    writeDataPoint?(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void
  } | undefined
  if (!analytics?.writeDataPoint) return
  const eventType = typeof event.type === 'string' ? event.type.slice(0, 80) : 'unknown'
  const emailId = typeof event.data?.email_id === 'string' ? event.data.email_id.slice(0, 128) : 'none'
  try {
    analytics.writeDataPoint({
      blobs: ['resend_webhook', eventType, duplicate ? 'duplicate' : 'accepted'],
      doubles: [Date.now()],
      indexes: [emailId],
    })
  } catch (error) {
    console.error('[resend/webhook] analytics write failed:', (error as Error)?.message)
  }
}

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return errorJson('Webhook payload too large', 413)
  }

  const svixId = req.headers.get('svix-id')?.trim() ?? ''
  const svixTimestamp = req.headers.get('svix-timestamp')?.trim() ?? ''
  const svixSignature = req.headers.get('svix-signature')?.trim() ?? ''
  if (!svixId || !svixTimestamp || !svixSignature) {
    return errorJson('Webhook signature required', 401)
  }

  const rawBody = await req.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return errorJson('Webhook payload too large', 413)
  }

  const { env } = await getCloudflareContext({ async: true })
  const webhookEnv = env as WebhookEnv

  let secret: string
  try {
    secret = await resolveWebhookSecret(webhookEnv)
  } catch (error) {
    console.error('[resend/webhook] signing secret unavailable:', (error as Error)?.message)
    return errorJson('Webhook verification temporarily unavailable', 503)
  }

  if (!(await verifySignature(rawBody, svixId, svixTimestamp, svixSignature, secret))) {
    return errorJson('Invalid webhook signature', 401)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody) as unknown
  } catch {
    return errorJson('Invalid webhook JSON', 400)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return errorJson('Invalid webhook event shape', 400)
  }

  const event = parsed as ResendWebhookEvent
  if (typeof event.type !== 'string' || !event.type.trim()) {
    return errorJson('Invalid webhook event type', 400)
  }
  if (event.data !== undefined && (!event.data || typeof event.data !== 'object' || Array.isArray(event.data))) {
    return errorJson('Invalid webhook event data', 400)
  }

  const eventType = event.type
  if (!OPERATIONAL_EVENTS.has(eventType)) {
    return secureJson({ ok: true, ignored: true })
  }

  let claimed: boolean
  try {
    claimed = await claimEvent(webhookEnv, svixId, event)
  } catch (error) {
    console.error('[resend/webhook] idempotency claim failed:', (error as Error)?.message)
    return errorJson('Webhook persistence temporarily unavailable', 503)
  }

  recordAnalytics(webhookEnv, event, !claimed)
  return secureJson({ ok: true, duplicate: !claimed })
}

export async function GET() {
  return errorJson('Method not allowed', 405)
}
