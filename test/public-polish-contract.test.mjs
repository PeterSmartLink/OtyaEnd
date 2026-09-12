import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('public Status uses canonical Otya naming and exposes only safe public meaning', () => {
  const status = read('src/app/status/page.tsx')

  assert.match(status, /title: 'Otya Status'/)
  assert.match(status, /Otya service information\./)
  assert.match(status, /Live service monitoring is not displayed/)
  assert.match(status, /Local playback/)
  assert.doesNotMatch(status, /OTYA/)
  assert.doesNotMatch(status, /music-provider/i)
  assert.doesNotMatch(status, /D1|KV namespace|R2 bucket|Worker binding|Cloudflare account/i)
})

test('public Help teaches the current one-account and verification flow', () => {
  const help = read('src/app/help/page.tsx')

  assert.match(help, /title: 'Help \| Otya Player'/)
  assert.match(help, /Email, Google and Telegram are sign-in methods for the same Otya account/)
  assert.match(help, /Registration sends one verification code automatically/)
  assert.match(help, /request a new code only if you still need one/)
  assert.match(help, /Ordinary product or marketing notification permission is separate from starting local playback/)
  assert.match(help, /Otya Account/)
  assert.match(help, /Contact Otya/)
  assert.doesNotMatch(help, /use Resend only/i)
  assert.doesNotMatch(help, /Telegram sign-in is not shown until/i)
  assert.doesNotMatch(help, /OTYA/)
})
