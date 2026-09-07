import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const activeBrandConsumers = [
  'src/components/OtyaBrandMark.tsx',
  'src/app/otya-player/page.tsx',
  'src/app/layout.tsx',
  'auth-worker/src/resend.ts',
  'public/otya-ai.svg',
  'public/manifest.json',
  'public/otya-icon.svg',
  'public/site.webmanifest',
  'src/app/brand-overrides.css',
  'public/otya-icon-dark.svg',
  'public/otya-ai-thinking.svg',
  'public/otya-ai-thinking-light.svg',
]

test('website, admin wrappers and account email use one canonical Otya mark', () => {
  for (const path of activeBrandConsumers) {
    const source = read(path)
    assert.doesNotMatch(source, /otya-mark-current\.png/, `${path} still references the retired mark`)
    assert.match(source, /otya-app-icon\.webp/, `${path} must resolve to the canonical WebP`)
  }

  const sync = read('scripts/sync-brand-assets.mjs')
  assert.match(sync, /assets\/branding\/otya_app_icon\.webp/)
  assert.match(sync, /APPROVED_APP_COMMIT = '63be1b59f1a261c853aab786cef584a70e29989d'/)
  assert.match(sync, /EXPECTED_WIDTH = 512/)
  assert.match(sync, /EXPECTED_HEIGHT = 512/)
  assert.match(sync, /TARGET = 'public\/otya-app-icon\.webp'/)

  // The old path may appear only as a deletion target so dirty workspaces cannot
  // publish stale branding. It must never be the source or active destination.
  assert.match(sync, /RETIRED_GENERATED_TARGETS/)
  assert.match(sync, /public\/otya-mark-current\.png/)
  assert.doesNotMatch(sync, /SOURCE[^\n]*otya_mark_current\.png/)
  assert.doesNotMatch(sync, /TARGET = 'public\/otya-mark-current\.png'/)
})

test('public web manifests describe the canonical 512px WebP identity', () => {
  for (const path of ['public/manifest.json', 'public/site.webmanifest']) {
    const manifest = read(path)
    assert.match(manifest, /"name": "Otya"/)
    assert.match(manifest, /"src": "\/otya-app-icon\.webp"/)
    assert.match(manifest, /"sizes": "512x512"/)
    assert.match(manifest, /"type": "image\/webp"/)
  }
})
