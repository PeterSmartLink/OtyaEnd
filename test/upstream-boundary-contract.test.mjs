import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const entrypoint = read('src/entrypoint.mjs')
const telegram = read('src/telegram-entrypoint.mjs')

test('core auth verification is bounded by an upstream timeout', () => {
  assert.match(entrypoint, /const UPSTREAM_TIMEOUT_MS = 8000/)
  assert.match(entrypoint, /signal:AbortSignal\.timeout\(UPSTREAM_TIMEOUT_MS\)/)
  assert.match(entrypoint, /function timedRequest\(request,timeoutMs=UPSTREAM_TIMEOUT_MS\)/)
})

test('core service binding failures become controlled 503 responses', () => {
  assert.match(entrypoint, /async function serviceFetch\(binding,request,errorMessage\)/)
  assert.match(entrypoint, /return json\(\{error:errorMessage\},503\)/)
  assert.match(entrypoint, /serviceFetch\(runtimeEnv\.AUTH,request,'Authentication service unavailable'\)/)
  assert.match(entrypoint, /serviceFetch\(env\.AI_SUPPORT,new Request\(request,\{headers\}\),'AI service unavailable'\)/)
})

test('Telegram admin verification cannot wait indefinitely for Auth', () => {
  assert.match(telegram, /const AUTH_TIMEOUT_MS = 5000/)
  assert.match(telegram, /signal: AbortSignal\.timeout\(AUTH_TIMEOUT_MS\)/)
  assert.match(telegram, /async function adminUser[\s\S]*?catch \{[\s\S]*?return null/)
})
