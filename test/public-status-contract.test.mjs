import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('public status API exposes only sanitized component state', () => {
  const route = read('src/app/api/status/route.ts')

  assert.match(route, /SERVICE_TIMEOUT_MS = 4000/)
  assert.match(route, /https:\/\/otya-auth\/auth\/me/)
  assert.match(route, /new Set\(\[401\]\)/)
  assert.match(route, /https:\/\/otya-next\/health/)
  assert.match(route, /new Set\(\[200\]\), true/)
  assert.match(route, /website: 'operational'/)
  assert.match(route, /accounts: accountsOk \? 'operational' : 'degraded'/)
  assert.match(route, /next: nextOk \? 'operational' : 'degraded'/)
  assert.match(route, /checkedAt: new Date\(\)\.toISOString\(\)/)
  assert.match(route, /s-maxage=60/)

  for (const forbidden of [
    'runtimeEnv.DB',
    'runtimeEnv.KV',
    'runtimeEnv.R2',
    'PUSH_QUEUE',
    'AI_QUEUE',
    'INTERNAL_SECRET',
    'ADMIN_',
    'database_name',
    'queue_name',
    'latency',
    'error:',
  ]) {
    assert.doesNotMatch(route, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('status host keeps the public status API same-origin', () => {
  const router = read('src/production-router.mjs')
  assert.match(router, /host === STATUS_HOST/)
  assert.match(router, /url\.pathname === '\/api\/status'/)
  assert.match(router, /dispatchSurface\(request, url, env, ctx, '\/api\/status'\)/)
})

test('status page uses live checks without exposing private operations', () => {
  const page = read('src/app/status/page.tsx')
  const client = read('src/app/status/StatusClient.tsx')

  assert.match(page, /LiveStatusPanel/)
  assert.doesNotMatch(page, /Live service monitoring is not displayed/)
  assert.match(client, /fetch\('\/api\/status'/)
  assert.match(client, /window\.setInterval\(refresh, 60_000\)/)
  assert.match(client, /Local playback/)
  assert.match(client, /device-first/)
  assert.doesNotMatch(client, /database|queue|secret|admin/i)
})
