import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Next owner operations snapshots include durable push delivery evidence', () => {
  const scheduled = read('ai-worker/src/scheduled-entry.mjs')
  const migration = read('migrations/0007_operations_and_notifications.sql')

  assert.match(migration, /CREATE TABLE IF NOT EXISTS queue_delivery_events/)
  assert.match(migration, /failed_count\s+INTEGER NOT NULL DEFAULT 0/)
  assert.match(migration, /transient_failed INTEGER NOT NULL DEFAULT 0/)
  assert.match(migration, /outcome\s+TEXT NOT NULL/)

  assert.match(scheduled, /SUM\(failed_count\)/)
  assert.match(scheduled, /FROM queue_delivery_events WHERE created_at>=datetime\('now',\?\)/)
  assert.match(scheduled, /GROUP BY queue_name,outcome/)
  assert.match(scheduled, /queue_delivery_failures:queueFailures/)
  assert.match(scheduled, /queue_delivery:queueDeliveryRows/)
})

test('owner briefs treat queue failures as operational health, including non-AI fallback', () => {
  const scheduled = read('ai-worker/src/scheduled-entry.mjs')

  assert.match(scheduled, /Delivery health/)
  assert.match(scheduled, /Treat queue delivery failures as operational risks/)
  assert.match(scheduled, /distinguish transient failures from permanent failures/)
  assert.match(scheduled, /Push delivery failures: \$\{snapshot\.queue_delivery_failures\}/)
})
