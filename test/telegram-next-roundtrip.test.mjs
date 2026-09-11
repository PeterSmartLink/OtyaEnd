import test from 'node:test'
import assert from 'node:assert/strict'

import { handleTelegramWebhook } from '../src/lib/telegram-bot.mjs'

function telegramEnv({ nextAnswer = 'Hello from Next.' } = {}) {
  const kv = new Map()
  const nextRequests = []
  return {
    env: {
      TELEGRAM_WEBHOOK_SECRET: { get: async () => 'webhook-secret' },
      TELEGRAM_BOT_TOKEN: { get: async () => 'TEST_TOKEN' },
      INTERNAL_SECRET: 'internal-secret',
      AI_SUPPORT: {
        fetch: async request => {
          nextRequests.push(request)
          return new Response(JSON.stringify({ answer: nextAnswer }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },
      KV: {
        get: async key => kv.get(key) ?? null,
        put: async (key, value) => { kv.set(key, value) },
      },
    },
    kv,
    nextRequests,
  }
}

function installTelegramSendMock(t) {
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
  return sent
}

function webhookRequest(update) {
  return new Request('https://petersmartlink.com/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret',
    },
    body: JSON.stringify(update),
  })
}

test('private Telegram messages round-trip through Next and back to the same chat', async t => {
  const sent = installTelegramSendMock(t)
  const { env, nextRequests } = telegramEnv()

  const response = await handleTelegramWebhook(webhookRequest({
    update_id: 1001,
    message: {
      message_id: 10,
      from: { id: 7, is_bot: false },
      chat: { id: 42, type: 'private' },
      text: 'Hello',
    },
  }), env)

  assert.equal(response.status, 200)
  assert.equal((await response.json()).ok, true)
  assert.equal(nextRequests.length, 1)
  const nextRequest = nextRequests[0]
  assert.equal(new URL(nextRequest.url).pathname, '/api/ai/chat')
  assert.equal(nextRequest.headers.get('X-OTYA-Channel'), 'telegram')
  assert.equal(nextRequest.headers.get('X-OTYA-Internal-Secret'), 'internal-secret')
  assert.deepEqual(await nextRequest.json(), {
    message: 'Hello',
    channel: 'telegram',
    surface: 'telegram_private',
    guest_id: 'telegram:7',
  })
  assert.deepEqual(sent, [{
    chat_id: 42,
    text: 'Hello from Next.',
    link_preview_options: { is_disabled: true },
  }])
})

test('comments under the official Otya channel round-trip through Next inside the linked discussion', async t => {
  const sent = installTelegramSendMock(t)
  const { env, kv, nextRequests } = telegramEnv({ nextAnswer: 'Otya is a local-first media player.' })

  const response = await handleTelegramWebhook(webhookRequest({
    update_id: 1002,
    message: {
      message_id: 31,
      message_thread_id: 22,
      from: { id: 17, is_bot: false, username: 'listener' },
      chat: { id: -100700, type: 'supergroup', title: 'Otya discussion' },
      text: 'What is Otya?',
      reply_to_message: {
        message_id: 30,
        is_automatic_forward: true,
        sender_chat: { id: -100100, type: 'channel', username: 'otyaplayer' },
        chat: { id: -100700, type: 'supergroup' },
      },
    },
  }), env)

  assert.equal(response.status, 200)
  assert.equal((await response.json()).ok, true)
  assert.equal(kv.get('telegram:discussion:chat_id'), '-100700')
  assert.equal(nextRequests.length, 1)
  assert.deepEqual(await nextRequests[0].json(), {
    message: 'What is Otya?',
    channel: 'telegram',
    surface: 'telegram_discussion',
    guest_id: 'telegram:17',
  })
  assert.deepEqual(sent, [{
    chat_id: -100700,
    text: 'Otya is a local-first media player.',
    link_preview_options: { is_disabled: true },
    reply_parameters: { message_id: 31, allow_sending_without_reply: true },
    message_thread_id: 22,
  }])
})

test('mentions in the learned Otya discussion group are answered by Next', async t => {
  const sent = installTelegramSendMock(t)
  const { env, kv, nextRequests } = telegramEnv({ nextAnswer: 'Yes. What would you like to know?' })
  kv.set('telegram:discussion:chat_id', '-100700')

  const response = await handleTelegramWebhook(webhookRequest({
    update_id: 1003,
    message: {
      message_id: 40,
      from: { id: 18, is_bot: false, username: 'anotherlistener' },
      chat: { id: -100700, type: 'supergroup', title: 'Otya discussion' },
      text: '@OtyaPlayerBot can you help me?',
    },
  }), env)

  assert.equal(response.status, 200)
  assert.equal((await response.json()).ok, true)
  assert.equal(nextRequests.length, 1)
  assert.deepEqual(await nextRequests[0].json(), {
    message: 'can you help me?',
    channel: 'telegram',
    surface: 'telegram_discussion',
    guest_id: 'telegram:18',
  })
  assert.deepEqual(sent, [{
    chat_id: -100700,
    text: 'Yes. What would you like to know?',
    link_preview_options: { is_disabled: true },
    reply_parameters: { message_id: 40, allow_sending_without_reply: true },
  }])
})

test('Next ignores unrelated Telegram groups', async t => {
  const sent = installTelegramSendMock(t)
  const { env, nextRequests } = telegramEnv()

  const response = await handleTelegramWebhook(webhookRequest({
    update_id: 1004,
    message: {
      message_id: 41,
      from: { id: 27, is_bot: false },
      chat: { id: -100900, type: 'supergroup', title: 'Unrelated group' },
      text: '@OtyaPlayerBot hello',
    },
  }), env)

  assert.equal(response.status, 200)
  assert.equal((await response.json()).ok, true)
  assert.equal(nextRequests.length, 0)
  assert.deepEqual(sent, [])
})

test('official Otya channel posts never trigger an AI echo loop', async t => {
  const sent = installTelegramSendMock(t)
  const { env, nextRequests } = telegramEnv()

  const response = await handleTelegramWebhook(webhookRequest({
    update_id: 1005,
    channel_post: {
      message_id: 51,
      sender_chat: { id: -100100, type: 'channel', username: 'otyaplayer' },
      chat: { id: -100100, type: 'channel', username: 'otyaplayer' },
      text: 'Official Otya announcement',
    },
  }), env)

  assert.equal(response.status, 200)
  assert.equal((await response.json()).ok, true)
  assert.equal(nextRequests.length, 0)
  assert.deepEqual(sent, [])
})
