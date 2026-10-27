import { sendResendEmail } from './resend'

interface NotificationKv {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export interface OmniPointNotificationEnv {
  AUTH_KV: NotificationKv
  RESEND_API_KEY?: string
  ADMIN_EMAILS?: string
}

export interface LowStockNotice {
  productName: string
  sku: string
  quantityOnHand: number
  reorderLevel: number
}

const COOLDOWN_SECONDS = 24 * 60 * 60
const validEmail = (value: string) => value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
})

function validateNotice(value: unknown): LowStockNotice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (typeof input.productName !== 'string' || input.productName.trim().length < 2 || input.productName.trim().length > 120) return null
  if (typeof input.sku !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(input.sku.trim())) return null
  if (!Number.isSafeInteger(input.quantityOnHand) || (input.quantityOnHand as number) < 0 || (input.quantityOnHand as number) > 999999999) return null
  if (!Number.isSafeInteger(input.reorderLevel) || (input.reorderLevel as number) < 1 || (input.reorderLevel as number) > 999999999) return null
  if ((input.quantityOnHand as number) > (input.reorderLevel as number)) return null
  return {
    productName: input.productName.trim(),
    sku: input.sku.trim().toUpperCase(),
    quantityOnHand: input.quantityOnHand as number,
    reorderLevel: input.reorderLevel as number,
  }
}

/**
 * This route is intended for Cloudflare Service Binding calls from trusted Otya
 * Workers only. otya-auth is not exposed as a public custom-domain/Workers.dev
 * endpoint. Recipients come only from the operator-managed ADMIN_EMAILS variable.
 */
export async function handleOmniPointNotification(
  request: Request,
  env: OmniPointNotificationEnv,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname !== '/internal/notifications/omnipoint/low-stock') return null
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (request.headers.get('x-otya-service') !== 'omnipoint') return json({ error: 'service_not_allowed' }, 403)

  const length = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(length) && length > 4096) return json({ error: 'payload_too_large' }, 413)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const notice = validateNotice(body)
  if (!notice) return json({ error: 'invalid_low_stock_notice' }, 400)

  const recipients = (env.ADMIN_EMAILS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(validEmail)
  if (recipients.length === 0) return json({ error: 'notification_recipients_not_configured' }, 503)
  if (!env.RESEND_API_KEY) return json({ error: 'email_provider_not_configured' }, 503)

  const cooldownKey = `notify:omnipoint:low-stock:${notice.sku}`
  try {
    if (await env.AUTH_KV.get(cooldownKey)) return json({ ok: true, status: 'suppressed_cooldown' })
    const text = [
      'OmniPoint inventory alert',
      '',
      `Product: ${notice.productName}`,
      `SKU: ${notice.sku}`,
      `Quantity remaining: ${notice.quantityOnHand}`,
      `Reorder threshold: ${notice.reorderLevel}`,
      '',
      'Please review stock and arrange replenishment if needed.',
    ].join('\n')
    await sendResendEmail(env.RESEND_API_KEY, {
      from: 'OmniPoint <noreply@petersmartlink.com>',
      to: recipients,
      replyTo: 'support@petersmartlink.com',
      subject: `OmniPoint low-stock alert: ${notice.productName}`,
      text,
    })
    await env.AUTH_KV.put(cooldownKey, new Date().toISOString(), { expirationTtl: COOLDOWN_SECONDS })
    return json({ ok: true, status: 'accepted' }, 202)
  } catch {
    // Do not expose provider responses, recipients, or secrets to callers.
    return json({ error: 'notification_delivery_failed' }, 502)
  }
}
