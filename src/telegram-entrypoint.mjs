import worker from './entrypoint.mjs'
import {
  getTelegramWebhookInfo,
  handleTelegramAdmin,
  handleTelegramWebhook,
  setTelegramWebhook,
} from './lib/telegram-bot.mjs'
export { OtyaReleaseWorkflow } from './entrypoint.mjs'

const ACCESS_COOKIE = '__Secure-otya_access'
const ADMIN_COOKIE = 'otya_admin_session'
const APP_ORIGIN = 'https://petersmartlink.com'
const TELEGRAM_WEBHOOK_URL = 'https://petersmartlink.com/api/telegram/webhook'
const TELEGRAM_WEBHOOK_FINGERPRINT_KEY = 'telegram:webhook:fingerprint:v1'
const TELEGRAM_HEALTH_CRON = '*/5 * * * *'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
function cookieValue(request, name) {
  const cookie = request.headers.get('cookie') || ''
  return cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || ''
}
function equal(a, b) {
  const left = String(a ?? '')
  const right = String(b ?? '')
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}
function decodeB64url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
  let binary = ''
  for (const byte of mac) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
async function bindingValue(binding) {
  if (typeof binding === 'string') return binding
  if (binding && typeof binding.get === 'function') return String(await binding.get() || '')
  return ''
}
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
async function webhookFingerprint(env) {
  const secret = await bindingValue(env.TELEGRAM_WEBHOOK_SECRET)
  if (!secret) throw new Error('Telegram webhook secret is unavailable')
  return sha256(`${TELEGRAM_WEBHOOK_URL}\n${secret}`)
}
async function ensureTelegramWebhook(env, { force = false } = {}) {
  const info = await getTelegramWebhookInfo(env)
  const fingerprint = await webhookFingerprint(env)
  const recorded = env.KV?.get ? await env.KV.get(TELEGRAM_WEBHOOK_FINGERPRINT_KEY) : null
  const urlMatches = String(info?.url || '') === TELEGRAM_WEBHOOK_URL
  const fingerprintMatches = !env.KV?.get || recorded === fingerprint
  if (!force && urlMatches && fingerprintMatches) return { changed: false, info }

  await setTelegramWebhook(env)
  if (env.KV?.put) await env.KV.put(TELEGRAM_WEBHOOK_FINGERPRINT_KEY, fingerprint)
  const updated = await getTelegramWebhookInfo(env)
  return { changed: true, info: updated }
}
async function adminUser(request, env) {
  const token = cookieValue(request, ACCESS_COOKIE)
  if (!token || !env.AUTH?.fetch) return null
  const response = await env.AUTH.fetch(new Request('https://auth/auth/verify', { headers: { Authorization: `Bearer ${token}` } }))
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.ok !== true || !data?.email) return null
  const email = String(data.email).toLowerCase()
  const admins = new Set(String(env.ADMIN_EMAILS || env.ADMIN_REPORT_EMAIL || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean))
  return admins.has(email) ? { email, id: String(data.user_id || '') } : null
}
async function elevated(request, env) {
  const secret = String(env.ADMIN_SESSION_SECRET || '').trim()
  const raw = cookieValue(request, ADMIN_COOKIE)
  if (!secret || !raw) return false
  const [encoded, signature] = raw.split('.')
  if (!encoded || !signature || !equal(signature, await sign(encoded, secret))) return false
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeB64url(encoded)))
    return payload?.mfa === true && Number(payload?.exp || 0) > Math.floor(Date.now() / 1000)
  } catch { return false }
}
function internalAuthorized(request, env) {
  const secret = String(env.INTERNAL_SECRET || '')
  const provided = request.headers.get('X-OTYA-Internal-Secret') || ''
  return Boolean(secret)
    && equal(provided, secret)
    && request.headers.get('X-OTYA-Admin-Action') === 'telegram'
}
async function authorizeAdmin(request, env) {
  const origin = request.headers.get('Origin')
  if (request.method !== 'GET' && origin && origin !== APP_ORIGIN) return json({ error: 'Invalid origin' }, 403)
  const user = await adminUser(request, env)
  if (!user) return json({ error: 'Administrator access required' }, 403)
  if (!await elevated(request, env)) return json({ error: 'Elevated administrator verification required' }, 403)
  if (request.method !== 'GET' && request.headers.get('X-OTYA-Admin-Action') !== 'telegram') return json({ error: 'Admin action confirmation required' }, 403)
  return null
}
async function telegramStatus(env) {
  try {
    const info = await getTelegramWebhookInfo(env)
    return json({
      ok: true,
      bot: '@OtyaPlayerBot',
      channel: '@otyaplayer',
      webhook_configured: String(info?.url || '') === TELEGRAM_WEBHOOK_URL,
      ai_service_bound: Boolean(env.AI_SUPPORT?.fetch),
      pending_update_count: Number(info?.pending_update_count ?? 0),
      last_error_date: info?.last_error_date ?? null,
    })
  } catch {
    return json({
      ok: false,
      bot: '@OtyaPlayerBot',
      channel: '@otyaplayer',
      webhook_configured: false,
      ai_service_bound: Boolean(env.AI_SUPPORT?.fetch),
    }, 503)
  }
}

export default {
  ...worker,
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/api/telegram/webhook') return handleTelegramWebhook(request, env, ctx)
    if (url.pathname === '/api/telegram/status' && request.method === 'GET') return telegramStatus(env)
    if (url.pathname.startsWith('/api/telegram/')) return json({ error: 'Not found' }, 404)
    if (url.pathname === '/api/admin/telegram/test' || url.pathname === '/api/admin/telegram/webhook') {
      if (!internalAuthorized(request, env)) {
        const denied = await authorizeAdmin(request, env)
        if (denied) return denied
      }
      const action = url.pathname.endsWith('/test') ? 'test' : 'webhook'
      try {
        if (action === 'webhook' && request.method === 'POST') {
          const result = await ensureTelegramWebhook(env, { force: true })
          return json({ ok: true, webhook_registered: Boolean(result?.info?.url === TELEGRAM_WEBHOOK_URL) })
        }
        return await handleTelegramAdmin(request, env, action)
      } catch (error) {
        console.error('[telegram-admin]', error instanceof Error ? error.message : 'unknown error')
        return json({ error: 'Telegram admin action failed', code: 'TELEGRAM_ADMIN_FAILED' }, 502)
      }
    }
    return worker.fetch(request, env, ctx)
  },
  async scheduled(event, env, ctx) {
    if (event.cron === TELEGRAM_HEALTH_CRON) {
      const healing = ensureTelegramWebhook(env).catch(error => {
        console.error('[telegram] webhook self-heal failed:', error instanceof Error ? error.message : 'unknown error')
      })
      if (ctx?.waitUntil) ctx.waitUntil(healing)
      else await healing
    }
    return worker.scheduled(event, env, ctx)
  },
}
