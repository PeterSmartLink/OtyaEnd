import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const security = readFileSync(new URL('../public/.well-known/security.txt', import.meta.url), 'utf8')

test('public security.txt exposes the canonical private reporting contract', () => {
  assert.match(security, /^Contact: mailto:support@petersmartlink\.com$/m)
  assert.match(security, /^Expires: 2027-09-01T00:00:00Z$/m)
  assert.match(security, /^Preferred-Languages: en$/m)
  assert.match(security, /^Canonical: https:\/\/petersmartlink\.com\/\.well-known\/security\.txt$/m)
  assert.match(security, /^Policy: https:\/\/github\.com\/PeterSmartLink\/OtyaHub\/security\/policy$/m)
  assert.doesNotMatch(security, /token|secret|password|api[_-]?key/i)
})
