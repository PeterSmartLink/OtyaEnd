import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const security = readFileSync(new URL('../public/.well-known/security.txt', import.meta.url), 'utf8')

test('public security.txt exposes the canonical private reporting contract', () => {
  assert.match(security, /^Contact: mailto:support@petersmartlink\.com$/m)
  assert.match(security, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m)
  assert.match(security, /^Preferred-Languages: en$/m)
  assert.match(security, /^Canonical: https:\/\/petersmartlink\.com\/\.well-known\/security\.txt$/m)
  assert.match(security, /^Policy: https:\/\/github\.com\/PeterSmartLink\/OtyaHub\/security\/policy$/m)
  assert.doesNotMatch(security, /token|secret|password|api[_-]?key/i)
})

test('security.txt expiry cannot silently approach production staleness', () => {
  const match = security.match(/^Expires: (.+)$/m)
  assert.ok(match, 'security.txt must declare Expires')
  const expiresAt = Date.parse(match[1])
  assert.ok(Number.isFinite(expiresAt), 'security.txt Expires must be a valid timestamp')
  const minimumRemaining = 30 * 24 * 60 * 60 * 1000
  assert.ok(
    expiresAt - Date.now() > minimumRemaining,
    'security.txt expires within 30 days; renew its Expires value before production disclosure metadata becomes stale',
  )
})
