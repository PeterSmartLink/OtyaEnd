import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const space = readFileSync(new URL('../src/app/space/page.tsx', import.meta.url), 'utf8')
const gate = readFileSync(new URL('../src/components/OtyaSpaceGate.tsx', import.meta.url), 'utf8')
const chrome = readFileSync(new URL('../src/components/OtyaSpaceChrome.tsx', import.meta.url), 'utf8')
const accountLayout = readFileSync(new URL('../src/app/account/layout.tsx', import.meta.url), 'utf8')
const signInMethods = readFileSync(new URL('../src/app/account/sign-in-methods/page.tsx', import.meta.url), 'utf8')

test('Space is the signed-in customer account home, not an owner console', () => {
  assert.ok(space.includes('Your local Otya account space'))
  assert.ok(space.includes('Manage account'))
  assert.ok(!space.includes('Open Next'))
  assert.ok(space.includes('Playlist recovery'))
  assert.ok(accountLayout.includes('OtyaSpaceGate'))
})

test('normal Space access never forces an administrator into admin mode', () => {
  assert.ok(gate.includes("fetch('/api/account-session/session'"))
  assert.ok(!gate.includes("window.location.replace('/admin')"))
  assert.ok(!accountLayout.includes("window.location.replace('/admin')"))
  assert.ok(chrome.includes("fallback: 'https://petersmartlink.com/admin'"))
  assert.ok(chrome.includes('admin.accountAdmin === true || admin.authenticated === true'))
})

test('Space navigation exposes real sections and canonical subdomains', () => {
  assert.ok(chrome.includes("label: 'Space home', section: 'overview', fallback: '/'"))
  assert.ok(chrome.includes("label: 'Sign-in methods', section: 'providers', fallback: '/account/sign-in-methods/'"))
  assert.ok(chrome.includes("label: 'Next', section: 'next', fallback: '/ask'"))
  assert.ok(chrome.includes("label: 'Telegram community', fallback: 'https://t.me/otyaplayer'"))
  assert.ok(chrome.includes('https://docs.petersmartlink.com'))
  assert.ok(chrome.includes('consoleHref(publicId, item.section, item.fallback)'))
})

test('Space does not claim unsupported media cloud synchronization', () => {
  assert.ok(space.includes('Favorites'))
  assert.ok(space.includes('Device-first in v1'))
  assert.ok(space.includes('Media files and Private files stay on your device'))
  assert.ok(space.includes('does not pretend local-only data is already cloud-synced'))
})

test('connected sign-in methods remain one identity inside Space', () => {
  assert.ok(signInMethods.includes('Telegram, Google and email can all belong to one OTYA ID'))
  assert.ok(signInMethods.includes("accountFetch('google/link'"))
  assert.ok(signInMethods.includes("accountFetch('account', { method: 'PATCH'"))
})
