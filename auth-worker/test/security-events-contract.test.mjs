import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const events = read('src/security-events.ts')
const production = read('src/production-entrypoint.ts')
const repair = read('scripts/repair-remote-schema.sh')
const migration = read('migrations/20260912_auth_security_events.sql')

test('Auth security evidence is additive and repaired before production promotion', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS auth_security_events/)
  assert.match(migration, /idx_auth_security_events_created/)
  assert.match(repair, /CREATE TABLE IF NOT EXISTS auth_security_events/)
  assert.match(repair, /idx_auth_security_events_user_created/)
})

test('material identity transitions are audited without request bodies or credentials', () => {
  for (const event of [
    'registration',
    'password_login',
    'google_login',
    'logout',
    'password_reset_requested',
    'password_reset',
    'email_verification',
    'account_deletion',
    'google_link',
  ]) {
    assert.match(events, new RegExp(`'${event}'`))
  }
  assert.match(events, /\/auth\/admin\//)
  assert.match(events, /\/auth\/telegram\//)
  assert.doesNotMatch(events, /request\.text\(/)
  assert.doesNotMatch(events, /request\.json\(/)
  assert.doesNotMatch(events, /Authorization/)
  assert.doesNotMatch(events, /password_hash/)
  assert.doesNotMatch(events, /otp/i)
  assert.doesNotMatch(events, /cf-connecting-ip/i)
})

test('security evidence cannot change the identity response outcome', () => {
  assert.match(events, /catch \(error\) \{[\s\S]*?Could not persist security evidence/)
  assert.match(events, /return response/)
  assert.match(production, /return withAuthSecurityEvent\(request, response, env\)/)
  assert.match(production, /return audited\(request, normalized, env\)/)
})
