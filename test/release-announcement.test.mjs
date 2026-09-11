import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { announceRelease, releaseAnnouncementText } from '../src/lib/release-announcement.mjs'
function database() {
  const sqlite = new DatabaseSync(':memory:')
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
  assert.ok(text.length < 4096)
  assert.match(text, /https:\/\/petersmartlink.com\/download\/otya-player/)
})
