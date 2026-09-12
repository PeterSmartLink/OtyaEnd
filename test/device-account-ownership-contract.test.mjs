import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/api/device/route.ts', import.meta.url), 'utf8')

test('only a verified JWT establishes device account ownership', () => {
  assert.match(source, /const resolvedUserId = auth\.mode === 'jwt' \? auth\.user_id : null/)
  assert.doesNotMatch(source, /body\.user_id/)
})

test('anonymous registration detaches stale account ownership instead of preserving it', () => {
  assert.match(source, /user_id\s*=\s*excluded\.user_id/)
  assert.doesNotMatch(source, /user_id\s*=\s*COALESCE\(excluded\.user_id,\s*devices\.user_id\)/)
})
