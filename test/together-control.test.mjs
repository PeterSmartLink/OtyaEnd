import assert from 'node:assert/strict'
import test from 'node:test'

import { handleTogetherControl } from '../src/together-control.mjs'

class MemoryKv {
  constructor() { this.values = new Map() }

  async get(key) { return this.values.get(key) ?? null }

  async put(key, value) { this.values.set(key, value) }

  async list({ prefix = '', limit = 1000 } = {}) {
    const keys = [...this.values.keys()]
      .filter(key => key.startsWith(prefix))
      .sort()
      .slice(0, limit)
      .map(name => ({ name }))
    return { keys, list_complete: true }
  }
}

const identities = {
  host: { otya_id: '2IS00000001', username: 'peter', name: 'Peter', avatar_url: null },
  guest: { otya_id: '2IS00000002', username: 'sarah', name: 'Sarah', avatar_url: null },
  stranger: { otya_id: '2IS00000003', username: 'john', name: 'John', avatar_url: null },
}

function authBinding() {
  return {
    async fetch(request) {
      const url = new URL(request.url)
      const authorization = request.headers.get('Authorization') || ''
      const token = authorization.replace(/^Bearer\s+/, '')

      if (url.pathname !== '/auth/account') {
        return Response.json({ error: 'Not found' }, { status: 404 })
      }

      const lookup = url.searchParams.get('lookup_username')
      if (lookup) {
        const match = Object.values(identities).find(user => user.username === lookup)
        return match
          ? Response.json({ ok: true, user: match })
          : Response.json({ error: 'OTYA user not found.' }, { status: 404 })
      }

      const identity = identities[token]
      return identity
        ? Response.json({ ok: true, user: identity })
        : Response.json({ error: 'Unauthorized' }, { status: 401 })
    },
  }
}

function request(path, { method = 'GET', token = 'host', body } = {}) {
  return new Request(`https://petersmartlink.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function createRoom(env) {
  const response = await handleTogetherControl(
    request('/api/together/rooms', {
      method: 'POST',
      token: 'host',
      body: { invite_username: '@sarah' },
    }),
    env,
    { id: 'host-private' },
  )
  assert.equal(response.status, 201)
  return response.json()
}

test('room keeps raw invite token out of KV and stores no media/chat metadata', async () => {
  const env = { KV: new MemoryKv(), AUTH: authBinding() }
  const created = await createRoom(env)

  assert.ok(created.invite_token)
  assert.equal(created.room.host.username, 'peter')
  assert.equal(created.room.guest.username, 'sarah')

  const roomKey = [...env.KV.values.keys()].find(key => key.startsWith('together:room:'))
  assert.ok(roomKey)
  const stored = env.KV.values.get(roomKey)
  assert.doesNotMatch(stored, new RegExp(created.invite_token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(stored, /fingerprint|filename|media_url|chat|message|playback/i)

  const parsed = JSON.parse(stored)
  assert.equal(typeof parsed.inviteTokenHash, 'string')
  assert.equal(parsed.inviteTokenHash.length, 64)
  assert.equal(parsed.hostUserId, 'host-private')
})

test('only the invited username can join and room remains one-to-one', async () => {
  const env = { KV: new MemoryKv(), AUTH: authBinding() }
  const created = await createRoom(env)

  const wrong = await handleTogetherControl(
    request(`/api/together/rooms/${created.room.room_id}/join`, {
      method: 'POST',
      token: 'stranger',
      body: { invite_token: created.invite_token },
    }),
    env,
    { id: 'stranger-private' },
  )
  assert.equal(wrong.status, 403)

  const joined = await handleTogetherControl(
    request(`/api/together/rooms/${created.room.room_id}/join`, {
      method: 'POST',
      token: 'guest',
      body: { invite_token: created.invite_token },
    }),
    env,
    { id: 'guest-private' },
  )
  assert.equal(joined.status, 200)
  const joinedBody = await joined.json()
  assert.equal(joinedBody.room.guest.connected, true)

  const second = await handleTogetherControl(
    request(`/api/together/rooms/${created.room.room_id}/join`, {
      method: 'POST',
      token: 'guest',
      body: { invite_token: created.invite_token },
    }),
    env,
    { id: 'another-private-id' },
  )
  assert.equal(second.status, 409)
})

test('signaling is short-lived recipient-specific setup data only', async () => {
  const env = { KV: new MemoryKv(), AUTH: authBinding() }
  const created = await createRoom(env)
  const roomId = created.room.room_id

  const joined = await handleTogetherControl(
    request(`/api/together/rooms/${roomId}/join`, {
      method: 'POST',
      token: 'guest',
      body: { invite_token: created.invite_token },
    }),
    env,
    { id: 'guest-private' },
  )
  assert.equal(joined.status, 200)

  const sent = await handleTogetherControl(
    request(`/api/together/rooms/${roomId}/signals`, {
      method: 'POST',
      token: 'host',
      body: { type: 'offer', payload: { sdp: 'test-offer' } },
    }),
    env,
    { id: 'host-private' },
  )
  assert.equal(sent.status, 202)

  const guestPoll = await handleTogetherControl(
    request(`/api/together/rooms/${roomId}/signals`, { token: 'guest' }),
    env,
    { id: 'guest-private' },
  )
  assert.equal(guestPoll.status, 200)
  const guestSignals = (await guestPoll.json()).signals
  assert.equal(guestSignals.length, 1)
  assert.equal(guestSignals[0].type, 'offer')
  assert.equal(guestSignals[0].payload.sdp, 'test-offer')

  const hostPoll = await handleTogetherControl(
    request(`/api/together/rooms/${roomId}/signals`, { token: 'host' }),
    env,
    { id: 'host-private' },
  )
  assert.equal(hostPoll.status, 200)
  assert.equal((await hostPoll.json()).signals.length, 0)

  const chatAttempt = await handleTogetherControl(
    request(`/api/together/rooms/${roomId}/signals`, {
      method: 'POST',
      token: 'host',
      body: { type: 'chat', payload: { text: 'must stay peer-to-peer' } },
    }),
    env,
    { id: 'host-private' },
  )
  assert.equal(chatAttempt.status, 400)
})

test('non-participants cannot inspect room metadata', async () => {
  const env = { KV: new MemoryKv(), AUTH: authBinding() }
  const created = await createRoom(env)

  const response = await handleTogetherControl(
    request(`/api/together/rooms/${created.room.room_id}`, { token: 'stranger' }),
    env,
    { id: 'stranger-private' },
  )
  assert.equal(response.status, 403)
})
