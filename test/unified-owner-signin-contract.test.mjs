import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const signIn = read('src/app/sign-in/page.tsx')
const adminLayout = read('src/app/admin/layout.tsx')
const router = read('src/production-router.mjs')
const home = read('src/app/page.tsx')

test('owner factors are resolved by the authenticated Otya sign-in journey', () => {
  assert.match(signIn, /async function routeAuthenticatedSession\(\)/)
  assert.match(signIn, /await beginOwnerVerification\(\)/)
  assert.match(signIn, /mode === 'owner-otp'/)
  assert.match(signIn, /mode === 'owner-telegram'/)
})

test('browser admin routes stay unavailable while their protected backend boundary remains', () => {
  assert.match(router, /pathname === '\/admin'/)
  assert.match(router, /pathname\.startsWith\('\/admin\/'\)/)
  assert.match(adminLayout, /Owner control is in Next/)
  assert.doesNotMatch(adminLayout, /ConsoleClient/)
})

test('PeterSmart Link remains the public parent brand', () => {
  assert.match(home, /PeterSmart Link is the developer and publisher behind Otya Player/)
  assert.match(home, /Meet Otya from PeterSmart Link\./)
})
