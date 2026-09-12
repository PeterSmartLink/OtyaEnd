/**
 * System health monitoring helpers.
 * Used by the scheduled cron handler in queue-worker.mjs and admin API routes.
 */

import { D1, KVNamespaceLocal } from '@/lib/d1'

const PROVIDER_TIMEOUT_MS = 8000

export interface EndpointHealth {
  url: string
  status: number
  latency: number
  ok: boolean
}

export interface SystemStats {
  totalDownloads: number
  last24h: number
  last7d: number
  topAbi: string
  topVersion: string
  activeDevices: number
}

export async function checkEndpointHealth(endpoints: string[]): Promise<EndpointHealth[]> {
  return Promise.all(
    endpoints.map(async (url) => {
      const start = Date.now()
      try {
        const res = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
          headers: {
            'User-Agent': 'OTYA-HealthCheck/2.0',
            Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
          },
        })
        return { url, status: res.status, latency: Date.now() - start, ok: res.ok }
      } catch (e) {
        console.error('[monitor] health check failed for', url, (e as Error)?.message)
        return { url, status: 0, latency: Date.now() - start, ok: false }
      }
    }),
  )
}

export async function detectRateLimitAbuse(
  db: D1,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _env: any,
): Promise<string[]> {
  try {
    const { results } = await db.prepare(`
      SELECT ip, COUNT(*) as count
      FROM downloads
      WHERE created_at >= datetime('now', '-1 hour')
        AND ip IS NOT NULL
        AND ip != 'unknown'
      GROUP BY ip
      HAVING count > 100
      ORDER BY count DESC
      LIMIT 50
    `).all<{ ip: string; count: number }>()
    return results.map(r => r.ip)
  } catch (e) {
    console.error('[monitor] detectRateLimitAbuse failed:', (e as Error)?.message)
    return []
  }
}

export async function blockIp(kv: KVNamespaceLocal, ip: string): Promise<void> {
  try {
    await kv.put(`blocked:${ip}`, '1', { expirationTtl: 86400 })
  } catch (e) {
    console.error('[monitor] blockIp failed for', ip, (e as Error)?.message)
  }
}

export async function isIpBlocked(kv: KVNamespaceLocal, ip: string): Promise<boolean> {
  try {
    const val = await kv.get(`blocked:${ip}`)
    return val !== null
  } catch (e) {
    console.error('[monitor] isIpBlocked check failed for', ip, (e as Error)?.message)
    return false
  }
}

export async function getSystemStats(db: D1): Promise<SystemStats> {
  const zero: SystemStats = {
    totalDownloads: 0,
    last24h: 0,
    last7d: 0,
    topAbi: 'unknown',
    topVersion: 'unknown',
    activeDevices: 0,
  }

  try {
    const [totalRow, last24hRow, last7dRow, topAbiRow, topVersionRow, activeRow] =
      await Promise.all([
        db.prepare('SELECT COUNT(*) as count FROM downloads').first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM downloads WHERE created_at >= datetime('now', '-1 day')").first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM downloads WHERE created_at >= datetime('now', '-7 days')").first<{ count: number }>(),
        db.prepare('SELECT abi, COUNT(*) as count FROM downloads GROUP BY abi ORDER BY count DESC LIMIT 1').first<{ abi: string; count: number }>(),
        db.prepare('SELECT version, COUNT(*) as count FROM downloads GROUP BY version ORDER BY count DESC LIMIT 1').first<{ version: string; count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM devices WHERE last_seen_at >= datetime('now', '-30 days')").first<{ count: number }>(),
      ])

    return {
      totalDownloads: totalRow?.count ?? 0,
      last24h: last24hRow?.count ?? 0,
      last7d: last7dRow?.count ?? 0,
      topAbi: topAbiRow?.abi ?? 'unknown',
      topVersion: topVersionRow?.version ?? 'unknown',
      activeDevices: activeRow?.count ?? 0,
    }
  } catch (e) {
    console.error('[monitor] getSystemStats failed:', (e as Error)?.message)
    return zero
  }
}

export async function sendWeeklyDigest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  stats: SystemStats,
  feedbackSummary: string,
): Promise<void> {
  const subject = `[OTYA Backend] Weekly Digest — ${new Date().toDateString()}`
  const text = [
    '=== OTYA Backend Weekly Digest ===',
    '',
    'Download Stats',
    `  Total downloads : ${stats.totalDownloads}`,
    `  Last 24 hours   : ${stats.last24h}`,
    `  Last 7 days     : ${stats.last7d}`,
    `  Top ABI         : ${stats.topAbi}`,
    `  Top version     : ${stats.topVersion}`,
    `  Active devices  : ${stats.activeDevices}`,
    '',
    'Feedback Summary',
    feedbackSummary,
    '',
    `Generated: ${new Date().toISOString()}`,
  ].join('\n')

  await sendAlertEmail(env, subject, text)
}

export async function sendAlertEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  subject: string,
  body: string,
): Promise<void> {
  const binding = env.RESEND_API_KEY
  const apiKey = typeof binding === 'string' ? binding : await binding?.get?.()
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured')

  const to = env.ALERT_EMAIL_TO || 'petersmartlink@gmail.com'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.ALERT_EMAIL_FROM || 'OTYA Backend <notifications@petersmartlink.com>',
      to: [to],
      subject,
      text: body,
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Resend alert failed with HTTP ${response.status}`)
  }
  const result = await response.json().catch(() => null) as { id?: unknown } | null
  if (typeof result?.id !== 'string' || !result.id.trim()) {
    throw new Error('Resend did not confirm alert acceptance')
  }
}
