import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const signIn = read('src/app/sign-in/page.tsx')
const adminLayout = read('src/app/admin/layout.tsx')
const telegramProxy = read('src/app/api/auth/telegram/[...path]/route.ts')
const router = read('src/production-router.mjs')
const home = read('src/app/page.tsx')
const docs = read('src/app/docs/page.tsx')
const developers = read('src/app/developers/page.tsx')
const products = read('src/app/apps/page.tsx')

test('successful Otya authentication resolves owner role before opening the destination', () => {
  assert.match(signIn, /async function routeAuthenticatedSession\(\)/)
  assert.match(signIn, /const response = await adminFetch\(\)/)
  assert.match(signIn, /state\.accountAdmin === true \|\| state\.authenticated === true/)
  assert.match(signIn, /await beginOwnerVerification\(\)/)
  assert.match(signIn, /await routeAuthenticatedSession\(\)/)
})

test('Google remains a primary sign-in method and does not request the normal password after Google authentication', () => {
  const google = signIn.slice(signIn.indexOf('async function completeGoogle'), signIn.indexOf('async function startTelegram'))
  assert.match(google, /authFetch\('google'/)
  assert.match(google, /await verifySessionAndOpen\(\)/)
  assert.doesNotMatch(google, /password/)
})

test('owner factors stay on the normal sign-in journey', () => {
  assert.match(signIn, /mode === 'owner-otp'/)
  assert.match(signIn, /mode === 'owner-telegram'/)
  assert.match(signIn, /action: 'start'/)
  assert.match(signIn, /action: 'verify-otp'/)
  assert.match(signIn, /action: 'complete'/)
  assert.match(signIn, /return_to: 'sign-in'/)
  assert.match(signIn, /One account opens your Otya Space\./)
})

test('Telegram owner verification returns to the same sign-in journey safely', () => {
  assert.match(telegramProxy, /ADMIN_RETURN_COOKIE = 'otya_admin_return'/)
  assert.match(telegramProxy, /return_to.*sign-in/)
  assert.match(telegramProxy, /owner=verified/)
  assert.match(telegramProxy, /callbackAdminReturn\(request\)/)
  assert.match(telegramProxy, /new URL\(callbackAdminReturn\(request\), SPACE_URL\)/)
  assert.match(telegramProxy, /clearAdminReturn\(response\)/)
})

test('Admin is a protected Space route rather than a separate public identity surface', () => {
  assert.match(router, /pathname === '\/admin'/)
  assert.match(router, /pathname\.startsWith\('\/admin\/'\)/)
  assert.match(router, /\['admin', '\/admin'\]/)
  assert.match(adminLayout, /signInFor\(pathname\)/)
  assert.match(adminLayout, /state\.authenticated !== true/)
})

test('PeterSmart Link owns the organization hierarchy while Otya remains a product', () => {
  assert.match(home, /PeterSmart Link is the developer and publisher behind Otya Player/)
  assert.match(home, /Meet Otya from PeterSmart Link\./)
  assert.match(products, /title: 'Products \| PeterSmart Link'/)
  assert.match(developers, /title: 'Developers \| PeterSmart Link'/)
  assert.match(docs, /title: 'Documentation \| PeterSmart Link'/)
  assert.match(docs, /canonical: 'https:\/\/docs\.petersmartlink\.com'/)
})
