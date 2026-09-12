import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import ts from 'typescript'
import { recordRuntimeOperationalEvent } from '../src/lib/operational-events.mjs'

async function moduleAt(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const { verifyJwtViaService } = await moduleAt('../src/lib/auth-service.ts')
const { recordNotificationEvent, recordOperationalEvent } = await moduleAt('../src/lib/operations.ts')

test('auth verification rejects malformed identities and accepts a bounded verification request', async () => {
  for (const payload of [null, {}, { ok: 'true', user_id: 'user' }, { ok: true }, { ok: true, user_id: ' ' }]) {
    const result = await verifyJwtViaService({ AUTH: { fetch: async () => Response.json(payload) } }, 'token')
    assert.equal(result.ok, false)
  }
  const result = await verifyJwtViaService({ AUTH: { fetch: async request => {
    assert.equal(request.headers.get('Authorization'), 'Bearer token')
    assert.ok(request.signal instanceof AbortSignal)
    return Response.json({ ok: true, user_id: 'user', email: 'user@example.com', unexpected: 'ignored' })
  } } }, 'token')
  assert.deepEqual(result, { ok: true, user_id: 'user', email: 'user@example.com' })
})

function captureDB() {
  const writes = []
  return { writes, prepare: () => ({ bind: (...values) => ({ run: async () => { writes.push(values) } }) }) }
}

test('oversized operational data remains bounded, valid JSON in both worker paths', async () => {
  const details = { message: '\\"\n'.repeat(15000) }
  for (const write of [
    db => recordOperationalEvent(db, { component: 'test', eventType: 'test', status: 'ok', details }),
    db => recordRuntimeOperationalEvent({ DB: db }, { details }),
  ]) {
    const db = captureDB()
    await write(db)
    const value = db.writes[0][5]
    assert.ok(value.length <= 12000)
    assert.equal(JSON.parse(value).truncated, true)
  }
})

test('device-only notifications cannot be recorded as public inbox events', async () => {
  const db = captureDB()
  await assert.rejects(recordNotificationEvent(db, { deviceId: 'device', eventType: 'test', title: 'Private', body: 'Private' }), /user identity/)
  assert.equal(db.writes.length, 0)
  await recordNotificationEvent(db, { userId: 'user', deviceId: 'device', eventType: 'test', title: 'Private', body: 'Private', data: { text: 'x'.repeat(20000) } })
  assert.equal(JSON.parse(db.writes[0][7]).truncated, true)
})

test('inbox list, counts, bulk reads and single lookup exclude other users and device-only events', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(`CREATE TABLE notification_events (id TEXT PRIMARY KEY, user_id TEXT, device_id TEXT, event_type TEXT, severity TEXT, title TEXT, body TEXT, data_json TEXT, source TEXT, delivery_channel TEXT, delivery_status TEXT, created_at TEXT, expires_at TEXT);
      CREATE TABLE notification_reads (notification_id TEXT, user_id TEXT, read_at TEXT, PRIMARY KEY(notification_id,user_id));
      INSERT INTO notification_events(id,user_id,device_id) VALUES ('global',NULL,NULL),('own','alice','phone'),('other','bob',NULL),('device',NULL,'secret-phone');`)
    const source = readFileSync(new URL('../src/app/api/notifications/route.ts', import.meta.url), 'utf8')
    const sql = [...source.matchAll(/db\.prepare\(`([\s\S]*?)`\)/g)].map(match => match[1].replace('${unreadClause}', ''))
    assert.equal(sql.length, 5)
    assert.deepEqual(db.prepare(sql[0]).all('alice', 'alice', 100).map(row => row.id).sort(), ['global', 'own'])
    assert.equal(db.prepare(sql[1]).get('alice', 'alice').count, 2)
    db.prepare(sql[2]).run('alice', 'alice')
    assert.deepEqual(db.prepare('SELECT notification_id FROM notification_reads').all().map(row => row.notification_id).sort(), ['global', 'own'])
    assert.equal(db.prepare(sql[1]).get('alice', 'alice').count, 0)
    for (const id of ['device', 'other']) assert.equal(db.prepare(sql[3]).get(id, 'alice'), undefined)
    assert.equal(db.prepare(sql[3]).get('own', 'alice').id, 'own')
  } finally { db.close() }
})
