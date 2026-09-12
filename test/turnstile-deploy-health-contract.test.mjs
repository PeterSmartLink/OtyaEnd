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

test('core deploy verifies public security disclosure and sanitized live status', () => {
  assert.match(deploy, /name: Verify core trust surfaces/)
  assert.match(deploy, /needs\.plan-deploy\.outputs\.core == 'true'/)
  assert.match(deploy, /https:\/\/petersmartlink\.com\/\.well-known\/security\.txt/)
  assert.match(deploy, /Contact: mailto:support@petersmartlink\.com/)
  assert.match(deploy, /https:\/\/status\.petersmartlink\.com\/api\/status/)
  assert.match(deploy, /set\(components\) != \{'website', 'accounts', 'next'\}/)
  assert.match(deploy, /public status component set changed unexpectedly/)
  assert.match(deploy, /Core public trust surfaces are healthy and privacy-bounded/)
})

test('production verification stays tied to an explicitly authorized runtime deploy', () => {
  assert.match(deploy, /github\.event_name == 'workflow_dispatch'/)
  assert.match(deploy, /needs\.authorize-deploy\.result == 'success'/)
  assert.match(deploy, /needs\.plan-deploy\.outputs\.any_runtime == 'true'/)
  assert.match(deploy, /Smoke-test OTYA public surfaces/)
})
