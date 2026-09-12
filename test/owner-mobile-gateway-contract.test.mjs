import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('mobile owner grant is short-lived, account-bound and revocable', () => {
  const source = read('auth-worker/src/admin-mfa.ts')
  assert.match(source, /OWNER_GRANT_TTL = 60 \* 60/)
  assert.match(source, /\/auth\/admin\/mobile-grant/)
  assert.match(source, /\/auth\/admin\/verify-grant/)
  assert.match(source, /\/auth\/admin\/revoke-grant/)
  assert.match(source, /admin_owner_grant:\$\{user\.id\}/)
  assert.match(source, /ownerGrantDigest/)
  assert.doesNotMatch(source, /AUTH_JWT_SECRET.*owner_grant/i)
})

test('Next mobile gateway verifies owner grant before forwarding', () => {
  const source = read('src/app/api/owner/ai/[...path]/route.ts')
  assert.match(source, /verifyOwnerGrant/)
  assert.match(source, /\/auth\/admin\/verify-grant/)
  assert.match(source, /X-OTYA-Owner-Grant/)
  assert.match(source, /headers\.delete\('authorization'\)/)
  assert.match(source, /headers\.delete\('x-otya-owner-grant'\)/)
  assert.match(source, /X-OTYA-Internal-Secret/)
  assert.match(source, /next-android/)
})
