import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Admin browser session stays cookie-based and URL-safe', () => {
  const source = read('src/lib/admin_auth.ts')
  assert.match(source, /HttpOnly/)
  assert.match(source, /Secure/)
  assert.match(source, /SameSite=Strict/)
  assert.match(source, /Max-Age=/)
  assert.doesNotMatch(source, /searchParams\.get\([^)]*token/i)
  assert.doesNotMatch(source, /queryParameters[^\n]*token/i)
})

test('Interactive admin APIs require the elevated MFA session', () => {
  const routes = [
    'src/app/api/admin/stats/route.ts',
    'src/app/api/admin/themes/route.ts',
    'src/app/api/admin/crashes/route.ts',
    'src/app/api/admin/feedback/route.ts',
    'src/app/api/admin/release/route.ts',
    'src/app/api/admin/app-config/route.ts',
    'src/app/api/push/route.ts',
    'src/app/api/notifications/reengage/route.ts',
    'src/app/api/blog/route.ts',
  ]
  for (const path of routes) {
    const source = read(path)
    assert.match(source, /verifyAdminSession/, `${path} must verify the elevated admin session`)
    assert.doesNotMatch(source, /isAdminAuthorized/, `${path} must not use legacy compatibility auth`)
    assert.doesNotMatch(source, /ADMIN_TOKEN/, `${path} must not accept ADMIN_TOKEN directly`)
  }
})

test('Worker-level admin AI and release workflow require elevated admin verification', () => {
  const source = read('src/entrypoint.mjs')
  assert.match(source, /hasElevatedAdminSession/)
  assert.match(source, /Elevated administrator verification required/)
  assert.match(source, /ACCESS_COOKIE = '__Secure-otya_access'/)
  assert.doesNotMatch(source, /ACCESS_COOKIE = '__Host-otya_access'/)
  assert.match(source, /ADMIN_COOKIE = 'otya_admin_session'/)
  assert.match(source, /authorizeReleaseWorkflow/)
})

