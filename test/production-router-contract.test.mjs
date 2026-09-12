import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('production custom worker wraps the generated OpenNext handler', () => {
  const wrangler = read('wrangler.toml')
  const router = read('src/production-router.mjs')
  assert.match(wrangler, /main = "src\/production-router\.mjs"/)
  assert.match(router, /import openNextWorker from '\.\.\/\.open-next\/worker\.js'/)
  assert.match(router, /openNextWorker\.fetch\(request, env, ctx\)/)
  assert.match(router, /applyCanonicalBrowserPolicy\(await openNextWorker\.fetch/)
})

test('production HTML responses carry the canonical browser security policy', () => {
  const router = read('src/production-router.mjs')
  assert.match(router, /headers\.set\('Content-Security-Policy', CANONICAL_CSP\)/)
  assert.match(router, /headers\.set\('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'\)/)
  assert.match(router, /headers\.set\('Referrer-Policy', 'strict-origin-when-cross-origin'\)/)
  assert.match(router, /headers\.set\('Permissions-Policy', 'camera=\(\), microphone=\(\), geolocation=\(\)'\)/)
  assert.match(router, /headers\.set\('Strict-Transport-Security', 'max-age=31536000'\)/)
  assert.match(router, /headers\.set\('X-Frame-Options', 'DENY'\)/)
  assert.match(router, /headers\.set\('X-Content-Type-Options', 'nosniff'\)/)
})

test('backend-only auth, Next, owner and Telegram routes bypass Next.js', () => {
  const router = read('src/production-router.mjs')
  assert.match(router, /function isCoreBackendRoute/)
  assert.match(router, /pathname === '\/auth'/)
  assert.match(router, /pathname\.startsWith\('\/auth\/'\)/)
  assert.match(router, /pathname\.startsWith\('\/api\/ai\/'\)/)
  assert.match(router, /pathname\.startsWith\('\/api\/admin\/ai\/'\)/)
  assert.match(router, /pathname === '\/api\/admin\/release-workflow'/)
  assert.match(router, /pathname === '\/api\/telegram\/webhook'/)
  assert.match(router, /if \(isCoreBackendRoute\(url\.pathname\)\) return backendWorker\.fetch\(request, env, ctx\)/)
})

test('/api/version is resolved to canonical /latest before OpenNext routing', () => {
  const router = read('src/production-router.mjs')
  assert.match(router, /url\.pathname === '\/api\/version'/)
  assert.match(router, /url\.pathname = '\/latest'/)
  assert.match(router, /X-OTYA-Version-Alias/)
  assert.match(router, /dispatchOpenNext\(new Request\(url/)
})
