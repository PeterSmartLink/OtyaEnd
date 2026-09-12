import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('operations migration provides durable notification, security and queue evidence', () => {
  const sql = read('migrations/0007_operations_and_notifications.sql')
  for (const table of [
    'notification_events',
    'notification_reads',
    'security_events',
    'operational_events',
    'queue_delivery_events',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`))
  }
  assert.doesNotMatch(sql, /\bDROP\s+TABLE\b/i)
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i)
})

test('notification inbox keeps read state per user and enforces authenticated visibility', () => {
  const route = read('src/app/api/notifications/route.ts')
  assert.match(route, /verifyJwtViaService/)
  assert.match(route, /LEFT JOIN notification_reads/)
  assert.match(route, /ne\.user_id IS NULL AND ne\.device_id IS NULL/)
  assert.match(route, /WHERE id = \?[\s\S]*user_id IS NULL AND device_id IS NULL/)
  assert.match(route, /MAX_LIMIT = 100/)
})

test('admin elevation and session end write privacy-safe security audit events', () => {
  const route = read('src/app/api/admin/session/route.ts')
  assert.match(route, /recordSecurityEvent/)
  assert.match(route, /admin_session_elevated/)
  assert.match(route, /admin_session_ended/)
  assert.match(route, /correlationId: request\.headers\.get\('CF-Ray'\)/)
  const auditBlock = route.slice(route.indexOf('async function auditAdminSession'), route.indexOf('export async function GET'))
  assert.doesNotMatch(auditBlock, /otp/i)
  assert.doesNotMatch(auditBlock, /password/i)
  assert.doesNotMatch(auditBlock, /CF-Connecting-IP/)
})

test('push queue persists outcomes without replaying partial-success broadcasts', () => {
  const queue = read('src/queue-worker.mjs')
  assert.match(queue, /INSERT INTO queue_delivery_events/)
  assert.match(queue, /const retry = sent === 0 && transientFailed > 0/)
  assert.match(queue, /const outcome = retry \? 'retry' : failed > 0 \? 'partial' : 'success'/)
  assert.match(queue, /if \(evidence\.retry === true\) message\.retry\(\)/)
  assert.match(queue, /else message\.ack\(\)/)
})

test('production health records incident and recovery transitions without heartbeat spam', () => {
  const entry = read('src/entrypoint.mjs')
  assert.match(entry, /recordRuntimeOperationalEvent/)
  assert.match(entry, /production_health_incident/)
  assert.match(entry, /production_health_recovered/)
  assert.match(entry, /if\(signature===previousIncident\)return/)
})

test('explicit Core deploy validates and applies repository D1 migrations', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.match(pkg.scripts.check, /verify:migrations/)
  assert.match(pkg.scripts.predeploy, /verify:migrations/)
  assert.match(pkg.scripts.predeploy, /wrangler d1 migrations apply DB --remote/)
})

test('operations readiness is non-destructive and checks production recovery primitives', () => {
  const workflow = read('.github/workflows/operations-readiness.yml')
  assert.match(workflow, /wrangler d1 migrations list DB --remote/)
  assert.match(workflow, /wrangler d1 migrations list AUTH_DB --remote/)
  assert.match(workflow, /wrangler d1 time-travel info otya-store-db/)
  assert.match(workflow, /wrangler d1 time-travel info otya-auth-db/)
  assert.doesNotMatch(workflow, /time-travel restore/)
  assert.doesNotMatch(workflow, /d1 migrations apply/)
})
