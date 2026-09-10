import test from 'node:test'
import assert from 'node:assert/strict'
import { providerRequest } from '../src/provider-request.mjs'

test('provider requests preserve response and payload without retrying', async () => {
  let calls = 0
  const expected = new Response(null, { status: 202 })
  const response = await providerRequest('https://provider.example', { method: 'POST', body: 'test' }, {
    fetchImpl: async (url, init) => {
      calls++
      assert.equal(url, 'https://provider.example')
      assert.equal(init.body, 'test')
      assert.equal(init.method, 'POST')
      assert.equal(init.signal.aborted, false)
      return expected
    },
  })
  assert.equal(response, expected)
  assert.equal(calls, 1)
})

test('stalled provider requests abort and are not resent', async () => {
  let calls = 0
  await assert.rejects(providerRequest('https://provider.example', {}, {
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => {
      calls++
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
    },
  }), /aborted/)
  assert.equal(calls, 1)
})
