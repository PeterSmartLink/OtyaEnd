import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Gmail connector bounds provider latency and detail fanout', () => {
  const source = read('ai-worker/src/gmail-connector.mjs')
  assert.match(source, /PROVIDER_TIMEOUT_MS=8000/)
  assert.match(source, /AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/)
  assert.match(source, /GMAIL_DETAIL_CONCURRENCY=5/)
  assert.match(source, /Math\.min\(Number\(max\)\|\|10,20\)/)
  assert.match(source, /i\+=GMAIL_DETAIL_CONCURRENCY/)
})

test('support inbox stays inside Free Worker subrequest budget and uses migration-owned schema', () => {
  const source = read('ai-worker/src/support-email.mjs')
  const migration = read('migrations/0004_ai_support_audit.sql')
  assert.match(source, /SUPPORT_INBOX_LIMIT = 20/)
  assert.match(source, /AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/)
  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS ai_support_audit/)
  assert.doesNotMatch(source, /ensureAuditSchema/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ai_support_audit/)
})

test('support summary reads Gmail message IDs instead of mixing Resend receiving IDs', () => {
  const source = read('ai-worker/src/support-email.mjs')
  const summary = source.match(/async function handleSummary\(env,url\)[\s\S]*?async function handleAudit/)?.[0] ?? ''
  assert.ok(summary, 'support summary implementation must be present')
  assert.match(summary, /SUPPORT_SUMMARY_LIMIT/)
  assert.match(summary, /listGmailMessages/)
  assert.match(summary, /getGmailMessage/)
  assert.match(summary, /provider:'gmail'/)
  assert.doesNotMatch(summary, /emails\/receiving/)
  assert.doesNotMatch(summary, /resend\(/)
})

test('Google Drive backup provider calls are bounded and do not surface raw provider bodies', () => {
  const source = read('auth-worker/src/drive.ts')
  assert.match(source, /DRIVE_TIMEOUT_MS = 8000/)
  assert.match(source, /AbortSignal\.timeout\(DRIVE_TIMEOUT_MS\)/)
  assert.match(source, /async function driveFetch/)
  assert.doesNotMatch(source, /const err = await res\.text\(\)/)
  assert.doesNotMatch(source, /await fetch\(/)
})

test('service-account OAuth is fixed to the approved Google endpoint and sanitizes failures', () => {
  const source = read('src/lib/google_oauth.ts')
  assert.match(source, /GOOGLE_TOKEN_ORIGIN = 'https:\/\/oauth2\.googleapis\.com'/)
  assert.match(source, /parsed\.origin !== GOOGLE_TOKEN_ORIGIN/)
  assert.match(source, /parsed\.pathname !== GOOGLE_TOKEN_PATH/)
  assert.match(source, /AbortSignal\.timeout\(8000\)/)
  assert.match(source, /Google OAuth token exchange failed \(HTTP \$\{response\.status\}\)/)
  assert.doesNotMatch(source, /await response\.text\(\)/)
})
