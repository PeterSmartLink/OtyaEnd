import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')

test('production smoke checks use complete exact status patterns', () => {
  assert.match(deploy, /check https:\/\/petersmartlink\.com\/api\/security\/turnstile\/config '\^200\$'/)
  assert.match(deploy, /check https:\/\/petersmartlink\.com\/webhooks\/ '\^405\$'/)
  assert.doesNotMatch(deploy, /turnstile\/config '\^200\s+check /)
  assert.doesNotMatch(deploy, /webhooks\/ '\^405\s+check /)
})

test('Turnstile verification reads the response from its own endpoint', () => {
  assert.match(deploy, /--output \/tmp\/otya-turnstile-config\.json/)
  assert.match(deploy, /test "\$turnstile_status" = "200"/)
  assert.match(deploy, /grep -Eq '"turnstile"\[\[:space:\]\]\*:\[\[:space:\]\]\*true' \/tmp\/otya-turnstile-config\.json/)
  assert.match(deploy, /grep -Eq '"siteKey"\[\[:space:\]\]\*:\[\[:space:\]\]\*"\[\^"\]\+"' \/tmp\/otya-turnstile-config\.json/)
})

test('core trust surfaces are verified in one explicit core-only step', () => {
  assert.equal((deploy.match(/      - name: Verify core trust surfaces/g) || []).length, 1)
  assert.match(deploy, /needs\.plan-deploy\.outputs\.core == 'true'/)
  assert.match(deploy, /github\.event_name == 'workflow_dispatch'/)
  assert.match(deploy, /test "\$CONFIRM" = 'DEPLOY'/)
})
