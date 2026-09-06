import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Turnstile verification stays server-side and fail-closed', () => {
  const helper = read('src/lib/turnstile.ts')
  const publicConfig = read('src/app/api/security/turnstile/config/route.ts')

  assert.match(helper, /TURNSTILE_SECRET_KEY/)
  assert.match(helper, /TURNSTILE_SITE_KEY/)
  assert.match(helper, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/)
  assert.match(helper, /CF-Connecting-IP/)
  assert.match(helper, /TURNSTILE_REQUIRED/)
  assert.match(helper, /TURNSTILE_UNAVAILABLE/)
  assert.match(helper, /TURNSTILE_INVALID/)

  assert.match(publicConfig, /getTurnstilePublicConfig/)
  assert.doesNotMatch(publicConfig, /TURNSTILE_SECRET_KEY/)
})

test('public browser authentication is protected without changing authenticated account actions', () => {
  const accountProxy = read('src/app/api/account-session/[...path]/route.ts')

  for (const route of ['login', 'register', 'google', 'forgot-password', 'reset-password']) {
    assert.match(accountProxy, new RegExp(`['\"]${route}['\"]`), `${route} must stay Turnstile protected`)
  }
  assert.match(accountProxy, /verifyTurnstileToken\(body\.turnstile_token, request\)/)
  assert.match(accountProxy, /delete body\.turnstile_token/)
  assert.doesNotMatch(accountProxy, /TURNSTILE_PROTECTED_AUTH[\s\S]{0,300}verify-email/)
  assert.doesNotMatch(accountProxy, /TURNSTILE_PROTECTED_AUTH[\s\S]{0,300}account/)
})

test('sign-in UI supplies fresh Turnstile proof to every public provider path', () => {
  const signIn = read('src/app/sign-in/page.tsx')
  const challenge = read('src/components/TurnstileChallenge.tsx')
  const telegramProxy = read('src/app/api/auth/telegram/[...path]/route.ts')

  assert.match(signIn, /TurnstileChallenge/)
  assert.match(signIn, /turnstile_token: securityToken/)
  assert.match(signIn, /X-Otya-Turnstile/)
  assert.match(signIn, /Complete the Cloudflare security check/)
  assert.match(signIn, /resetSecurityChallenge/)

  assert.match(challenge, /api\/security\/turnstile\/config/)
  assert.match(challenge, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/)
  assert.match(challenge, /Cloudflare protection/)

  assert.match(telegramProxy, /publicUrl\.searchParams\.get\('mode'\) === 'login'/)
  assert.match(telegramProxy, /verifyTurnstileToken\(request\.headers\.get\('X-Otya-Turnstile'\), request\)/)
  assert.match(telegramProxy, /headers\.delete\('X-Otya-Turnstile'\)/)
})

test('website brand tokens match the approved Otya cyan and blue identity', () => {
  const css = read('src/app/brand-overrides.css')

  for (const color of ['#27E8FF', '#126BFF', '#173BFF', '#050812', '#0A1020', '#10182A', '#213454', '#F7FAFF']) {
    assert.match(css, new RegExp(color.replace('#', '\\#'), 'i'), `${color} must remain in the canonical website palette`)
  }
  assert.match(css, /linear-gradient\(100deg, var\(--otya-cyan\), var\(--otya-blue\) 58%, var\(--otya-deep-blue\)\)/)
  assert.doesNotMatch(css, /--otya-red:/)
  assert.doesNotMatch(css, /--otya-yellow:/)
  assert.doesNotMatch(css, /#2979FF/i)
  assert.doesNotMatch(css, /#FFD60A/i)
})

test('website, install surfaces and build pipeline use one Otya mark and name', () => {
  const component = read('src/components/OtyaBrandMark.tsx')
  const sync = read('scripts/sync-brand-assets.mjs')
  const manifest = JSON.parse(read('public/manifest.json'))
  const brandReadme = read('public/brand/README.md')
  const layout = read('src/app/layout.tsx')

  assert.match(component, /src="\/otya-mark-current\.png"/)
  assert.match(sync, /assets\/branding\/otya_mark_current\.png/)
  assert.match(sync, /public\/otya-mark-current\.png/)
  assert.equal(manifest.name, 'Otya Player')
  assert.equal(manifest.short_name, 'Otya')
  assert.match(manifest.description, /nearby Send/)
  assert.match(brandReadme, /^# Otya Brand Templates/m)
  assert.doesNotMatch(brandReadme, /^# OTYA/m)
  assert.match(layout, /Otya Player by PeterSmart Link/)
  assert.match(layout, /nearby Send/)
})
