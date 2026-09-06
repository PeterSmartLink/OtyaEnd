const ROOM_PREFIX = 'together:room:'
const SIGNAL_PREFIX = 'together:signal:'
const ROOM_TTL_SECONDS = 8 * 60 * 60
const SIGNAL_TTL_SECONDS = 5 * 60
const MAX_SIGNAL_BYTES = 24 * 1024
const ALLOWED_SIGNAL_TYPES = new Set(['offer', 'answer', 'ice', 'bye'])

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function randomToken(bytes = 18) {
  const data = crypto.getRandomValues(new Uint8Array(bytes))
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function authHeader(request) {
  const value = request.headers.get('Authorization') || ''
  return value.startsWith('Bearer ') ? value : ''
}

async function currentPublicIdentity(request, env) {
  if (!env.AUTH?.fetch) return null
  const authorization = authHeader(request)
  if (!authorization) return null

  try {
    const response = await env.AUTH.fetch(new Request('https://otya-auth/auth/account', {
      method: 'GET',
      headers: { Authorization: authorization },
    }))
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok !== true || !data?.user) return null
    const user = data.user
    const username = typeof user.username === 'string' ? user.username.trim().toLowerCase() : ''
    const otyaId = typeof user.otya_id === 'string' ? user.otya_id.trim().toUpperCase() : ''
    if (!username || !otyaId) return null
    return {
      otyaId,
      username,
      name: typeof user.name === 'string' ? user.name.trim().slice(0, 120) : '',
      avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : '',
    }
  } catch {
    return null
  }
}

async function lookupUsername(request, env, value) {
  if (!env.AUTH?.fetch) return null
  const authorization = authHeader(request)
  if (!authorization) return null
  const username = String(value || '').trim().replace(/^@+/, '').toLowerCase()
  if (!username) return null

  try {
    const url = new URL('https://otya-auth/auth/account')
    url.searchParams.set('lookup_username', username)
    const response = await env.AUTH.fetch(new Request(url, {
      method: 'GET',
      headers: { Authorization: authorization },
    }))
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok !== true || !data?.user) return null
    const user = data.user
    return {
      otyaId: String(user.otya_id || '').trim().toUpperCase(),
      username: String(user.username || '').trim().toLowerCase(),
      name: typeof user.name === 'string' ? user.name.trim().slice(0, 120) : '',
      avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : '',
    }
  } catch {
    return null
  }
}

function publicParticipant(identity, role, connected) {
  return {
    role,
    connected,
    otya_id: identity.otyaId,
    username: identity.username,
    name: identity.name || null,
    avatar_url: identity.avatarUrl || null,
  }
}

function publicRoom(room) {
  return {
    room_id: room.id,
    status: room.status,
    created_at: room.createdAt,
    expires_at: room.expiresAt,
    host: publicParticipant(room.host, 'host', true),
    guest: publicParticipant(room.guest, 'guest', Boolean(room.guestUserId)),
  }
}

async function readRoom(env, roomId) {
  const raw = await env.KV?.get?.(`${ROOM_PREFIX}${roomId}`)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function writeRoom(env, room) {
  await env.KV.put(`${ROOM_PREFIX}${room.id}`, JSON.stringify(room), {
    expirationTtl: ROOM_TTL_SECONDS,
  })
}

function roleFor(room, userId) {
  if (room.hostUserId === userId) return 'host'
  if (room.guestUserId === userId) return 'guest'
  return null
}

async function createRoom(request, env, user) {
  if (!env.KV?.put) return json({ error: 'Together rooms are unavailable.' }, 503)

  const body = await request.json().catch(() => null)
  const inviteUsername = String(body?.invite_username || '').trim().replace(/^@+/, '').toLowerCase()
  if (!inviteUsername) return json({ error: 'invite_username is required' }, 400)

  const host = await currentPublicIdentity(request, env)
  if (!host) {
    return json({
      error: 'Choose an Otya username before starting Anywhere Together.',
      code: 'USERNAME_REQUIRED',
    }, 409)
  }
  if (host.username === inviteUsername) {
    return json({ error: 'Invite another Otya user.', code: 'CANNOT_INVITE_SELF' }, 400)
  }

  const guest = await lookupUsername(request, env, inviteUsername)
  if (!guest?.username || !guest?.otyaId) {
    return json({ error: 'Otya user not found.', code: 'USERNAME_NOT_FOUND' }, 404)
  }

  const roomId = randomToken(16)
  const inviteToken = randomToken(24)
  const now = Date.now()
  const room = {
    id: roomId,
    status: 'waiting',
    hostUserId: user.id,
    guestUserId: null,
    host,
    guest,
    inviteTokenHash: await sha256(inviteToken),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ROOM_TTL_SECONDS * 1000).toISOString(),
  }

  await writeRoom(env, room)
  return json({
    ok: true,
    room: publicRoom(room),
    invite_token: inviteToken,
  }, 201)
}

