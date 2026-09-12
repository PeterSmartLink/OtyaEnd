import { sendTelegramReleaseCard } from './telegram-bot.mjs'

const CHANNEL = '@otyaplayer'

export function releaseAnnouncementText(release) {
  const notes = typeof release.changelog === 'string' ? release.changelog
    .split(/\r?\n/).map(line => line.replace(/^\s*(?:[-*#]+|\d+[.)])\s*/, '').trim())
    .filter(line => line && !/https?:\/\/|@[\w]+|^co-authored-by:|^contributors?:/i.test(line))
    .slice(0, 3).map(line => `• ${Array.from(line).slice(0, 130).join('')}`).join('\n') : ''
  return [
    `Otya ${String(release.version).slice(0, 30)} · New update`,
    notes,
    'See the full release notes and get the Android download below.',
    'PeterSmart Link · Made with care in Uganda',
  ].filter(Boolean).join('\n\n')
}

// Reserve the release before sending. Telegram has no sendMessage idempotency
// key: an uncertain attempt requires review instead of automatic resending.
export async function announceRelease(env, release, send = sendTelegramReleaseCard) {
  if (!env.TELEGRAM_BOT_TOKEN) return { status: 'not-configured' }
  if (!env.DB) return { status: 'storage-unavailable' }
  try {
    // release_announcements is migration-owned (0009). Release publication must
    // never execute DDL while attempting an external Telegram write.
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
    // Do not log provider URLs, tokens or release payloads. Missing migration or
    // uncertain provider acceptance both remain reviewable instead of replayed.
    return { status: 'pending-review' }
  }
}
