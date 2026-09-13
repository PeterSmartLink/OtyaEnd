import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Next mobile owner action endpoint binds approval to an exact action and trusted device', () => {
  const route = read('src/app/api/owner/ai/action/[operation]/route.ts')
  const actions = read('ai-worker/src/owner-actions.mjs')

  assert.match(route, /verifyOwnerGrant/)
  assert.match(route, /\/auth\/admin\/verify-grant/)
  assert.match(route, /X-OTYA-Owner-Grant/)
  assert.match(route, /const deviceId = request\.headers\.get\('X-OTYA-Device-ID'\)/)
  assert.match(route, /'X-OTYA-Device-ID': deviceId/)
  assert.match(route, /!grant \|\| !deviceId/)
  assert.match(route, /operation !== 'approve' && operation !== 'cancel'/)
  assert.match(route, /A valid action ID is required/)
  assert.match(route, /A valid approval token is required/)
  assert.match(route, /approval_token: approvalToken/)
  assert.match(route, /\/api\/admin\/ai\/actions\/\$\{operation\}/)
  assert.match(route, /X-OTYA-Channel': 'next-android'/)

  assert.match(actions, /Action ID and approval token are required/)
  assert.match(actions, /action\.approval_token !== token/)
  assert.match(actions, /Owner action was already claimed/)
  assert.match(actions, /Idempotency-Key.*otya-owner-/s)
})
