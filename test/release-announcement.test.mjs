import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { announceRelease, releaseAnnouncementText } from '../src/lib/release-announcement.mjs'
import { sendTelegramMessage, sendTelegramReleaseCard } from '../src/lib/telegram-bot.mjs'

const releaseMigration = readFileSync(new URL('../migrations/0009_release_announcements.sql', import.meta.url), 'utf8')

test('Telegram keeps paragraph breaks and sends the branded photo with buttons', async () => {
  const original = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) })
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }))
  }
  try {
    const env = { TELEGRAM_BOT_TOKEN: { get: async () => 'test' } }
    await sendTelegramMessage('@otyaplayer', 'First paragraph\n\nSecond paragraph', env)
    await sendTelegramReleaseCard('@otyaplayer', 'Otya update', env)
    assert.equal(requests[0].body.text, 'First paragraph\n\nSecond paragraph')
    assert.match(requests[1].url, /\/sendPhoto$/)
    assert.equal(requests[1].body.photo, 'https://petersmartlink.com/otya-release-card.jpg')
    assert.equal(requests[1].body.reply_markup.inline_keyboard[0][0].text, 'Download Otya')
  } finally { globalThis.fetch = original }
})

function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(releaseMigration)
  return { close: () => sqlite.close(), prepare(sql) {
    const statement = sqlite.prepare(sql)
    const wrap = (args = []) => ({
      bind: (...values) => wrap(values),
      async run() { return { meta: { changes: Number(statement.run(...args).changes) } } },
      async first() { return statement.get(...args) },
    })
    return wrap()
  } }
}

const release = { tag: 'v1.0.0+3', version: '1.0.0', workerUrl: 'https://petersmartlink.com', changelog: 'Improved playback.' }

test('release caption stays compact and omits contributor lists and links', () => {
  const text = releaseAnnouncementText({ ...release, changelog: '- Better playback\n- Clearer controls\n- Improved reliability\n- Fourth item\nCo-authored-by: Someone\nhttps://example.com' })
  assert.equal(text.split('\n').filter(line => line.startsWith('•')).length, 3)
  assert.doesNotMatch(text, /Someone|example.com|Fourth item/)
  assert.ok(text.length < 1024)
})

test('release announcement ledger is migration-owned, not workflow-created', () => {
  const source = readFileSync(new URL('../src/lib/release-announcement.mjs', import.meta.url), 'utf8')
  assert.match(releaseMigration, /CREATE TABLE IF NOT EXISTS release_announcements/)
  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS release_announcements/)
})

test('concurrent and repeated release jobs send one announcement', async () => {
  const DB = database(); let calls = 0
  try {
    const send = async (channel, text) => { calls++; assert.equal(channel, '@otyaplayer'); assert.match(text, /Improved playback/); return { message_id: 123 } }
    const env = { DB, TELEGRAM_BOT_TOKEN: 'test' }
    await Promise.all([announceRelease(env, release, send), announceRelease(env, release, send)])
    assert.deepEqual(await announceRelease(env, release, send), { status: 'sent', duplicate: true })
    assert.equal(calls, 1)
  } finally { DB.close() }
})

test('uncertain Telegram failure is recorded and not automatically resent', async () => {
  const DB = database(); let calls = 0
  try {
    const send = async () => { calls++; throw new Error('timeout') }
    const env = { DB, TELEGRAM_BOT_TOKEN: 'test' }
    assert.equal((await announceRelease(env, release, send)).status, 'pending-review')
    assert.equal((await announceRelease(env, release, send)).status, 'pending-review')
    assert.equal(calls, 1)
  } finally { DB.close() }
})

test('missing configuration does not send and long release notes fit Telegram', async () => {
  assert.equal((await announceRelease({}, release, () => assert.fail('must not send'))).status, 'not-configured')
  const text = releaseAnnouncementText({ ...release, changelog: 'x'.repeat(8000) })
  assert.ok(text.length < 1024)
  assert.match(text, /PeterSmart Link/)
})
