import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')

test('production deployment verifies Turnstile remains usable after Cloudflare propagation', () => {
  assert.match(deploy, /verify-production:/)
  assert.match(deploy, /https:\/\/petersmartlink\.com\/api\/security\/turnstile\/config/)
  assert.match(deploy, /"turnstile"\[\[:space:\]\]\*:\[\[:space:\]\]\*true/)
  assert.match(deploy, /Turnstile is not enabled after production deploy/)
  assert.match(deploy, /Turnstile site key is unavailable after production deploy/)
})

test('production verification stays tied to an explicitly authorized runtime deploy', () => {
  assert.match(deploy, /github\.event_name == 'workflow_dispatch'/)
  assert.match(deploy, /needs\.authorize-deploy\.result == 'success'/)
  assert.match(deploy, /needs\.plan-deploy\.outputs\.any_runtime == 'true'/)
  assert.match(deploy, /Smoke-test OTYA public surfaces/)
})
