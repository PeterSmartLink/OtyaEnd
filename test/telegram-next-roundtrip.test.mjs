import test from 'node:test'
import assert from 'node:assert/strict'

import { handleTelegramWebhook } from '../src/lib/telegram-bot.mjs'

test('private Telegram messages round-trip through Next and back to the same chat', async t => {
  const originalFetch = globalThis.fetch
  const sent = []
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    if (!url.includes('api.telegram.org/botTEST_TOKEN/sendMessage')) {
      throw new Error(`Unexpected external request: ${url}`)
    }
    sent.push(JSON.parse(init.body))
    return new Response(JSON.stringify({ ok: true, result: { message_id: 91 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  t.after(() => { globalThis.fetch = originalFetch })

  let nextRequest = null
  const env = {
    TELEGRAM_WEBHOOK_SECRET: { get: async () => 'webhook-secret' },
    TELEGRAM_BOT_TOKEN: { get: async () => 'TEST_TOKEN' },
    INTERNAL_SECRET: 'internal-secret',
    AI_SUPPORT: {
      fetch: async request => {
        nextRequest = request
        return new Response(JSON.stringify({ answer: 'Hello from Next.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
    KV: {
      get: async () => null,
      put: async () => undefined,
    },
  }

  const response = await handleTelegramWebhook(new Request('https://petersmartlink.com/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret',
    },
    body: JSON.stringify({
      update_id: 1001,
      message: {
        message_id: 10,
        from: { id: 7, is_bot: false },
        chat: { id: 42, type: 'private' },
        text: 'Hello',
      },
    }),
  }), env)

  assert.equal(response.status, 200)
  assert.equal((await response.json()).ok, true)
  assert.ok(nextRequest)
  assert.equal(new URL(nextRequest.url).pathname, '/api/ai/chat')
  assert.equal(nextRequest.headers.get('X-OTYA-Channel'), 'telegram')
  assert.equal(nextRequest.headers.get('X-OTYA-Internal-Secret'), 'internal-secret')
  assert.deepEqual(await nextRequest.json(), { message: 'Hello', channel: 'telegram' })
  assert.deepEqual(sent, [{
    chat_id: 42,
    text: 'Hello from Next.',
    link_preview_options: { is_disabled: true },
  }])
})
