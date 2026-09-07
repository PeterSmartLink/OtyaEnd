import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('organization navigation identifies PeterSmart Link while Otya uses the synced approved mark', () => {
  const nav = read('src/components/SiteNav.tsx')
  const mark = read('src/components/OtyaBrandMark.tsx')
  const sync = read('scripts/sync-brand-assets.mjs')

  assert.match(nav, /PeterSmart Link/)
  assert.match(nav, /\['Otya', '\/otya-player'\]/)
  assert.match(mark, /otya-app-icon\.webp/)
  assert.doesNotMatch(mark, /otya-mark-current\.png|otya-icon\.svg|otya-icon-dark\.svg|otya-ai\.svg/)
  assert.match(sync, /assets\/branding\/otya_app_icon\.webp/)
  assert.match(sync, /APPROVED_APP_COMMIT/)
  assert.doesNotMatch(nav, /web-app-manifest-192x192\.png/)
})

test('Music web page describes the local product and has no streaming catalog runtime', () => {
  const page = read('src/app/music/page.tsx')
  assert.match(page, /Local-first music/)
  assert.match(page, /No (?:built-in )?online music catalog/i)
  assert.match(page, /songs already on your Android device/i)
  assert.doesNotMatch(page, /api\/music\/jamendo/i)
  assert.doesNotMatch(page, /streamUrl|audioRef|<audio/i)
})

test('retired Online Music provider endpoints stay physically absent', () => {
  for (const path of [
    'src/app/api/music/jamendo/route.ts',
    'src/app/api/music/jamendo/status/route.ts',
    'src/app/api/music/jamendo/download/[id]/route.ts',
    'src/app/api/music/jamendo/oauth/start/route.ts',
    'src/app/api/music/jamendo/oauth/callback/route.ts',
  ]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, `${path} must stay removed`)
  }
})

test('legacy Online Music documentation redirects to the current local Music page', () => {
  const docs = read('src/app/docs/online-music/page.tsx')
  assert.match(docs, /permanentRedirect\('\/music'\)/)
  assert.doesNotMatch(docs, /Jamendo|streamed from the provider/i)
})
