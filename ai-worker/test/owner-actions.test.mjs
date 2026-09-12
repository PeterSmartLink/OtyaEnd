import test from 'node:test'
import assert from 'node:assert/strict'
import { handleOwnerActions } from '../src/owner-actions.mjs'
import { MemoryD1 } from './memory-d1.mjs'

class MemoryKv {
  constructor(){ this.rows = new Map() }
  async get(key){ return this.rows.get(key) ?? null }
  async put(key,value){ this.rows.set(key,value) }
}

const authHeaders = {
  'Content-Type': 'application/json',
  'X-OTYA-Internal-Secret': 'owner-secret',
}

function request(path, body) {
  return new Request(`https://internal.example${path}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(body),
  })
}

test('owner actions reject requests without the private internal secret', async () => {
  const response = await handleOwnerActions(
    new Request('https://internal.example/api/admin/ai/actions/status?id=x'),
    { INTERNAL_SECRET: 'owner-secret', KV: new MemoryKv(), DB: new MemoryD1() },
  )
  assert.equal(response.status, 401)
})

test('Telegram writes require prepare then exact approval and go through Otya core exactly once', async () => {
  const originalFetch = globalThis.fetch
  let externalWrites = 0
  globalThis.fetch = async (url, init) => {
    externalWrites += 1
    assert.equal(String(url), 'https://petersmartlink.com/api/admin/telegram/test')
    const headers = new Headers(init.headers)
    assert.equal(headers.get('X-OTYA-Internal-Secret'), 'owner-secret')
    assert.equal(headers.get('X-OTYA-Admin-Action'), 'telegram')
    const body = JSON.parse(init.body)
    assert.equal(body.destination, 'channel')
    assert.equal(body.text, 'New OTYA build is still being tested.')
    return new Response(JSON.stringify({ ok: true, message_id: 42 }), {
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
    }

    const preparedResponse = await handleOwnerActions(
      request('/api/admin/ai/actions/prepare', {
        type: 'telegram_post',
        payload: { text: 'New OTYA build is still being tested.' },
      }),
      env,
    )
    assert.equal(preparedResponse.status, 201)
    const prepared = await preparedResponse.json()
    assert.equal(prepared.action.status, 'pending')
    assert.equal(externalWrites, 0, 'prepare must never perform the external write')

    const badApproval = await handleOwnerActions(
      request('/api/admin/ai/actions/approve', {
        id: prepared.action.id,
        approval_token: 'wrong-token',
      }),
      env,
    )
    assert.equal(badApproval.status, 400)
    assert.equal(externalWrites, 0)

    const approvedResponse = await handleOwnerActions(
      request('/api/admin/ai/actions/approve', {
        id: prepared.action.id,
        approval_token: prepared.action.approval_token,
      }),
      env,
    )
    assert.equal(approvedResponse.status, 200)
    const approved = await approvedResponse.json()
    assert.equal(approved.action.status, 'completed')
    assert.equal(approved.action.result.message_id, 42)
    assert.equal(externalWrites, 1)

    const duplicate = await handleOwnerActions(
      request('/api/admin/ai/actions/approve', {
        id: prepared.action.id,
        approval_token: prepared.action.approval_token,
      }),
      env,
    )
    assert.equal(duplicate.status, 400)
    assert.equal(externalWrites, 1, 'a repeated approval must never repeat the external write')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('owner email action is restricted to the configured owner address', async () => {
  const originalFetch = globalThis.fetch
  let sentTo = null
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sentTo = body.to
    assert.match(init.headers['Idempotency-Key'], /^otya-owner-/)
    return new Response(JSON.stringify({ id: 'email-1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const env = {
      INTERNAL_SECRET: 'owner-secret',
      KV: new MemoryKv(),
      DB: new MemoryD1(),
      RESEND_API_KEY: 'test-key',
      ADMIN_REPORT_EMAIL: 'owner@example.com',
    }
    const prepared = await (await handleOwnerActions(
      request('/api/admin/ai/actions/prepare', {
        type: 'owner_email',
        payload: {
          subject: 'OTYA owner brief',
          text: 'Everything is healthy.',
          to: 'attacker@example.com',
        },
      }),
      env,
    )).json()

    const approved = await handleOwnerActions(
      request('/api/admin/ai/actions/approve', {
        id: prepared.action.id,
        approval_token: prepared.action.approval_token,
      }),
      env,
    )
    assert.equal(approved.status, 200)
    assert.deepEqual(sentTo, ['owner@example.com'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('support reply preparation exposes exact text but performs no send', async () => {
  const env = {
    INTERNAL_SECRET: 'owner-secret',
    KV: new MemoryKv(),
    DB: new MemoryD1(),
  }
  const exactReply = 'Thanks for reporting this. I have recorded the details and will follow up when we have verified the fix.'
  const response = await handleOwnerActions(
    request('/api/admin/ai/actions/prepare', {
      type: 'support_reply',
      payload: {
        email_id: 'gmail-message-1',
        recipient: 'customer@example.com',
        subject: 'Playback issue',
        reply: exactReply,
        risk: 'medium',
      },
    }),
    env,
  )
  assert.equal(response.status, 201)
  const prepared = await response.json()
  assert.equal(prepared.action.status, 'pending')
  assert.equal(prepared.action.type, 'support_reply')
  assert.equal(prepared.action.payload.reply, exactReply)
  assert.equal(prepared.action.payload.text, exactReply)
  assert.equal(prepared.action.payload.recipient, 'customer@example.com')
})
