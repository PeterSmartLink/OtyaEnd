/**
 * OTYA Player API routes — runs as Next.js middleware inside OpenNext.
 * Handles: /version /latest /stats /download /apk/arm64 /apk/arm32
 * Everything else is passed through to Next.js pages.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
const KV_VERSION_KEY = 'version:current'
const KV_VERSION_TTL = 600
const APK_CACHE_TTL  = 86400
let dbInitialised = false

function detectAbi(request) {
  const url   = new URL(request.url)
  const param = url.searchParams.get('abi')
  if (param === 'arm64') return 'arm64'
  if (param === 'arm32') return 'arm32'
  const arch = (request.headers.get('Sec-CH-UA-Arch') || '').toLowerCase()
  if (arch.includes('arm64') || arch.includes('aarch64')) return 'arm64'
  if (arch.includes('arm'))                                return 'arm32'
  const ua = (request.headers.get('User-Agent') || '').toLowerCase()
  if (ua.includes('arm64') || ua.includes('aarch64') || ua.includes('armv8')) return 'arm64'
  if (ua.includes('armv7') || ua.includes('armeabi'))                          return 'arm32'
  return 'arm64'
}

async function getVersionInfo(env) {
  try {
    const cached = await env.KV.get(KV_VERSION_KEY, 'json')
    if (cached) return cached
  } catch (e) { console.error('[KV] cache read failed:', e?.message) }
  try {
    const obj = await env.R2.get('version.json')
    if (!obj) return null
    const info = await obj.json()
    env.KV.put(KV_VERSION_KEY, JSON.stringify(info), { expirationTtl: KV_VERSION_TTL })
      .catch(e => console.error('[KV] cache write failed:', e?.message))
    return info
  } catch (e) { console.error('[R2] version.json read failed:', e?.message); return null }
}

function resolveApkKey(info, abi) {
  if (!info) return null
  return abi === 'arm64' ? (info.arm64 || 'OtyaPlayer-arm64.apk') : (info.arm32 || 'OtyaPlayer-arm32.apk')
}

function brandedApkFilename(version, abi) {
  const safeVersion = String(version || 'latest').replace(/[^0-9A-Za-z._-]/g, '-')
  const safeAbi = abi === 'arm32' ? 'arm32' : 'arm64'
  return `OTYA-Player-v${safeVersion}-${safeAbi}.apk`
}

async function serveApk(env, key, version, abi) {
  let obj
  try { obj = await env.R2.get(key) } catch (e) {
    return new Response(JSON.stringify({ error: 'Storage error.' }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
  if (!obj) return new Response(JSON.stringify({ error: 'APK not found.', key }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } })
  const headers = new Headers(CORS)
  obj.writeHttpMetadata(headers)
  headers.set('Content-Type',        'application/vnd.android.package-archive')
  headers.set('Content-Disposition', `attachment; filename="${brandedApkFilename(version, abi)}"`)
  headers.set('Cache-Control',       `public, max-age=${APK_CACHE_TTL}, immutable`)
  headers.set('ETag',                obj.httpEtag)
  if (obj.size)  headers.set('Content-Length', String(obj.size))
  if (version)   headers.set('X-OTYA-Version', version)
  headers.set('X-OTYA-ABI', abi)
  return new Response(obj.body, { headers })
}

async function initDb(env) {
  if (dbInitialised) return
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      abi TEXT NOT NULL, version TEXT, country TEXT, ip TEXT, user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS version_history (
      tag TEXT PRIMARY KEY, version TEXT, released_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS devices (
      device_id       TEXT PRIMARY KEY,
      user_id         TEXT,
      fcm_token       TEXT,
      app_version     TEXT,
      version_code    INTEGER,
      abi             TEXT,
      platform        TEXT DEFAULT 'android',
      model           TEXT,
      android_version TEXT,
      locale          TEXT,
      registered_at   TEXT DEFAULT (datetime('now')),
      last_seen_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at);
    CREATE INDEX IF NOT EXISTS idx_downloads_abi ON downloads(abi);
    CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
  `)
  dbInitialised = true
}

function trackDownload(env, ctx, request, abi, version) {
  ctx.waitUntil((async () => {
    try {
      const ip      = request.headers.get('CF-Connecting-IP') || 'unknown'
      const country = request.headers.get('CF-IPCountry')     || 'unknown'
      const ua      = (request.headers.get('User-Agent') || '').substring(0, 250)
      await env.DB.prepare(`INSERT INTO downloads (abi, version, country, ip, user_agent) VALUES (?, ?, ?, ?, ?)`)
        .bind(abi, version || 'unknown', country, ip, ua).run()
    } catch (e) { console.error('[D1] trackDownload failed:', e?.message) }
  })())
}

async function checkRateLimit(env, request) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
    const { success } = await env.RATE_LIMITER.limit({ key: ip })
    return success
  } catch (e) { console.error('[RATE_LIMITER] error:', e?.message); return true }
}

async function sendErrorAlert(env, subject, body) {
  const to = env.ALERT_EMAIL_TO || 'petersmartlink@gmail.com'

  // The production entrypoint supplies EMAIL as a Resend adapter. Keeping one
  // delivery path prevents a failed provider request from becoming a duplicate
  // alert and keeps this legacy worker free of a second outbound-mail client.
  try {
    if (!env.EMAIL?.send) throw new Error('Resend email adapter unavailable')
    await env.EMAIL.send({
      from: { email: 'noreply@petersmartlink.com', name: 'Otya' },
      to: [{ email: to }],
      subject,
      text: body,
    })
  } catch (error) {
    console.error('[email] Otya alert delivery failed:', error?.message)
  }
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const body = JSON.stringify(data)
  const etag = `"${simpleHash(body)}"`
  return new Response(body, { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'ETag': etag, ...CORS, ...extraHeaders } })
}

function simpleHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(16)
}

const API_ROUTES = new Set(['/version', '/latest', '/stats', '/download', '/apk/arm64', '/apk/arm32', '/check-update'])

export default {
  async fetch(request, env, ctx) {
    const url  = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
    if (ip !== 'unknown') {
      try {
        const blocked = await env.KV.get(`blocked:${ip}`)
        if (blocked !== null) {
          return new Response(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } },
          )
        }
      } catch (e) {
        console.error('[KV] IP block check failed:', e?.message)
      }
    }

    if (!API_ROUTES.has(path)) return env.ASSETS.fetch(request)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (request.method !== 'GET')
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } })

    try { await initDb(env) } catch (e) { console.error('[D1] initDb failed:', e?.message) }

    if (path === '/version' || path === '/check-update') {
      const info = await getVersionInfo(env)
      if (!info) return new Response(JSON.stringify({ error: 'Version info not available.' }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS } })
      const res = jsonResponse(info)
      if (request.headers.get('If-None-Match') === res.headers.get('ETag')) return new Response(null, { status: 304, headers: CORS })
      return res
    }

    if (path === '/latest') {
      const info = await getVersionInfo(env)
      const res = jsonResponse({
        version: info?.version ?? null, versionCode: info?.versionCode ?? null,
        tag: info?.tag ?? null, date: info?.date ?? null, changelog: info?.changelog ?? null,
        minSdk: info?.minSdk ?? 21, targetSdk: info?.targetSdk ?? 36,
        downloads: { auto: `https://${url.hostname}/download`, arm64: `https://${url.hostname}/apk/arm64`, arm32: `https://${url.hostname}/apk/arm32` },
      })
      if (request.headers.get('If-None-Match') === res.headers.get('ETag')) return new Response(null, { status: 304, headers: CORS })
      return res
    }

    if (path === '/stats') {
      const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '')
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS } })
      try {
        const [total, byAbi, byVersion, byCountry, recent] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) as count FROM downloads').first(),
          env.DB.prepare('SELECT abi, COUNT(*) as count FROM downloads GROUP BY abi ORDER BY count DESC').all(),
          env.DB.prepare('SELECT version, COUNT(*) as count FROM downloads GROUP BY version ORDER BY count DESC LIMIT 10').all(),
          env.DB.prepare('SELECT country, COUNT(*) as count FROM downloads GROUP BY country ORDER BY count DESC LIMIT 20').all(),
          env.DB.prepare('SELECT abi, version, country, created_at FROM downloads ORDER BY id DESC LIMIT 20').all(),
        ])
        return jsonResponse({ total: total?.count ?? 0, by_abi: byAbi.results, by_version: byVersion.results, by_country: byCountry.results, recent: recent.results }, 200, { 'Cache-Control': 'no-store' })
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Stats unavailable', detail: e?.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
      }
    }

    if (path === '/download' || path === '/apk/arm64' || path === '/apk/arm32') {
      if (!await checkRateLimit(env, request))
        return new Response(JSON.stringify({ error: 'Too many requests. Please wait 60 seconds.' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...CORS } })

      if (path === '/download') {
        return new Response(null, { status: 307, headers: { Location: `https://${url.hostname}/apk/${detectAbi(request)}`, 'Cache-Control': 'no-store', ...CORS } })
      }

      const abi  = path === '/apk/arm64' ? 'arm64' : 'arm32'
      const info = await getVersionInfo(env)
      if (!info) {
        ctx.waitUntil(sendErrorAlert(env, 'OTYA Backend: version.json missing', `${abi} download attempted but version.json missing. Time: ${new Date().toISOString()}`))
        return new Response(JSON.stringify({ error: 'APK not available yet.' }), { status: 503, headers: { 'Content-Type': 'application/json', ...CORS } })
      }
      const key = resolveApkKey(info, abi)
      if (!key) return new Response(JSON.stringify({ error: 'Could not resolve APK path.' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } })
      trackDownload(env, ctx, request, abi, info.version)
      return serveApk(env, key, info.version, abi)
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } })
  }
}