test('Admin MFA OTPs are format-checked, single-use, and hashed at rest', () => {
  const source = read('auth-worker/src/admin-mfa.ts')
  assert.match(source, /\^\[A-Z\]\[0-9\]\{4\}\$/)
  assert.match(source, /crypto\.subtle\.digest\('SHA-256'/)
  assert.match(source, /otpDigest\(user\.id, otp\)/)
  assert.match(source, /timingSafeEqual\(suppliedDigest, storedDigest\)/)
  assert.match(source, /delete\(`admin_mfa_otp:\$\{user\.id\}`\)/)
  assert.doesNotMatch(source, /put\(`admin_mfa_otp:\$\{user\.id\}`, otp,/)
})

test('Admin Telegram step-up preserves the existing normal browser session', () => {
  const worker = read('auth-worker/src/telegram-login.ts')
  const callback = read('src/app/api/auth/telegram/[...path]/route.ts')
  const helper = worker.match(/async function completeTelegramIdentity\([\s\S]*?\n}\n\nexport async function handleTelegramLogin/)?.[0] ?? ''
  const adminStart = helper.indexOf("if (stored.mode === 'admin')")
  const adminEnd = helper.indexOf("await env.AUTH_DB.prepare(`\n    INSERT INTO linked_identities", adminStart)
  const adminBlock = adminStart >= 0 && adminEnd > adminStart ? helper.slice(adminStart, adminEnd) : ''

  assert.match(adminBlock, /existingIdentity\.user_id !== userId/)
  assert.match(adminBlock, /markAdminTelegramComplete/)
  assert.match(adminBlock, /admin_mfa:\s*true/)
  assert.doesNotMatch(adminBlock, /issueBrowserTokens/)
  assert.doesNotMatch(adminBlock, /refresh_token/)
  assert.match(callback, /data\.admin_mfa === true/)
  assert.match(callback, /\/admin\?telegram=verified/)
})

test('Production account OTPs are purpose-bound, protected at rest, and single-use', () => {
  const source = read('auth-worker/src/secure-otp.ts')
  const entry = read('auth-worker/src/production-entrypoint.ts')
  const email = read('auth-worker/src/production-email.ts')

  assert.match(source, /HMAC/)
  assert.match(source, /hmac-sha256:/)
  assert.match(source, /otya-otp:\$\{purpose\}:\$\{subject\}:\$\{normalized\}/)
  assert.match(source, /\^\[A-Z\]\[0-9\]\{4\}\$/)
  assert.match(source, /delete\(`otp:\$\{email\}`\)/)
  assert.match(source, /delete\(`verify_otp:\$\{user\.id\}`\)/)
  assert.match(source, /revokeRefreshTokens\(env, user\.id\)/)
  assert.match(entry, /handleSecureOtpRoute\(request, env\)/)
  assert.match(entry, /deliverRegistrationEmails\(response, env\)/)
  assert.doesNotMatch(entry, /hardenRegistrationVerification/)
  assert.match(email, /Registration owns exactly one automatic email/)
  assert.match(email, /Only the newest verification code will work/)
  assert.doesNotMatch(email, /subject: 'Welcome to Otya'/)
})

test('Otya one-time codes and public IDs use unbiased random allocation', () => {
  const crypto = read('auth-worker/src/crypto.ts')
  const db = read('auth-worker/src/db.ts')

  assert.match(crypto, /randomBelow/)
  assert.match(crypto, /randomBelow\(10_000\)/)
  assert.doesNotMatch(crypto, /%\s*10000/)

  assert.match(db, /randomBelow\(100_000_000\)/)
  assert.match(db, /`2IS\$\{randomBelow\(100_000_000\)/)
  assert.doesNotMatch(db, /\)\s*%\s*100000000/)
  assert.match(db, /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_otya_id/)
})

test('Otya public ID allocation retries collisions without exposing the internal UUID', () => {
  const db = read('auth-worker/src/db.ts')
  const account = read('src/app/account/page.tsx')

  assert.match(db, /for \(let attempt = 0; attempt < 16; attempt\+\+\)/)
  assert.match(db, /isUniqueConstraintError/)
  assert.match(account, /otya_id/)
  assert.doesNotMatch(account, /label=["']Account ID["'][^\n]*user\.id/)
})

test('Production auth responses normalize the immutable public Otya ID before writing security evidence', () => {
  const source = read('auth-worker/src/production-entrypoint.ts')
  assert.match(source, /normalizeAccountResponse/)
  assert.match(source, /SELECT otya_id FROM users WHERE id = \? LIMIT 1/)
  assert.match(source, /user: \{ \.\.\.account, otya_id: row\.otya_id \}/)
  assert.match(source, /const normalized = await normalizeAccountResponse\(response, env\)/)
  assert.match(source, /return audited\(request, normalized, env\)/)
  assert.match(source, /withAuthSecurityEvent/)
})

test('Next keeps a low-cost guest model and curated signed-in catalog', () => {
  const config = read('ai-worker/wrangler.toml')
  const chat = read('ai-worker/src/client-chat.mjs')

  assert.match(config, /AI_GUEST_MODEL = "llama-fast"/)
  assert.match(config, /AI_DEFAULT_MODEL = "otya-smart"/)

  const catalogLine = config.match(/^AI_PUBLIC_MODELS\s*=\s*"([^"]+)"$/m)
  assert.ok(catalogLine, 'AI_PUBLIC_MODELS must be present in ai-worker/wrangler.toml')
  const configuredModels = catalogLine[1].split(',').map(value => value.trim()).filter(Boolean)
  const expected = [
    'llama-fast', 'otya-smart', 'gemma-4', 'granite', 'llama-70b',
    'gpt-oss-20b', 'gpt-oss-120b', 'nemotron', 'llama-4-scout',
    'qwen3', 'sea-lion',
  ]
  for (const id of expected) assert.ok(configuredModels.includes(id), `${id} must remain in AI_PUBLIC_MODELS`)

  assert.match(chat, /if\(!signedIn\).*policy\.guest/)
  assert.match(chat, /friendly general-purpose AI assistant built into Otya/)
  assert.match(chat, /Public Next cannot see the private Admin Assistant/)
  assert.match(chat, /Online Music\/Jamendo is retired/)
})

test('Free-plan model catalog does not advertise paid-only GLM 5.3', () => {
  const config = read('ai-worker/wrangler.toml')
  const chat = read('ai-worker/src/client-chat.mjs')
  assert.doesNotMatch(config, /glm-5\.3/i)
  assert.doesNotMatch(chat, /glm-5\.3/i)
})

test('Cloudflare remains the public release and AI control plane', () => {
  const chat = read('ai-worker/src/client-chat.mjs')
  assert.match(chat, /Official website:/)
  assert.match(chat, /\/latest/)
  assert.match(chat, /Local playback, media scanning, local search and supported local transfer/)
  assert.match(chat, /must not contact a music-provider catalog while the user types/)
})

test('Online Music is retired across the canonical control plane', () => {
  const clientConfig = read('src/lib/client_config.ts')
  const appConfig = read('src/app/api/app-config/route.ts')
  const musicPage = read('src/app/music/page.tsx')

  assert.doesNotMatch(clientConfig, /'onlineMusic'/)
  assert.doesNotMatch(appConfig, /onlineMusic:\s*true/)
  assert.match(appConfig, /providerPriority:\s*\['local',\s*'help'\]/)
  assert.doesNotMatch(appConfig, /'online-music'/)
  assert.match(appConfig, /delete features\.onlineMusic/)
  assert.match(appConfig, /config = enforceProductScope\(config\)/)
  assert.match(appConfig, /ai:\s*'https:\/\/petersmartlink\.com\/ask'/)
  assert.doesNotMatch(appConfig, /action:\s*'\/myspace'/)
  assert.match(musicPage, /No (?:built-in )?online music catalog/i)
  assert.doesNotMatch(musicPage, /api\/music\/jamendo|streamUrl|<audio/i)
})

test('retired Jamendo provider routes stay physically absent', () => {
  for (const path of [
    'src/app/api/music/jamendo/route.ts',
    'src/app/api/music/jamendo/status/route.ts',
    'src/app/api/music/jamendo/download/[id]/route.ts',
    'src/app/api/music/jamendo/oauth/start/route.ts',
    'src/app/api/music/jamendo/oauth/callback/route.ts',
  ]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, `${path} must stay removed`)
  }
})

test('Telegram no longer invokes a remote music provider', () => {
  const telegram = read('src/lib/telegram-bot.mjs')
  assert.doesNotMatch(telegram, /Search OTYA music for:/)
  assert.doesNotMatch(telegram, /askNext\(`Search .*music/i)
  assert.match(telegram, /Music playback and library search are local to the Android app/)
  assert.match(telegram, /built-in Online Music catalog has been retired/)
})
