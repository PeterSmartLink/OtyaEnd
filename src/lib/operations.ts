import type { D1 } from '@/lib/d1'

function clean(value: unknown, max = 4000): string {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
}

function safeJson(value: unknown, max = 12000): string | null {
  if (value === undefined || value === null) return null
  try {
    return JSON.stringify(value).slice(0, max)
  } catch {
    return JSON.stringify({ error: 'unserializable' })
  }
}

export type NotificationEventInput = {
  id?: string
  userId?: string | null
  deviceId?: string | null
  eventType: string
  severity?: 'info' | 'warning' | 'critical'
  title: string
  body: string
  data?: unknown
  source?: string
  deliveryChannel?: string | null
  deliveryStatus?: string
  expiresAt?: string | null
}

export async function recordNotificationEvent(db: D1, input: NotificationEventInput): Promise<string> {
  const id = input.id || crypto.randomUUID()
  await db.prepare(`
    INSERT INTO notification_events (
      id, user_id, device_id, event_type, severity, title, body, data_json,
      source, delivery_channel, delivery_status, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    input.userId ?? null,
    input.deviceId ?? null,
    clean(input.eventType, 80),
    input.severity ?? 'info',
    clean(input.title, 300),
    clean(input.body, 2000),
    safeJson(input.data),
    clean(input.source ?? 'core', 80),
    input.deliveryChannel ? clean(input.deliveryChannel, 40) : null,
    clean(input.deliveryStatus ?? 'created', 40),
    input.expiresAt ?? null,
  ).run()
  return id
}

export type SecurityEventInput = {
  id?: string
  userId?: string | null
  eventType: string
  severity?: 'info' | 'warning' | 'critical'
  actorType?: 'system' | 'user' | 'admin' | 'service'
  source: string
  correlationId?: string | null
  ipHash?: string | null
  metadata?: unknown
}

export async function recordSecurityEvent(db: D1, input: SecurityEventInput): Promise<string> {
  const id = input.id || crypto.randomUUID()
  await db.prepare(`
    INSERT INTO security_events (
      id, user_id, event_type, severity, actor_type, source, correlation_id, ip_hash, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    input.userId ?? null,
    clean(input.eventType, 100),
    input.severity ?? 'info',
    input.actorType ?? 'system',
    clean(input.source, 80),
    input.correlationId ? clean(input.correlationId, 120) : null,
    input.ipHash ? clean(input.ipHash, 120) : null,
    safeJson(input.metadata),
  ).run()
  return id
}

export async function recordOperationalEvent(
  db: D1,
  input: {
    component: string
    eventType: string
    status: string
    severity?: 'info' | 'warning' | 'critical'
    correlationId?: string | null
    details?: unknown
  },
): Promise<void> {
  await db.prepare(`
    INSERT INTO operational_events (
      component, event_type, status, severity, correlation_id, details_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    clean(input.component, 80),
    clean(input.eventType, 100),
    clean(input.status, 80),
    input.severity ?? 'info',
    input.correlationId ? clean(input.correlationId, 120) : null,
    safeJson(input.details),
  ).run()
}
