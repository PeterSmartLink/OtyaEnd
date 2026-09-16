import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('live APK routes enforce active abuse controls and cache latest builds briefly', () => {
  const route = read('src/app/apk/[file]/route.ts')
  assert.match(route, /RATE_LIMITER/)
  assert.match(route, /blocked:\$\{ip\}/)
  assert.match(route, /Retry-After/)
  assert.match(route, /public, max-age=300, must-revalidate/)
  assert.match(route, /public, max-age=31536000, immutable/)
  assert.doesNotMatch(route, /headers\.set\('Cache-Control', 'public, max-age=3600'\)/)
})

test('production Google audience verification is bounded', () => {
  const source = read('auth-worker/src/production-entrypoint.ts')
  assert.match(source, /GOOGLE_VERIFY_TIMEOUT_MS = 8000/)
  assert.match(source, /signal: AbortSignal\.timeout\(GOOGLE_VERIFY_TIMEOUT_MS\)/)
  assert.match(source, /headers: \{ Accept: 'application\/json' \}/)
})

test('push queue bounds upstream calls and avoids whole-broadcast replay after partial delivery', () => {
  const queue = read('src/queue-worker.mjs')
  assert.match(queue, /UPSTREAM_TIMEOUT_MS = 8000/)
  assert.match(queue, /signal: AbortSignal\.timeout\(UPSTREAM_TIMEOUT_MS\)/)
  assert.match(queue, /sent === 0 && transientFailed > 0/)
  assert.match(queue, /sent > 0 && transientFailed > 0/)
  assert.match(queue, /were not replayed because/)
})

test('production health checks include private auth and Next service bindings', () => {
  const entry = read('src/entrypoint.mjs')
  assert.match(entry, /service:\$\{name\}/)
  assert.match(entry, /'otya-auth'/)
  assert.match(entry, /'otya-next'/)
  assert.match(entry, /https:\/\/otya-auth\/auth\/me/)
  assert.match(entry, /https:\/\/otya-next\/health/)
  assert.match(entry, /SERVICE_HEALTH_TIMEOUT_MS = 5000/)
})

test('generic admin release metadata endpoint cannot bypass canonical release workflow', () => {
  const route = read('src/app/api/admin/release/route.ts')
  assert.match(route, /verifyAdminSession/)
  assert.match(route, /Direct release metadata publishing is disabled/)
  assert.match(route, /verified GitHub release workflow/)
  assert.doesNotMatch(route, /INSERT INTO releases/)
  assert.doesNotMatch(route, /AI_QUEUE/)
})


test('Core operational alerts use the single Resend-backed email adapter', () => {
  const legacyCore = read('src/index.js')
  const entry = read('src/entrypoint.mjs')

  assert.match(entry, /withProductionAdapters\(env\)/)
  assert.match(entry, /EMAIL:createResendEmailAdapter\(env\)/)
  assert.match(legacyCore, /Resend email adapter unavailable/)
  assert.doesNotMatch(legacyCore, /env\.RESEND_API_KEY/)
  assert.doesNotMatch(legacyCore, /api\.resend\.com\/emails/)
})
