function clean(value, max = 4000) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
}

function safeJson(value, max = 12000) {
  if (value === undefined || value === null) return null
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return null
    return serialized.length <= max ? serialized : JSON.stringify({
      truncated: true,
      preview: serialized.slice(0, Math.max(0, Math.floor((max - 64) / 6))),
    })
  }
  catch { return JSON.stringify({ error: 'unserializable' }) }
}

export async function recordRuntimeOperationalEvent(env, input) {
  if (!env?.DB?.prepare) return
  try {
    await env.DB.prepare(`
      INSERT INTO operational_events (
        component, event_type, status, severity, correlation_id, details_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      clean(input?.component ?? 'core', 80),
      clean(input?.eventType ?? 'runtime_event', 100),
      clean(input?.status ?? 'unknown', 80),
      clean(input?.severity ?? 'info', 20),
      input?.correlationId ? clean(input.correlationId, 120) : null,
      safeJson(input?.details),
    ).run()
  } catch (error) {
    console.warn('[operations] runtime event write failed:', error?.message ?? error)
  }
}
