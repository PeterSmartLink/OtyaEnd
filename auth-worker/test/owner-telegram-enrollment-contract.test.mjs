import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../src/admin-mfa.ts', import.meta.url), 'utf8')
const telegram = readFileSync(new URL('../../src/telegram-entrypoint.mjs', import.meta.url), 'utf8')

test('owner email OTP creates a short-lived single-use Telegram challenge', () => {
  assert.match(auth, /const TELEGRAM_WINDOW_TTL = 10 \* 60/)
  assert.match(auth, /const telegramChallenge = randomToken\(18\)/)
  assert.match(auth, /telegramChallengeDigest\(telegramChallenge\)/)
  assert.match(auth, /TELEGRAM_CHALLENGE_PREFIX/)
  assert.match(auth, /telegram_challenge: telegramChallenge/)
  assert.match(auth, /await env\.AUTH_KV\.delete\(`\$\{TELEGRAM_CHALLENGE_PREFIX\}\$\{pending\}`\)/)
})

test('Telegram challenge confirmation is private and bound to the linked Telegram subject', () => {
  assert.match(auth, /\/auth\/admin\/telegram-challenge\/confirm/)
  assert.match(auth, /X-OTYA-Internal-Secret/)
  assert.match(auth, /timingSafeEqual\(suppliedSecret, env\.INTERNAL_SECRET\)/)
  assert.match(auth, /provider = 'telegram' AND provider_subject = \?/)
  assert.match(auth, /linked\.user_id !== userId/)
  assert.match(auth, /markAdminTelegramComplete\(env, userId\)/)
})

test('Otya Core handles only signed private owner deep-link starts and confirms through Auth binding', () => {
  assert.match(telegram, /X-Telegram-Bot-Api-Secret-Token/)
  assert.match(telegram, /chat\?\.type !== 'private'/)
  assert.match(telegram, /owner_\(\[A-Za-z0-9_-\]\{16,80\}\)/)
  assert.match(telegram, /env\.AUTH\.fetch/)
  assert.match(telegram, /auth\/admin\/telegram-challenge\/confirm/)
  assert.match(telegram, /X-OTYA-Internal-Secret/)
  assert.match(telegram, /telegram_user_id: enrollment\.telegramUserId/)
})
