import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const wrangler = read('wrangler.toml')
const queueWorker = read('src/queue-worker.mjs')
const releaseDelivery = read('src/lib/release-delivery.mjs')
const releaseDispatchMigration = read('migrations/0008_release_push_dispatch.sql')

test('core queue consumer matches the canonical Cloudflare push queue', () => {
  assert.match(wrangler, /binding\s*=\s*"PUSH_QUEUE"[\s\S]*?queue\s*=\s*"otya-push"/)
  assert.match(wrangler, /\[\[queues\.consumers\]\][\s\S]*?queue\s*=\s*"otya-push"/)
  assert.match(queueWorker, /batch\.queue !== 'otya-push'/)
  assert.doesNotMatch(queueWorker, /otya-push-queue/)
  assert.doesNotMatch(queueWorker, /otya-store received unexpected queue/)
})

test('push queue stays inside the Free Worker external-subrequest budget', () => {
  assert.match(wrangler, /max_batch_size\s*=\s*1/)
  assert.match(queueWorker, /const MAX_DIRECT_TARGETS = 40/)
  assert.match(queueWorker, /LIMIT \?/)
  assert.match(queueWorker, /Math\.max\(0, totalDirect - MAX_DIRECT_TARGETS\)/)
})

test('public broadcasts use Firebase topic fanout instead of scanning every device', () => {
  assert.match(queueWorker, /const PUBLIC_FCM_TOPIC = 'otya_public'/)
  assert.match(queueWorker, /message: \{ topic, \.\.\.baseMessage \}/)
  assert.match(queueWorker, /outcome: 'accepted-topic'/)
  assert.doesNotMatch(
    queueWorker,
    /SELECT DISTINCT fcm_token FROM devices WHERE fcm_token IS NOT NULL LIMIT \? OFFSET \?/,
  )
})

test('FCM service-account OAuth exchange keeps the standard JWT bearer grant', () => {
  assert.match(queueWorker, /urn:ietf:params:oauth:grant-type:jwt-bearer/)
})

test('release push idempotency schema is migration-owned, not request-created', () => {
  assert.match(releaseDispatchMigration, /CREATE TABLE IF NOT EXISTS release_push_dispatch/)
  assert.match(releaseDispatchMigration, /idx_release_push_dispatch_status_updated/)
  assert.doesNotMatch(releaseDelivery, /CREATE TABLE IF NOT EXISTS release_push_dispatch/)
  assert.match(releaseDelivery, /INSERT OR IGNORE INTO release_push_dispatch/)
})
