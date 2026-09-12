import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Next cannot broadcast on the public push queue', () => {
  const nextWrangler = read('ai-worker/wrangler.toml')
  const nextWorker = read('ai-worker/src/index.mjs')
  const coreWrangler = read('wrangler.toml')

  assert.doesNotMatch(nextWrangler, /binding\s*=\s*"PUSH_QUEUE"/)
  assert.doesNotMatch(nextWrangler, /queue\s*=\s*"otya-push"/)
  assert.doesNotMatch(nextWorker, /PUSH_QUEUE/)
  assert.doesNotMatch(nextWorker, /send_update_notification/)
  assert.doesNotMatch(nextWorker, /sendUpdateNotification/)
  assert.match(coreWrangler, /binding\s*=\s*"PUSH_QUEUE"[\s\S]*?queue\s*=\s*"otya-push"/)
})

test('Next public entrypoint rejects Telegram transport routes without owning credentials', () => {
  const scheduled = read('ai-worker/src/scheduled-entry.mjs')
  const nextWorker = read('ai-worker/src/index.mjs')
  const deploy = read('.github/workflows/deploy.yml')

  assert.match(scheduled, /url\.pathname\.startsWith\('\/api\/telegram\/'\)/)
  assert.match(scheduled, /Telegram transport is owned by Otya Core/)
  assert.doesNotMatch(nextWorker, /TELEGRAM_BOT_TOKEN/)
  assert.doesNotMatch(nextWorker, /TELEGRAM_WEBHOOK_SECRET/)
  assert.doesNotMatch(nextWorker, /api\.telegram\.org/)
  assert.match(deploy, /"TELEGRAM_BOT_TOKEN":null/)
  assert.match(deploy, /"TELEGRAM_WEBHOOK_SECRET":null/)
})

test('Core remains the sole push and Telegram transport owner', () => {
  const queue = read('src/queue-worker.mjs')
  const telegram = read('src/lib/telegram-bot.mjs')

  assert.match(queue, /batch\.queue !== 'otya-push'/)
  assert.match(queue, /PUBLIC_FCM_TOPIC = 'otya_public'/)
  assert.match(telegram, /api\.telegram\.org/)
})
