import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile owner grant is device-bound, renewable and revocable', () => {
  const source = read('auth-worker/src/admin-mfa.ts')
  assert.match(source, /OWNER_GRANT_TTL = 30 \* 24 \* 60 \* 60/)
  assert.match(source, /OWNER_GRANT_RENEW_AFTER = 7 \* 24 \* 60 \* 60/)
  assert.match(source, /X-OTYA-Device-ID/)
  assert.match(source, /device_hash/)
  assert.match(source, /trusted_device: true/)
  assert.match(source, /\/auth\/admin\/mobile-grant/)
  assert.match(source, /\/auth\/admin\/verify-grant/)
  assert.match(source, /\/auth\/admin\/revoke-grant/)
  assert.match(source, /admin_owner_grant:\$\{user\.id\}/)
  assert.match(source, /ownerGrantDigest/)
  assert.doesNotMatch(source, /AUTH_JWT_SECRET.*owner_grant/i)
})

test('Next mobile gateway verifies the owner grant against the exact device before forwarding', () => {
  const source = read('src/app/api/owner/ai/[...path]/route.ts')
  assert.match(source, /verifyOwnerGrant/)
  assert.match(source, /\/auth\/admin\/verify-grant/)
  assert.match(source, /X-OTYA-Owner-Grant/)
  assert.match(source, /const deviceId = request\.headers\.get\('X-OTYA-Device-ID'\)/)
  assert.match(source, /'X-OTYA-Device-ID': deviceId/)
  assert.match(source, /!grant \|\| !deviceId/)
  assert.match(source, /headers\.delete\('authorization'\)/)
  assert.match(source, /headers\.delete\('x-otya-owner-grant'\)/)
  assert.match(source, /headers\.delete\('x-otya-device-id'\)/)
  assert.match(source, /X-OTYA-Internal-Secret/)
  assert.match(source, /next-android/)
})
