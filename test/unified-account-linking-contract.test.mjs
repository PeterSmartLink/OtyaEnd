import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const profile = read('auth-worker/src/account-profile.ts')
const methods = read('src/app/account/sign-in-methods/page.tsx')
const layout = read('src/app/account/layout.tsx')
const chrome = read('src/components/OtyaSpaceChrome.tsx')
const account = read('src/app/account/page.tsx')
const proxy = read('src/app/api/account-session/[...path]/route.ts')

test('Telegram-first Otya identities can add a unique primary email without replacing an existing one', () => {
  assert.match(profile, /const allowed = \[\s*'email'/)
  assert.match(profile, /EMAIL_IN_USE/)
  assert.match(profile, /EMAIL_CHANGE_REQUIRES_VERIFICATION/)
  assert.match(profile, /updates\.push\('email = \?', 'is_verified = 0'\)/)
  assert.match(profile, /getUserByEmail/)
})

test('Otya Space exposes one sign-in-method manager for email Google and Telegram', () => {
  assert.match(methods, /Telegram, Google and email can all belong to one OTYA ID/)
  assert.match(methods, /accountFetch\('google\/link'/)
  assert.match(methods, /accountFetch\('account', \{ method: 'PATCH', body: JSON\.stringify\(\{ email \}\) \}\)/)
  assert.match(methods, /accountFetch\('send-verification'/)
  assert.match(methods, /accountFetch\('verify-email'/)
  assert.match(methods, /accountFetch\('telegram\/start'/)
  assert.doesNotMatch(methods, /accountFetch\('register'/)
})

test('Google linking stays a protected account action instead of a session-creating login', () => {
  assert.match(proxy, /const sessionCreatingEntry = \['login', 'register', 'google'\]\.includes\(suffix\)/)
  assert.match(proxy, /if \(options\.accessToken\) headers\.set\('Authorization', `Bearer \$\{options\.accessToken\}`\)/)
  assert.doesNotMatch(proxy, /\['login', 'register', 'google'\]\.includes\(first\)/)
})

test('account workspace makes sign-in methods discoverable without a duplicate layout nav', () => {
  assert.match(layout, /<OtyaSpaceGate>\{children\}<\/OtyaSpaceGate>/)
  assert.match(chrome, /label: 'Sign-in methods', section: 'providers', fallback: '\/account\/sign-in-methods\/'/)
  assert.match(account, /title="Sign-in methods"/)
  assert.match(account, /href=\{`\$\{base\}\/providers`\}/)
})