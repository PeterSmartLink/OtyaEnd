import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('production Google sign-in verifies provider identity once and reuses the payload internally', () => {
  const production = read('auth-worker/src/production-entrypoint.ts')
  const wrapper = read('auth-worker/src/entrypoint.ts')
  const core = read('auth-worker/src/index.ts')

  assert.match(production, /async function verifiedGooglePayload/)
  assert.match(production, /signal: AbortSignal\.timeout\(GOOGLE_VERIFY_TIMEOUT_MS\)/)
  assert.match(production, /PREVERIFIED_GOOGLE_PAYLOAD: googlePayload/)
  assert.match(production, /!payload\.sub/)

  assert.match(wrapper, /PREVERIFIED_GOOGLE_PAYLOAD\?: GoogleTokenPayload/)
  assert.match(wrapper, /let payload = env\.PREVERIFIED_GOOGLE_PAYLOAD/)
  assert.match(wrapper, /if \(!payload\) \{[\s\S]*?oauth2\.googleapis\.com\/tokeninfo/)
  assert.match(wrapper, /signal: AbortSignal\.timeout\(GOOGLE_VERIFY_TIMEOUT_MS\)/)
  assert.match(wrapper, /PREVERIFIED_GOOGLE_PAYLOAD: googlePayload/)

  assert.match(core, /PREVERIFIED_GOOGLE_PAYLOAD\?: GoogleTokenPayload/)
  assert.match(core, /const trusted = validatedGooglePayload\(preverified, clientId\)/)
  assert.match(core, /if \(trusted\) return trusted/)
  assert.match(core, /signal: AbortSignal\.timeout\(GOOGLE_VERIFY_TIMEOUT_MS\)/)
  assert.match(core, /env\.PREVERIFIED_GOOGLE_PAYLOAD/)
})

test('all Google tokeninfo fallbacks validate issuer audience expiry subject and verified email', () => {
  const wrapper = read('auth-worker/src/entrypoint.ts')
  const core = read('auth-worker/src/index.ts')

  assert.match(wrapper, /payload\.aud === clientId/)
  assert.match(wrapper, /issuerOk/)
  assert.match(wrapper, /expiry > now/)
  assert.match(wrapper, /verified/)
  assert.match(wrapper, /Boolean\(payload\.email\)/)
  assert.match(wrapper, /Boolean\(payload\.sub\)/)

  assert.match(core, /payload\.aud !== clientId/)
  assert.match(core, /!issuerOk/)
  assert.match(core, /!verifiedEmail/)
  assert.match(core, /!payload\.sub/)
  assert.match(core, /!payload\.email/)
  assert.match(core, /expiry <= now/)
})
