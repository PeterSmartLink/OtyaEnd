import test from 'node:test'
import assert from 'node:assert/strict'
import { signOutBrowser } from '../src/lib/browser-sign-out.mjs'

test('sign out confirms server success using same-origin credentials', async () => {
  await signOutBrowser({ fetchImpl: async (url, init) => {
    assert.equal(url, '/api/account-session/logout')
    assert.equal(init.method, 'POST')
    assert.equal(init.credentials, 'same-origin')
    return new Response(null, { status: 204 })
  } })
})

test('failed sign out is reported instead of showing a false signed-out state', async () => {
  await assert.rejects(signOutBrowser({ fetchImpl: async () => new Response(null, { status: 503 }) }), /Sign out failed/)
})

test('stalled sign out times out without retrying', async () => {
  let attempts = 0
  await assert.rejects(signOutBrowser({ timeoutMs: 5, fetchImpl: async (_url, { signal }) => {
    attempts++
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
  } }), /aborted/)
  assert.equal(attempts, 1)
})
