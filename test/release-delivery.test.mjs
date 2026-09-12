import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { queueReleaseOnce, sendReleaseReport } from '../src/lib/release-delivery.mjs'

function database(t) {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  return { prepare(sql) {
    const statement = sqlite.prepare(sql)
    const wrap = (args = []) => ({
      bind: (...values) => wrap(values),
      async run() { return { meta: { changes: Number(statement.run(...args).changes) } } },
      async first() { return statement.get(...args) },
    })
    return wrap()
  } }
}

test('overlapping workflow attempts enqueue once even when KV returns no marker', async t => {
  let calls = 0
  const env = { DB: database(t), KV: { get: async () => null }, PUSH_QUEUE: { send: async () => { calls++ } } }
  const results = await Promise.all(Array.from({ length: 10 }, () => queueReleaseOnce(env, 'v1.0.0+3', { type: 'release_available' })))
  assert.equal(calls, 1)
  assert.equal(results.filter(result => result.queued).length, 1)
  assert.equal((await queueReleaseOnce(env, 'v1.0.0+3', {})).status, 'queued')
})

test('uncertain queue acceptance stays reserved for review', async t => {
  let calls = 0
  const env = { DB: database(t), PUSH_QUEUE: { send: async () => { calls++; throw new Error('connection lost') } } }
  assert.equal((await queueReleaseOnce(env, 'v1.0.0+4', {})).status, 'pending-review')
  assert.equal((await queueReleaseOnce(env, 'v1.0.0+4', {})).duplicate, true)
  assert.equal(calls, 1)
})

test('known legacy sends and missing queue configuration never enqueue', async t => {
  const DB = database(t)
  const env = { DB, KV: { get: async () => 'sent' }, PUSH_QUEUE: { send: () => assert.fail('duplicate send') } }
  assert.equal((await queueReleaseOnce(env, 'v1.0.0+2', {})).status, 'queued-legacy')
  assert.equal((await queueReleaseOnce({ DB }, 'v1.0.0+3', {})).status, 'not-configured')
})

test('queue success remains visible if saving its result fails', async t => {
  const DB = database(t)
  const env = { DB: { prepare(sql) {
    if (sql.startsWith('UPDATE')) throw new Error('database unavailable')
    return DB.prepare(sql)
  } }, PUSH_QUEUE: { send: async () => {} } }
  const result = await queueReleaseOnce(env, 'v1.0.0+3', {})
  assert.equal(result.queued, true)
  assert.equal(result.status, 'queued-record-pending-review')
})

test('identical reports use a stable idempotency key and a bounded request', async () => {
  const calls = []
  const env = { RESEND_API_KEY: { get: async () => 'test' }, ADMIN_REPORT_EMAIL: 'owner@example.com' }
  const request = async (_, options) => {
    calls.push(options)
    return new Response(JSON.stringify({ id: 'accepted' }))
  }
  await sendReleaseReport(env, 'Release complete', 'Status: published', request)
  await sendReleaseReport(env, 'Release complete', 'Status: published', request)
  await sendReleaseReport(env, 'Release failed', 'Status: failed', request)
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
  assert.notEqual(calls[0].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key'])
  assert.equal(calls[0].headers.Authorization, 'Bearer test')
  assert.ok(calls[0].signal instanceof AbortSignal)
})

test('report does not claim success without provider acceptance', async () => {
  const env = { RESEND_API_KEY: 'test', ADMIN_REPORT_EMAIL: 'owner@example.com' }
  await assert.rejects(sendReleaseReport(env, 'Release', 'Body', async () => new Response('{}')), /not confirmed/)
  await assert.rejects(sendReleaseReport(env, 'Release', 'Body', async () => new Response('{}', { status: 503 })), /HTTP 503/)
})
