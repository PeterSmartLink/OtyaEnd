const TELEGRAM_API = 'https://api.telegram.org'
const MINI_APP_URL = 'https://space.petersmartlink.com/telegram/'
const CHANNEL = '@otyaplayer'
const CHANNEL_USERNAME = 'otyaplayer'
const BOT_USERNAME = 'OtyaPlayerBot'
const DISCUSSION_CHAT_KEY = 'telegram:discussion:chat_id'
const UPDATE_TTL = 24 * 60 * 60
const MAX_TEXT = 3900

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

function clean(value, max = 4096) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
}

async function secretValue(binding, name) {
  if (!binding || typeof binding.get !== 'function') throw new Error(`${name} is unavailable`)
  const value = await binding.get()
  if (!value) throw new Error(`${name} is unavailable`)
  return value
}

function constantTimeEqual(a, b) {
  const left = new TextEncoder().encode(String(a ?? ''))
  const right = new TextEncoder().encode(String(b ?? ''))
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

async function telegramApi(method, body, env) {
  const token = await secretValue(env.TELEGRAM_BOT_TOKEN, 'Telegram bot credential')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.ok !== true) throw new Error(`Telegram ${method} failed`)
    return data.result
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendTelegramMessage(chatId, text, env, options = {}) {
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text: String(text ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 4096),
    link_preview_options: { is_disabled: true },
    ...options,
  }, env)
}

export async function sendTelegramReleaseCard(chatId, caption, env) {
  return telegramApi('sendPhoto', {
    chat_id: chatId,
    photo: 'https://petersmartlink.com/otya-release-card.jpg',
    caption,
    reply_markup: { inline_keyboard: [
      [{ text: 'Download Otya', url: 'https://petersmartlink.com/download/otya-player' }],
      [{ text: 'Help & feedback', url: 'https://t.me/OtyaPlayerBot' }],
    ] },
  }, env)
}

export async function setTelegramWebhook(env) {
  const secret = await secretValue(env.TELEGRAM_WEBHOOK_SECRET, 'Telegram webhook secret')
  return telegramApi('setWebhook', {
    url: 'https://petersmartlink.com/api/telegram/webhook',
    secret_token: secret,
    allowed_updates: ['message', 'edited_message', 'channel_post', 'callback_query'],
  }, env)
}

export async function getTelegramWebhookInfo(env) {
  return telegramApi('getWebhookInfo', {}, env)
}

export async function sendOtyaChannelAnnouncement(text, env) {
  return sendTelegramMessage(CHANNEL, text, env)
}

function cleanMessage(value, max = 16000) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max)
}

