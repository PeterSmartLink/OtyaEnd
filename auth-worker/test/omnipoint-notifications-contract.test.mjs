import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('OmniPoint low-stock notices use the central Resend transport and operator recipients', () => {
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

test('OmniPoint low-stock notices validate thresholds and suppress repeated alerts', () => {
  const handler = read('src/omnipoint-notifications.ts')

  assert.match(handler, /quantityOnHand.*reorderLevel/)
  assert.match(handler, /COOLDOWN_SECONDS/)
  assert.match(handler, /notify:omnipoint:low-stock/)
  assert.match(handler, /invalid_low_stock_notice/)
  assert.match(handler, /notification_delivery_failed/)
  assert.match(handler, /cache-control.*no-store/)
})

test('Otya Auth stays private to service bindings for internal notifications', () => {
  const config = read('wrangler.toml')
  const handler = read('src/omnipoint-notifications.ts')

  assert.match(config, /^workers_dev = false$/m)
  assert.match(handler, /service-binding calls from trusted Otya Workers only/)
  assert.match(handler, /x-otya-service.*omnipoint/)
})
