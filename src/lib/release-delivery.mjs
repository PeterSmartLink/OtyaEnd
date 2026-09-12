// Queue acceptance is not device delivery. Keep both concepts separate.
export async function queueReleaseOnce(env, tag, message) {
  if (!env.PUSH_QUEUE?.send || !env.DB) {
    return { queued: false, duplicate: false, status: 'not-configured' }
  }
  const marker = `release:push:${tag}`
  // Honor releases sent by older deployments while moving coordination to D1.
  if (await env.KV?.get(marker)) {
    return { queued: false, duplicate: true, status: 'queued-legacy' }
  }
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS release_push_dispatch (
    tag TEXT PRIMARY KEY, status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run()
  const reservation = await env.DB.prepare(
    "INSERT OR IGNORE INTO release_push_dispatch (tag, status) VALUES (?, 'pending-review')",
  ).bind(tag).run()
  if (reservation.meta?.changes !== 1) {
    const existing = await env.DB.prepare('SELECT status FROM release_push_dispatch WHERE tag = ?').bind(tag).first()
    return { queued: false, duplicate: true, status: existing?.status || 'pending-review' }
  }
  try {
    await env.PUSH_QUEUE.send(message)
  } catch {
    // The service may have accepted the message before the connection failed.
    // Never automatically send another copy after an ambiguous outcome.
    return { queued: false, duplicate: false, status: 'pending-review' }
  }
  try {
    await env.DB.prepare("UPDATE release_push_dispatch SET status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE tag = ?")
      .bind(tag).run()
  } catch {
    return { queued: true, duplicate: false, status: 'queued-record-pending-review' }
  }
  return { queued: true, duplicate: false, status: 'queued' }
}

export async function sendReleaseReport(env, subject, text, request = fetch) {
  const binding = env.RESEND_API_KEY
  if (!binding || !env.ADMIN_REPORT_EMAIL) return { sent: false, reason: 'not-configured' }
  const token = typeof binding === 'string' ? binding : await binding.get()
  if (!token) return { sent: false, reason: 'not-configured' }
  const body = JSON.stringify({
    from: 'Otya Releases <noreply@petersmartlink.com>',
    to: [env.ADMIN_REPORT_EMAIL], subject, text,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `otya-release-report/${key}`,
    },
    body,
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Release report rejected (HTTP ${response.status})`)
  const data = await response.json()
  if (typeof data.id !== 'string' || !data.id.trim()) throw new Error('Release report acceptance was not confirmed')
  return { sent: true, id: data.id }
}