function splitTelegramText(text) {
  const source = cleanMessage(text)
  if (source.length <= MAX_TEXT) return [source]
  const chunks = []
  let rest = source
  while (rest.length > MAX_TEXT) {
    let cut = rest.lastIndexOf('\n', MAX_TEXT)
    if (cut < MAX_TEXT * 0.6) cut = rest.lastIndexOf(' ', MAX_TEXT)
    if (cut < MAX_TEXT * 0.6) cut = MAX_TEXT
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

async function askNext(text, env, { senderId = '', surface = 'telegram_private' } = {}) {
  if (!env.AI_SUPPORT?.fetch) throw new Error('Next service unavailable')
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-OTYA-Channel': 'telegram',
  })
  if (env.INTERNAL_SECRET) headers.set('X-OTYA-Internal-Secret', env.INTERNAL_SECRET)
  const identity = clean(senderId, 120)
  const body = {
    message: clean(text, 3000),
    channel: 'telegram',
    surface,
  }
  if (identity) body.guest_id = `telegram:${identity}`
  const response = await env.AI_SUPPORT.fetch(new Request('https://internal/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  }))
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error('Next request failed')
  const answer = cleanMessage(data?.answer ?? data?.response ?? data?.message)
  if (!answer) throw new Error('Next returned an empty response')
  return answer
}

function commandReply(text) {
  if (text === '/start' || text.startsWith('/start ')) return {
    text: 'Welcome to Next by Otya. Ask a question or open Otya Space.',
    reply_markup: { inline_keyboard: [[{ text: 'Open Otya', web_app: { url: MINI_APP_URL } }]] },
  }
  if (text === '/help') return {
    text: 'Ask Next anything, use /account for your Otya Account, /updates for release status, or /privacy for privacy information. Music playback and library search are local to the Android app.',
  }
  if (text === '/account') return { text: `Open your Otya Account: ${MINI_APP_URL}` }
  if (text === '/privacy') return { text: 'Otya Privacy: https://petersmartlink.com/privacy' }
  if (text === '/music' || text.startsWith('/music ')) return {
    text: 'Otya Music is local-first. Open the Android app to search and play music already on your device; the built-in Online Music catalog has been retired.',
  }
  return null
}

async function dynamicCommandReply(text) {
  if (text === '/updates') {
    const response = await fetch('https://petersmartlink.com/api/bootstrap', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    if (!response.ok) return 'Otya update information is temporarily unavailable.'
    const data = await response.json().catch(() => ({}))
    const release = data?.release ?? data?.latest ?? data
    if (release?.published === false) return 'There is no public Otya release yet.'
    const version = clean(release?.version ?? release?.versionName, 80)
    return version ? `Current public Otya release: ${version}.` : 'Otya update information is available in the Mini App.'
  }
  return null
}

async function isDuplicate(updateId, env) {
  if (!env.KV || !Number.isSafeInteger(updateId)) return false
  const key = `telegram:update:${updateId}`
  const seen = await env.KV.get(key)
  if (seen) return true
  await env.KV.put(key, '1', { expirationTtl: UPDATE_TTL })
  return false
}

async function processPrivateMessage(message, env) {
  if (!message || message?.from?.is_bot === true || message?.chat?.type !== 'private') return
  const chatId = message?.chat?.id
  const senderId = message?.from?.id ?? chatId
  const text = clean(message?.text, 3000)
  if (!chatId || !text) return
  let reply = commandReply(text)
  if (!reply) {
    const dynamic = await dynamicCommandReply(text)
    if (dynamic) reply = { text: dynamic }
  }
  if (!reply) {
    try { reply = { text: await askNext(text, env, { senderId, surface: 'telegram_private' }) } }
    catch { reply = { text: 'Next is temporarily unavailable. Please try again shortly.' } }
  }
  const chunks = splitTelegramText(reply.text)
  for (let i = 0; i < chunks.length; i++) {
    await sendTelegramMessage(
      chatId,
      chunks[i],
      env,
      i === 0 && reply.reply_markup ? { reply_markup: reply.reply_markup } : {},
    )
  }
}

function normalizedUsername(value) {
  return clean(value, 80).replace(/^@/, '').toLowerCase()
}

function isOfficialChannelForward(message) {
  if (!message || message?.is_automatic_forward !== true) return false
  const originChat = message?.forward_origin?.chat ?? message?.sender_chat
  return originChat?.type === 'channel'
    && normalizedUsername(originChat?.username) === CHANNEL_USERNAME
}

function isReplyToNext(message) {
  const from = message?.reply_to_message?.from
  return from?.is_bot === true && normalizedUsername(from?.username) === BOT_USERNAME.toLowerCase()
}

function mentionsNext(text) {
  return clean(text, 3000).toLowerCase().includes(`@${BOT_USERNAME.toLowerCase()}`)
}

function stripNextMention(text) {
  return clean(text, 3000).replace(new RegExp(`@${BOT_USERNAME}\\b`, 'ig'), '').trim()
}

async function rememberDiscussionChat(chatId, env) {
  if (!env.KV || chatId === undefined || chatId === null) return
  await env.KV.put(DISCUSSION_CHAT_KEY, String(chatId))
}

async function isKnownDiscussionChat(chatId, env) {
  if (!env.KV || chatId === undefined || chatId === null) return false
  const stored = await env.KV.get(DISCUSSION_CHAT_KEY)
  return Boolean(stored) && stored === String(chatId)
}

async function processDiscussionMessage(message, env) {
  if (!message || message?.from?.is_bot === true) return
  if (!['group', 'supergroup'].includes(message?.chat?.type)) return
  const chatId = message?.chat?.id
  const senderId = message?.from?.id
  const rawText = clean(message?.text, 3000)
  if (!chatId || !rawText) return

  const directChannelComment = isOfficialChannelForward(message?.reply_to_message)
  if (directChannelComment) await rememberDiscussionChat(chatId, env)

  const knownDiscussion = directChannelComment || await isKnownDiscussionChat(chatId, env)
  if (!knownDiscussion) return

  const addressedToNext = directChannelComment || isReplyToNext(message) || mentionsNext(rawText)
  if (!addressedToNext) return

  const prompt = stripNextMention(rawText)
  const replyText = prompt
    ? await askNext(prompt, env, { senderId, surface: 'telegram_discussion' }).catch(() => 'Next is temporarily unavailable. Please try again shortly.')
    : 'How can I help with Otya?'
  const chunks = splitTelegramText(replyText)
  for (let i = 0; i < chunks.length; i++) {
    const options = {
      reply_parameters: {
        message_id: message.message_id,
        allow_sending_without_reply: true,
      },
    }
    if (message?.message_thread_id) options.message_thread_id = message.message_thread_id
    await sendTelegramMessage(chatId, chunks[i], env, options)
  }
}

export async function handleTelegramWebhook(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let expected
  try { expected = await secretValue(env.TELEGRAM_WEBHOOK_SECRET, 'Telegram webhook secret') }
  catch { return json({ error: 'Telegram webhook is not configured' }, 503) }
  const provided = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || ''
  if (!constantTimeEqual(provided, expected)) return json({ error: 'Unauthorized' }, 401)
  const update = await request.json().catch(() => null)
  if (!update || !Number.isSafeInteger(update.update_id)) return json({ ok: true })
  if (await isDuplicate(update.update_id, env)) return json({ ok: true, duplicate: true })
  const work = async () => {
    try {
      if (update.callback_query?.id) {
        await telegramApi('answerCallbackQuery', { callback_query_id: update.callback_query.id }, env).catch(() => undefined)
      }
      const message = update.message ?? update.edited_message
      await processPrivateMessage(message, env)
      await processDiscussionMessage(message, env)
    } catch (error) {
      console.error('[telegram] update processing failed:', error instanceof Error ? error.message : 'unknown error')
    }
  }
  if (ctx?.waitUntil) ctx.waitUntil(work())
  else await work()
  return json({ ok: true })
}

export async function handleTelegramAdmin(request, env, action) {
  if (action === 'test') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const body = await request.json().catch(() => ({}))
    if (body?.destination !== 'channel') return json({ error: 'Unsupported destination' }, 400)
    const text = clean(body?.text, 3000)
    if (!text) return json({ error: 'text is required' }, 400)
    const result = await sendOtyaChannelAnnouncement(text, env)
    return json({ ok: true, message_id: result?.message_id ?? null })
  }
  if (action === 'webhook') {
    if (request.method === 'POST') {
      const result = await setTelegramWebhook(env)
      return json({ ok: true, webhook_registered: Boolean(result) })
    }
    if (request.method === 'GET') {
      const info = await getTelegramWebhookInfo(env)
      return json({
        ok: true,
        url: info?.url ?? '',
        pending_update_count: Number(info?.pending_update_count ?? 0),
        last_error_date: info?.last_error_date ?? null,
      })
    }
    return json({ error: 'Method not allowed' }, 405)
  }
  return json({ error: 'Not found' }, 404)
}
