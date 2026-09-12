import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../ai-worker/src/scheduled-entry.mjs', import.meta.url), 'utf8')

test('scheduled Resend delivery has an explicit provider deadline', () => {
  assert.match(source, /PROVIDER_TIMEOUT_MS=8000/)
  assert.match(source, /signal:AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/)
})

test('daily churn signals use one grouped D1 scan and bounded deterministic scoring', () => {
  assert.match(source, /MAX_CHURN_SIGNALS=50/)
  assert.match(source, /SELECT user_id, MAX\(last_seen_at\) AS last_seen_at/)
  assert.match(source, /GROUP BY user_id/)
  assert.match(source, /LIMIT \?/)
  assert.match(source, /bind\(MAX_CHURN_SIGNALS\)/)
  assert.match(source, /function churnRisk\(days\)/)

  const churn = source.match(/async function churnSignals\(env\)[\s\S]*?\n}\n\nexport default/)?.[0] ?? ''
  assert.ok(churn, 'churnSignals implementation must be present')
  assert.doesNotMatch(churn, /env\.AI\.run/)
  assert.equal((churn.match(/env\.DB\.prepare/g) || []).length, 1)
})
