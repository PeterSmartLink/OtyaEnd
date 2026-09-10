import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Telegram runtime self-heals the canonical webhook and exposes safe health', () => {
  const entry = read('src/telegram-entrypoint.mjs')

  assert.match(entry, /getTelegramWebhookInfo/)
  assert.match(entry, /setTelegramWebhook/)
  assert.match(entry, /TELEGRAM_WEBHOOK_URL = 'https:\/\/petersmartlink\.com\/api\/telegram\/webhook'/)
  assert.match(entry, /telegram:webhook:fingerprint:v1/)
  assert.match(entry, /\/api\/telegram\/status/)
  assert.match(entry, /webhook_configured/)
  assert.match(entry, /ai_service_bound/)
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
