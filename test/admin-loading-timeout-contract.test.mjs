import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('owner authorization lookups remain bounded server-side', () => {
  const auth = read('src/lib/admin_auth.ts')
  const route = read('src/app/api/admin/session/route.ts')
  assert.match(auth, /AUTH_LOOKUP_TIMEOUT_MS = 5000/)
  assert.match(auth, /signal: AbortSignal\.timeout\(AUTH_LOOKUP_TIMEOUT_MS\)/)
  assert.match(route, /AUTH_STEP_TIMEOUT_MS = 8000/)
})

test('browser Admin is retired and cannot render protected children', () => {
  const layout = read('src/app/admin/layout.tsx')
  assert.match(layout, /Owner control is in Next/)
  assert.match(layout, /browser workspace has been retired/)
  assert.doesNotMatch(layout, /getAdminSession\(\)/)
})
