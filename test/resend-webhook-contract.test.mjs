import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const route = read('src/app/webhooks/route.ts')
const config = read('wrangler.toml')
const deploy = read('.github/workflows/deploy.yml')
const migration = read('migrations/0006_resend_webhook_events.sql')

test('Resend webhook verifies the exact raw Svix message before JSON parsing', () => {
  assert.match(route, /req\.headers\.get\('svix-id'\)/)
  assert.match(route, /req\.headers\.get\('svix-timestamp'\)/)
  assert.match(route, /req\.headers\.get\('svix-signature'\)/)
  assert.match(route, /SIGNATURE_TOLERANCE_SECONDS = 5 \* 60/)
  assert.match(route, /const rawBody = await req\.text\(\)/)
  assert.match(route, /`\$\{svixId\}\.\$\{svixTimestamp\}\.\$\{rawBody\}`/)
  assert.match(route, /HMAC', hash: 'SHA-256'/)
  assert.ok(route.indexOf('const rawBody = await req.text()') < route.indexOf('JSON.parse(rawBody)'))
})

test('Resend signing secret stays out of source and is resolved server-side', () => {
  assert.match(config, /RESEND_WEBHOOK_ID = "ed1c9372-22ec-4f85-931d-14826a07b3cb"/)
  assert.doesNotMatch(config, /RESEND_WEBHOOK_SECRET|whsec_/)
  assert.doesNotMatch(route, /whsec_[A-Za-z0-9+/=_-]{10,}/)
  assert.match(route, /env\.RESEND_API_KEY/)
  assert.match(route, /env\.RESEND_WEBHOOK_ID/)
  assert.match(route, /https:\/\/api\.resend\.com\/webhooks\//)
  assert.match(route, /Authorization: `Bearer \$\{apiKey\}`/)
  assert.match(route, /AbortSignal\.timeout\(RESEND_API_TIMEOUT_MS\)/)
  assert.match(route, /WEBHOOK_SECRET_CACHE_MS = 5 \* 60 \* 1000/)
  assert.match(route, /Date\.now\(\) < secretExpiresAt/)
  assert.match(route, /secretExpiresAt = Date\.now\(\) \+ WEBHOOK_SECRET_CACHE_MS/)
  assert.match(route, /secretExpiresAt = 0/)
})

test('Resend webhook delivery handling is idempotent and privacy-minimal', () => {
  assert.match(route, /OPERATIONAL_EVENTS = new Set/)
  for (const event of [
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.complained',
    'email.bounced',
    'email.failed',
    'email.suppressed',
  ]) assert.match(route, new RegExp(event.replace('.', '\\.')))
  assert.doesNotMatch(route, /'email\.opened'|'email\.clicked'/)
  assert.match(route, /INSERT OR IGNORE INTO resend_webhook_events/)
  assert.match(migration, /svix_id TEXT PRIMARY KEY/)
  assert.match(migration, /event_type TEXT NOT NULL/)
  assert.match(migration, /email_id TEXT/)
  assert.match(migration, /message_id TEXT/)
  assert.doesNotMatch(migration, /recipient|subject|body|payload|attachment/i)
  assert.doesNotMatch(route, /JSON\.stringify\(event\)|JSON\.stringify\(event\.data\)/)
})

test('future explicit core deploys provision the existing Resend API key without weakening deploy authority', () => {
  assert.match(deploy, /deploy-core:/)
  assert.match(deploy, /RESEND_API_KEY: \$\{\{ secrets\.RESEND_API_KEY \}\}/)
  assert.match(deploy, /wrangler secret put RESEND_API_KEY/)
  assert.match(deploy, /check https:\/\/petersmartlink\.com\/webhooks\/ '\^405\$'/)
  assert.match(deploy, /github\.event_name == 'workflow_dispatch'/)
  assert.match(deploy, /github\.ref == 'refs\/heads\/main'/)
  assert.match(deploy, /CONFIRM.*DEPLOY|test "\$CONFIRM" = 'DEPLOY'/s)
})
