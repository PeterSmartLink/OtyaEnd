import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const telegramSmoke = readFileSync(new URL('../.github/workflows/telegram-provider-smoke.yml', import.meta.url), 'utf8')
const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const obsoleteSecretSync = new URL('../.github/workflows/telegram-auth-secret.yml', import.meta.url)

test('Telegram Sign-In deep smoke stays manual while canonical deploy performs lightweight verification', () => {
  assert.equal(existsSync(obsoleteSecretSync), false)

  // Deep provider diagnostics are intentionally manual. Do not restore a
  // workflow_run trigger here: that fan-out multiplied Actions runs after
  // every deploy without increasing release authority.
  assert.match(telegramSmoke, /workflow_dispatch:/)
  assert.doesNotMatch(telegramSmoke, /workflow_run:/)
  assert.doesNotMatch(telegramSmoke, /workflows: \['Deploy OTYA to Cloudflare'\]/)
  assert.doesNotMatch(telegramSmoke, /workflow_run\.conclusion/)
  assert.doesNotMatch(telegramSmoke, /workflow_run\.head_branch/)

  assert.match(telegramSmoke, /Require Telegram Sign-In human security gate/)
  assert.match(telegramSmoke, /TURNSTILE_REQUIRED/)
  assert.match(telegramSmoke, /test "\$status" = "400"/)
  assert.match(telegramSmoke, /Check Telegram handoff page/)
  assert.match(telegramSmoke, /test "\$status" = "200"/)
  assert.doesNotMatch(telegramSmoke, /grep -q 'authorization_url'/)

  assert.match(deploy, /verify-production:/)
  assert.match(deploy, /Smoke-test OTYA public surfaces/)
})
