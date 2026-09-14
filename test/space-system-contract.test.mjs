import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const space = read('src/app/space/page.tsx')
const chrome = read('src/components/OtyaSpaceChrome.tsx')
const accountLayout = read('src/app/account/layout.tsx')

test('Space is the customer account home, not an owner console', () => {
  assert.match(space, /Your local Otya account space/)
  assert.match(space, /Manage account/)
  assert.match(space, /Playlist recovery/)
  assert.doesNotMatch(space, /Open Next/)
  assert.match(accountLayout, /OtyaSpaceGate/)
})

test('customer navigation has no browser owner controls', () => {
  assert.doesNotMatch(chrome, /\/api\/admin\/session/)
  assert.doesNotMatch(chrome, /petersmartlink\.com\/admin/)
  assert.doesNotMatch(chrome, /label: 'Next'/)
  assert.match(chrome, /label: 'Account overview'/)
  assert.match(chrome, /label: 'Help & Docs'/)
})

test('Space remains honest about device-first media', () => {
  assert.match(space, /Device-first in v1/)
  assert.match(space, /Media files and Private files stay on your device/)
  assert.match(space, /does not pretend local-only data is already cloud-synced/)
})
