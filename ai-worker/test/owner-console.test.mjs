import test from 'node:test'
import assert from 'node:assert/strict'
import { handleOwnerConsole } from '../src/owner-console.mjs'
import { MemoryD1 } from './memory-d1.mjs'

class MemoryKv {
  constructor(){ this.rows = new Map() }
  async get(key){ return this.rows.get(key) ?? null }
  async put(key,value){ this.rows.set(key,value) }
}

const headers = {
  'Content-Type': 'application/json',
  'X-OTYA-Internal-Secret': 'owner-secret',
}

function chat(message) {
  return new Request('https://otya.internal/api/admin/ai/console/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })
}

test('natural Telegram request prepares first and explicit go-ahead executes once', async () => {
  const originalFetch = globalThis.fetch
  let externalWrites = 0
  globalThis.fetch = async (url, init) => {
    externalWrites += 1
    assert.equal(String(url), 'https://petersmartlink.com/api/admin/telegram/test')
    const requestHeaders = new Headers(init.headers)
    assert.equal(requestHeaders.get('X-OTYA-Internal-Secret'), 'owner-secret')
    assert.equal(requestHeaders.get('X-OTYA-Admin-Action'), 'telegram')
    const body = JSON.parse(init.body)
    assert.equal(body.destination, 'channel')
    assert.equal(body.text, 'OTYA v1 rebuild is still being tested. We will share the release when it is ready.')
    return new Response(JSON.stringify({ ok: true, message_id: 99 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const env = {
      INTERNAL_SECRET: 'owner-secret',
      KV: new MemoryKv(),
      DB: new MemoryD1(),
      TELEGRAM_CHANNEL_URL: 'https://t.me/otyaplayer',
      AI: {
        async run(){
          return {
            response: JSON.stringify({
              action: 'telegram_post',
              payload: {
                text: 'OTYA v1 rebuild is still being tested. We will share the release when it is ready.',
              },
            }),
          }
        },
      },
    }

    const preparedResponse = await handleOwnerConsole(
      chat('Post an update to our Telegram channel that v1 rebuild is still under testing.'),
      env,
    )
    const prepared = await preparedResponse.json()
    assert.equal(preparedResponse.status, 200)
    assert.equal(prepared.approval_required, true)
    assert.equal(prepared.action.status, 'pending')
    assert.equal(externalWrites, 0)

    const approvedResponse = await handleOwnerConsole(chat('go ahead'), env)
    const approved = await approvedResponse.json()
    assert.equal(approvedResponse.status, 200)
    assert.equal(approved.action.status, 'completed')
    assert.equal(approved.action.result.message_id, 99)
    assert.equal(externalWrites, 1)

    const repeatedResponse = await handleOwnerConsole(chat('go ahead'), env)
    const repeated = await repeatedResponse.json()
    assert.equal(repeatedResponse.status, 200)
    assert.match(repeated.answer, /no pending owner action/i)
    assert.equal(externalWrites, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('drafting language does not prepare an external owner action', async () => {
  const env = {
    INTERNAL_SECRET: 'owner-secret',
    KV: new MemoryKv(),
    DB: new MemoryD1(),
    AI: {
      async run(){ return { response: '{"action":"none"}' } },
    },
  }

  // Once routing says none, the request is handed to the ordinary Console AI.
  // This test only locks the conservative router itself through the fact that
  // no owner-action KV record is created before delegation.
  try {
    await handleOwnerConsole(chat('Draft a Telegram announcement but do not post it.'), env)
  } catch {
    // The minimal test env intentionally lacks the full Console runtime.
  }
  assert.equal(await env.KV.get('owner-action:latest'), null)
})
