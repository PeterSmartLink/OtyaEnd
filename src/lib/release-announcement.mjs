import { sendTelegramMessage } from './telegram-bot.mjs'

const CHANNEL = '@otyaplayer'

export function releaseAnnouncementText(release) {
  const notes = typeof release.changelog === 'string' ? release.changelog.trim().slice(0, 2000) : ''
  return [
    `Otya ${release.version} is available`,
    notes,
    'See release details and download from our official website:',
    `${release.workerUrl}/download/otya-player`,
    'Need help? Contact @OtyaPlayerBot. Thank you for using Otya.',
  ].filter(Boolean).join('\n\n')
}

// Reserve the release before sending. Telegram has no sendMessage idempotency
// key: an uncertain attempt requires review instead of automatic resending.
export async function announceRelease(env, release, send = sendTelegramMessage) {
  if (!env.TELEGRAM_BOT_TOKEN) return { status: 'not-configured' }
  if (!env.DB) return { status: 'storage-unavailable' }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS release_announcements (
      tag TEXT PRIMARY KEY, status TEXT NOT NULL, message_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run()
    const reservation = await env.DB.prepare(
      "INSERT OR IGNORE INTO release_announcements (tag, status) VALUES (?, 'pending-review')",
    ).bind(release.tag).run()
    if (reservation.meta?.changes !== 1) {
      const existing = await env.DB.prepare('SELECT status FROM release_announcements WHERE tag = ?').bind(release.tag).first()
      return { status: existing?.status || 'pending-review', duplicate: true }
    }
    const result = await send(CHANNEL, releaseAnnouncementText(release), env)
    if (result?.message_id == null) return { status: 'pending-review' }
    await env.DB.prepare("UPDATE release_announcements SET status = 'sent', message_id = ? WHERE tag = ?")
      .bind(String(result.message_id), release.tag).run()
    return { status: 'sent', messageId: result.message_id }
  } catch {
    // Do not log provider URLs, tokens or release payloads.
    return { status: 'pending-review' }
  }
}
