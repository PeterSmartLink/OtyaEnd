import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('OmniPoint notification route uses central Resend and fixed operator recipients', () => {
  const handler = read('src/omnipoint-notifications.ts')
  const entrypoint = read('src/production-entrypoint.ts')
  const resend = read('src/resend.ts')

  assert.match(entrypoint, /handleOmniPointNotification/)
  assert.match(handler, /\/internal\/notifications\/omnipoint\/low-stock/)
  assert.match(handler, /x-otya-service/)
  assert.match(handler, /env\.ADMIN_EMAILS/)
  assert.match(handler, /sendResendEmail\(env\.RESEND_API_KEY/)
  assert.match(resend, /https:\/\/api\.resend\.com\/emails/)
  assert.doesNotMatch(handler, /input\.to|body\.to|request\.headers\.get\(['"]to['"]\)/)
})

test('low-stock notification validates stock and suppresses repeat emails', () => {
  const handler = read('src/omnipoint-notifications.ts')
  assert.match(handler, /quantityOnHand/)
  assert.match(handler, /reorderLevel/)
  assert.match(handler, /COOLDOWN_SECONDS/)
  assert.match(handler, /notify:omnipoint:low-stock/)
  assert.match(handler, /notification_delivery_failed/)
  assert.match(handler, /rawBody\.length > 4096/)
})

test('shared Resend contract documents the existing provider and safe rollout', () => {
  const docs = read('../docs/ECOSYSTEM_EMAIL.md')
  assert.match(docs, /petersmartlink\.com is verified/)
  assert.match(docs, /Do not rotate\/create API keys/)
  assert.match(docs, /Cloudflare Queues/)
})
