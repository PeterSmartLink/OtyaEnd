import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Telegram runtime self-heals the canonical webhook and exposes dependency readiness', () => {
  const entry = read('src/telegram-entrypoint.mjs')

  assert.match(entry, /getTelegramWebhookInfo/)
  assert.match(entry, /setTelegramWebhook/)
  assert.match(entry, /TELEGRAM_WEBHOOK_URL = 'https:\/\/petersmartlink\.com\/api\/telegram\/webhook'/)
  assert.match(entry, /telegram:webhook:fingerprint:v1/)
  assert.match(entry, /\/api\/telegram\/status/)
  assert.match(entry, /webhook_configured/)
  assert.match(entry, /ai_service_bound/)
  assert.match(entry, /ai_service_ready/)
  assert.match(entry, /AI_SUPPORT\.fetch/)
  assert.match(entry, /https:\/\/otya-next\/health/)
  assert.match(entry, /data\?\.ai === true/)
  assert.match(entry, /TELEGRAM_HEALTH_CRON = '\*\/5 \* \* \* \*'/)
  assert.match(entry, /ensureTelegramWebhook\(env\)/)
  assert.match(entry, /X-OTYA-Internal-Secret/)
  assert.match(entry, /X-OTYA-Admin-Action/)
})

test('Next owner Telegram actions use the core gateway rather than a second bot token', () => {
  const actions = read('ai-worker/src/owner-actions.mjs')

  assert.match(actions, /https:\/\/petersmartlink\.com/)
  assert.match(actions, /\/api\/admin\/telegram\/test/)
  assert.match(actions, /X-OTYA-Internal-Secret/)
  assert.match(actions, /X-OTYA-Admin-Action/)
  assert.doesNotMatch(actions, /api\.telegram\.org\/bot/)
  assert.doesNotMatch(actions, /env\.TELEGRAM_BOT_TOKEN/)
})

test('Core is the sole Telegram transport credential owner in production', () => {
  const coreConfig = read('wrangler.toml')
  const nextConfig = read('ai-worker/wrangler.toml')
  const nextEntry = read('ai-worker/src/scheduled-entry.mjs')
  const deploy = read('.github/workflows/deploy.yml')

  assert.match(coreConfig, /binding\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.match(coreConfig, /binding\s*=\s*"TELEGRAM_WEBHOOK_SECRET"/)
  assert.doesNotMatch(nextConfig, /binding\s*=\s*"TELEGRAM_BOT_TOKEN"/)
  assert.doesNotMatch(nextConfig, /binding\s*=\s*"TELEGRAM_WEBHOOK_SECRET"/)

  assert.match(nextEntry, /Telegram transport is owned by Otya Core/)
  assert.doesNotMatch(nextEntry, /handleSharedTelegram/)

  assert.doesNotMatch(deploy, /secrets\.TELEGRAM_BOT_TOKEN/)
  assert.doesNotMatch(deploy, /secrets\.TELEGRAM_WEBHOOK_SECRET/)
  assert.doesNotMatch(deploy, /wrangler secret put TELEGRAM_BOT_TOKEN/)
  assert.doesNotMatch(deploy, /wrangler secret put TELEGRAM_WEBHOOK_SECRET/)
  assert.match(deploy, /"TELEGRAM_BOT_TOKEN":null,"TELEGRAM_WEBHOOK_SECRET":null/)
})

test('Next console reports Telegram health from canonical Core, not local secrets', () => {
  const consoleTools = read('ai-worker/src/console-tools.mjs')

  assert.match(consoleTools, /OTYA_CORE_URL = 'https:\/\/petersmartlink\.com'/)
  assert.match(consoleTools, /\/api\/telegram\/status/)
  assert.match(consoleTools, /telegram\.connected \? 'connected'/)
  assert.match(consoleTools, /ai_service_ready/)
  assert.doesNotMatch(consoleTools, /env\.TELEGRAM_BOT_TOKEN/)
  assert.doesNotMatch(consoleTools, /env\.TELEGRAM_WEBHOOK_SECRET/)
})
