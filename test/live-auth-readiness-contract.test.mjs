import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Account and Google smoke is independent of Telegram credentials', () => {
  const smoke = read('.github/workflows/auth-smoke.yml')
  assert.match(smoke, /workflows: \['Deploy OTYA to Cloudflare'\]/)
  assert.doesNotMatch(smoke, /Sync Telegram Auth Credential/)
  assert.match(smoke, /Prove Account schema is available without creating a user/)
  assert.match(smoke, /Prove Google auth reaches provider verification, not schema failure/)
  assert.match(smoke, /AUTH_SCHEMA_UNAVAILABLE/)
})

test('Telegram provider verification follows canonical production deploy directly', () => {
  const smoke = read('.github/workflows/telegram-provider-smoke.yml')
  assert.match(smoke, /workflows: \['Deploy OTYA to Cloudflare'\]/)
  assert.doesNotMatch(smoke, /Sync Telegram Auth Credential/)
  assert.match(smoke, /Require Telegram Sign-In human security gate/)
  assert.match(smoke, /TURNSTILE_REQUIRED/)
  assert.match(smoke, /test "\$status" = "400"/)
  assert.match(smoke, /Check Telegram handoff page/)
  assert.match(smoke, /test "\$status" = "200"/)
  assert.doesNotMatch(smoke, /grep -q 'authorization_url'/)
})

test('production auth deployment repairs preserved D1 before deploying the Worker', () => {
  const deploy = read('.github/workflows/deploy.yml')
  const repair = read('auth-worker/scripts/repair-remote-schema.sh')
  const repairIndex = deploy.indexOf('bash scripts/repair-remote-schema.sh')
  const deployIndex = deploy.indexOf('npx wrangler deploy')
  assert.ok(repairIndex >= 0 && deployIndex > repairIndex)
  assert.match(repair, /CREATE TABLE IF NOT EXISTS users/)
  assert.match(repair, /ALTER TABLE \$table ADD COLUMN/)
  assert.match(repair, /refusing destructive repair/)
  assert.doesNotMatch(repair, /DROP TABLE|DELETE FROM users|TRUNCATE/i)
})

test('sign-in is dynamic and account provider pages explicitly disable shared caching', () => {
  const layout = read('src/app/sign-in/layout.tsx')
  const config = read('next.config.mjs')
  assert.match(layout, /dynamic = 'force-dynamic'/)
  assert.match(layout, /revalidate = 0/)
  assert.match(config, /private, no-store, no-cache, max-age=0, must-revalidate/)
  assert.match(config, /source: '\/sign-in\/:path\*'/)
  assert.match(config, /https:\/\/accounts\.google\.com/)
})