async function joinRoom(request, env, user, roomId) {
  const room = await readRoom(env, roomId)
  if (!room || room.status === 'closed') {
    return json({ error: 'Together room not found or expired.', code: 'ROOM_NOT_FOUND' }, 404)
  }

  const identity = await currentPublicIdentity(request, env)
  if (!identity || identity.username !== room.guest.username) {
    return json({ error: 'This Together invite belongs to another Otya account.', code: 'NOT_INVITED' }, 403)
  }

  const body = await request.json().catch(() => null)
  const inviteToken = typeof body?.invite_token === 'string' ? body.invite_token : ''
  if (!inviteToken || await sha256(inviteToken) !== room.inviteTokenHash) {
    return json({ error: 'Invalid or expired Together invite.', code: 'INVALID_INVITE' }, 403)
  }

  if (room.guestUserId && room.guestUserId !== user.id) {
    return json({ error: 'This Together room already has its guest.', code: 'ROOM_FULL' }, 409)
  }

  room.guestUserId = user.id
  room.status = 'connected'
  room.guest = identity
  await writeRoom(env, room)
  return json({ ok: true, room: publicRoom(room) })
}

async function getRoom(env, user, roomId) {
  const room = await readRoom(env, roomId)
  if (!room || room.status === 'closed') {
    return json({ error: 'Together room not found or expired.', code: 'ROOM_NOT_FOUND' }, 404)
  }
  if (!roleFor(room, user.id)) return json({ error: 'Not a participant in this room.' }, 403)
  return json({ ok: true, room: publicRoom(room) })
}

async function closeRoom(env, user, roomId) {
  const room = await readRoom(env, roomId)
  if (!room) return json({ ok: true })
  const role = roleFor(room, user.id)
  if (!role) return json({ error: 'Not a participant in this room.' }, 403)

  // The host ends the room for everyone. A guest leaving marks the room closed
  // in v1 because the first release is intentionally private one-to-one.
  room.status = 'closed'
  await writeRoom(env, room)
  return json({ ok: true })
}

function signalRecipient(room, senderRole) {
  if (senderRole === 'host') {
    return room.guestUserId ? { role: 'guest', userId: room.guestUserId } : null
  }
  return { role: 'host', userId: room.hostUserId }
}

async function postSignal(request, env, user, roomId) {
  const room = await readRoom(env, roomId)
  if (!room || room.status === 'closed') {
    return json({ error: 'Together room not found or expired.', code: 'ROOM_NOT_FOUND' }, 404)
  }

  const senderRole = roleFor(room, user.id)
  if (!senderRole) return json({ error: 'Not a participant in this room.' }, 403)
  const recipient = signalRecipient(room, senderRole)
  if (!recipient) return json({ error: 'The invited guest has not joined yet.', code: 'GUEST_NOT_JOINED' }, 409)

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_SIGNAL_BYTES) {
    return json({ error: 'Signaling message is too large.' }, 413)
  }

  let body
  try { body = JSON.parse(text) } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const type = String(body?.type || '').toLowerCase()
  if (!ALLOWED_SIGNAL_TYPES.has(type)) return json({ error: 'Unsupported signaling type.' }, 400)

  const signalId = `${Date.now().toString().padStart(13, '0')}-${randomToken(8)}`
  const key = `${SIGNAL_PREFIX}${room.id}:${recipient.userId}:${signalId}`
  const signal = {
    id: signalId,
    room_id: room.id,
    type,
    payload: body?.payload ?? null,
    sender_role: senderRole,
    created_at: new Date().toISOString(),
  }
  await env.KV.put(key, JSON.stringify(signal), { expirationTtl: SIGNAL_TTL_SECONDS })
  return json({ ok: true, signal_id: signalId }, 202)
}

async function getSignals(url, env, user, roomId) {
  const room = await readRoom(env, roomId)
  if (!room || room.status === 'closed') {
    return json({ error: 'Together room not found or expired.', code: 'ROOM_NOT_FOUND' }, 404)
  }
  if (!roleFor(room, user.id)) return json({ error: 'Not a participant in this room.' }, 403)

  const after = String(url.searchParams.get('after') || '')
  const prefix = `${SIGNAL_PREFIX}${room.id}:${user.id}:`
  const listed = await env.KV.list({ prefix, limit: 100 })
  const signals = []

  for (const item of listed.keys || []) {
    const signalId = item.name.slice(prefix.length)
    if (after && signalId <= after) continue
    const raw = await env.KV.get(item.name)
    if (!raw) continue
    try { signals.push(JSON.parse(raw)) } catch {}
  }

  signals.sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return json({ ok: true, signals })
}

/// Handles only authenticated remote/Anywhere Together control traffic.
/// Nearby Together is device-to-device and never calls this handler.
export async function handleTogetherControl(request, env, user) {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/together/')) return null
  if (!user) return json({ error: 'Sign in required' }, 401)
  if (!env.KV) return json({ error: 'Together control plane unavailable' }, 503)

  if (url.pathname === '/api/together/rooms' && request.method === 'POST') {
    return createRoom(request, env, user)
  }

  const parts = url.pathname.split('/').filter(Boolean)
  // /api/together/rooms/:roomId[/join|signals]
  if (parts.length < 4 || parts[0] !== 'api' || parts[1] !== 'together' || parts[2] !== 'rooms') {
    return json({ error: 'Not found' }, 404)
  }
  const roomId = parts[3]
  const action = parts[4] || ''

  if (!action && request.method === 'GET') return getRoom(env, user, roomId)
  if (!action && request.method === 'DELETE') return closeRoom(env, user, roomId)
  if (action === 'join' && request.method === 'POST') return joinRoom(request, env, user, roomId)
  if (action === 'signals' && request.method === 'POST') return postSignal(request, env, user, roomId)
  if (action === 'signals' && request.method === 'GET') return getSignals(url, env, user, roomId)

  return json({ error: 'Method not allowed' }, 405)
}
