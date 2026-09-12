import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { handleTelegramWebhook } from '../src/lib/telegram-bot.mjs'

function database() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../migrations/0010_telegram_update_receipts.sql', import.meta.url), 'utf8'))
  return {
    close: () => sqlite.close(),
    raw: sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql)
      const wrap = (args = []) => ({
        bind: (...values) => wrap(values),
        async run() { return { meta: { changes: Number(statement.run(...args).changes) } } },
        async first() { return statement.get(...args) ?? null },
      })
      return wrap()
    },
  }
}

function request(updateId) {
  return new Request('https://petersmartlink.com/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'test-secret',
    },
    body: JSON.stringify({ update_id: updateId }),
  })
}

test('concurrent Telegram deliveries claim one D1 receipt and suppress the duplicate', async () => {
  const DB = database()
  const tasks = []
  const env = {
    DB,
    TELEGRAM_WEBHOOK_SECRET: { get: async () => 'test-secret' },
  }
  const ctx = { waitUntil(promise) { tasks.push(promise) } }
  try {
    const responses = await Promise.all([
      handleTelegramWebhook(request(4242), env, ctx),
      handleTelegramWebhook(request(4242), env, ctx),
    ])
    const bodies = await Promise.all(responses.map(response => response.json()))
    assert.equal(bodies.filter(body => body.duplicate === true).length, 1)
    assert.equal(bodies.filter(body => body.ok === true).length, 2)
    await Promise.all(tasks)
    const row = DB.raw.prepare('SELECT status FROM telegram_update_receipts WHERE update_id = ?').get(4242)
    assert.equal(row.status, 'done')
    const count = DB.raw.prepare('SELECT COUNT(*) count FROM telegram_update_receipts WHERE update_id = ?').get(4242)
    assert.equal(Number(count.count), 1)
  } finally {
    DB.close()
  }
})

test('Telegram webhook dedupe is migration-owned and no longer uses KV GET then PUT', () => {
  const source = readFileSync(new URL('../src/lib/telegram-bot.mjs', import.meta.url), 'utf8')
  const migration = readFileSync(new URL('../migrations/0010_telegram_update_receipts.sql', import.meta.url), 'utf8')
  assert.match(source, /INSERT OR IGNORE INTO telegram_update_receipts/)
  assert.match(source, /finishTelegramUpdate/)
  assert.doesNotMatch(source, /telegram:update:/)
  assert.doesNotMatch(source, /async function isDuplicate/)
  assert.match(migration, /update_id INTEGER PRIMARY KEY/)
  assert.match(migration, /CHECK \(status IN \('processing', 'done', 'failed'\)\)/)
})
