/**
 * Smart notification helpers.
 * Queues FCM pushes via PUSH_QUEUE and sends operational email through the
 * backend's Resend transport. All functions are fire-and-forget safe — errors
 * are logged, never thrown.
 */

import { D1 } from '@/lib/d1'
import { sendAlertEmail } from '@/lib/monitor'

export interface ReleaseInfo {
  version:   string
  changelog: string
  tag:       string
}

/**
 * Queue an FCM push notification to all devices announcing a new release.
 * Keep the system notification compact: full Markdown release notes belong in
 * release metadata / What's New / the official download page.
 */
export async function sendUpdateNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  release: ReleaseInfo,
): Promise<void> {
  try {
    const title = `Otya ${release.version} is ready`
    const body  = 'New features and improvements are ready. Tap to see what’s new.'
    const downloadUrl = 'https://petersmartlink.com/download/otya-player'

    await env.PUSH_QUEUE.send({
      title,
      body,
      url: downloadUrl,
      type: 'update',
      version: release.version,
      download_url: downloadUrl,
      release_notes: body,
    })
    console.log(`[notifications] Queued update notification for ${release.version}`)
  } catch (e) {
    console.error('[notifications] sendUpdateNotification failed:', (e as Error)?.message)
  }
}

/** Find devices inactive for more than 30 days and send a targeted reminder. */
export async function sendReengagementNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  db: D1,
): Promise<void> {
  try {
    const { results } = await db.prepare(`
      SELECT device_id, last_seen_at
      FROM devices
      WHERE last_seen_at < datetime('now', '-30 days')
        AND fcm_token IS NOT NULL
      LIMIT 500
    `).all<{ device_id: string; last_seen_at: string }>()

    if (results.length === 0) {
      console.log('[notifications] No inactive devices found for re-engagement.')
      return
    }

    for (const device of results) {
      try {
        const daysSince = Math.floor(
          (Date.now() - new Date(device.last_seen_at).getTime()) / 86_400_000,
        )
        await env.PUSH_QUEUE.send({
          title:    '👋 We miss you!',
          body:     `It's been ${daysSince} days. Come back and enjoy OTYA Player!`,
          url:      'https://petersmartlink.com/download/otya-player',
          deviceId: device.device_id,
          type:     'reengagement',
        })
      } catch (e) {
        console.error('[notifications] re-engagement push failed for', device.device_id, (e as Error)?.message)
      }
    }

    console.log(`[notifications] Queued re-engagement for ${results.length} inactive devices.`)
  } catch (e) {
    console.error('[notifications] sendReengagementNotifications failed:', (e as Error)?.message)
  }
}

/** Find Pro subscriptions expiring within three days and warn their devices. */
export async function sendProExpiryWarnings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  db: D1,
): Promise<void> {
  try {
    const threeDaysMs = Date.now() + 3 * 86_400_000
    const { results } = await db.prepare(`
      SELECT p.user_id, p.expiry_ms, d.device_id
      FROM pro_status p
      JOIN devices d ON d.user_id = p.user_id
      WHERE p.expiry_ms > ?
        AND p.expiry_ms <= ?
        AND d.fcm_token IS NOT NULL
      LIMIT 200
    `).bind(Date.now(), threeDaysMs).all<{ user_id: string; expiry_ms: number; device_id: string }>()

    if (results.length === 0) {
      console.log('[notifications] No pro subscriptions expiring soon.')
      return
    }

    for (const row of results) {
      try {
        const daysLeft = Math.ceil((row.expiry_ms - Date.now()) / 86_400_000)
        await env.PUSH_QUEUE.send({
          title:    '⚠️ Pro subscription expiring soon',
          body:     `Your OTYA Player Pro access expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep premium features.`,
          url:      'https://petersmartlink.com',
          deviceId: row.device_id,
          type:     'pro_expiry',
        })
      } catch (e) {
        console.error('[notifications] pro expiry push failed for', row.user_id, (e as Error)?.message)
      }
    }

    console.log(`[notifications] Queued pro expiry warnings for ${results.length} users.`)
  } catch (e) {
    console.error('[notifications] sendProExpiryWarnings failed:', (e as Error)?.message)
  }
}

/** Queue a welcome-back push for one device. */
export async function sendWelcomeBack(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  deviceId: string,
  daysSinceLastSeen: number,
): Promise<void> {
  try {
    await env.PUSH_QUEUE.send({
      title:    '👋 Welcome back!',
      body:     `Great to see you again after ${daysSinceLastSeen} days. Check out what's new in OTYA Player!`,
      url:      'https://petersmartlink.com/download/otya-player',
      deviceId,
      type:     'welcome_back',
    })
    console.log(`[notifications] Queued welcome-back for device ${deviceId}`)
  } catch (e) {
    console.error('[notifications] sendWelcomeBack failed for', deviceId, (e as Error)?.message)
  }
}

/** Send an operational email about a new release using the Resend-backed helper. */
export async function notifyNewRelease(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  env: any,
  release: ReleaseInfo,
): Promise<void> {
  const subject = `[OTYA Backend] New Release: OTYA Player ${release.version}`
  const body = [
    `OTYA Player ${release.version} has been released.`,
    '',
    'Changelog:',
    release.changelog || 'No changelog provided.',
    '',
    'Download: https://petersmartlink.com/download/otya-player',
    `Tag: ${release.tag}`,
    '',
    `Released: ${new Date().toISOString()}`,
  ].join('\n')

  await sendAlertEmail(env, subject, body)
}
