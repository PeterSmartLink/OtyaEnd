import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const link = read('auth-worker/src/google-link.ts')
const entry = read('auth-worker/src/production-entrypoint.ts')

test('Google provider linking is authenticated and uses immutable provider subject', () => {
  assert.match(link, /url\.pathname !== '\/auth\/google\/link'/)
  assert.match(link, /verifyJwt/)
  assert.match(link, /payload\.sub/)
  assert.match(link, /provider = 'google'/)
  assert.match(link, /provider_subject/)
  assert.match(link, /GOOGLE_IDENTITY_CONFLICT/)
  assert.match(link, /getUserByGoogleId/)
  assert.match(link, /getUserByEmail/)
})

test('Google link keeps one OTYA user and only adopts verified email when safe', () => {
  assert.match(link, /email = COALESCE\(email, \?\)/)
  assert.match(link, /email_verified/)
  assert.match(link, /emailOwner && emailOwner\.id !== user\.id/)
  assert.match(link, /legacyOwner && legacyOwner\.id !== user\.id/)
  assert.match(link, /touchUserProduct/)
  assert.doesNotMatch(link, /INSERT INTO users/)
})

test('production auth wrapper routes protected Google link before compatibility sign-in and audits the result', () => {
  assert.match(entry, /handleGoogleLink/)
  assert.match(entry, /const googleLinkResponse = await handleGoogleLink\(request, env\)/)
  assert.match(entry, /if \(googleLinkResponse\) return audited\(request, googleLinkResponse, env\)/)
  assert.match(entry, /withAuthSecurityEvent/)
})
