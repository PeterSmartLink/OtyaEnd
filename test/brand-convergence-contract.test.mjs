import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin AI uses the approved Otya identity while generic loading stays quiet', () => {
  const mark = read('src/components/OtyaBrandMark.tsx')
  const consoleUi = read('src/app/admin/ai/ConsoleClient.tsx')
  const loading = read('src/app/loading.tsx')
  const brandCss = read('src/app/brand-overrides.css')

  assert.match(mark, /ai\?: boolean/)
  assert.match(mark, /Otya assistant/)
  assert.match(mark, /src="\/otya-app-icon\.webp"/)
  assert.match(mark, /thinking \? 'otya-brand-thinking' : ''/)
  assert.doesNotMatch(mark, /otya-ai-thinking\.svg|otya-ai\.svg|otya-icon\.svg|otya-icon-dark\.svg/)

  assert.match(consoleUi, /<OtyaBrandMark ai/)
  assert.match(consoleUi, /<OtyaBrandMark ai[^>]*thinking/)
  assert.match(consoleUi, /Next/)

  assert.match(loading, />Loading<\/span>/)
  assert.match(loading, /animate-pulse/)
  assert.doesNotMatch(loading, /OtyaBrandMark/)
  assert.doesNotMatch(loading, /Loading Otya Player/)
  assert.match(brandCss, /@keyframes otya-brand-thinking/)
  assert.match(brandCss, /prefers-reduced-motion: reduce/)
})

test('website metadata and visual tokens match the approved app brand', () => {
  const layout = read('src/app/layout.tsx')
  const brand = read('src/app/brand-overrides.css')
  const manifest = read('public/manifest.json')
  const secondaryManifest = read('public/site.webmanifest')
  const sync = read('scripts/sync-brand-assets.mjs')
  const download = read('src/app/download/otya-player/DownloadButtons.tsx')

  assert.doesNotMatch(layout, /const APP_VERSION =/)
  assert.doesNotMatch(layout, /softwareVersion:/)
  assert.match(layout, /const OTYA_MARK = '\/otya-app-icon\.webp'/)
  assert.match(layout, /import '\.\/brand-overrides\.css'/)
  assert.match(layout, /#050812/)

  for (const token of [
    '--otya-cyan: #27E8FF',
    '--otya-blue: #126BFF',
    '--otya-deep-blue: #173BFF',
    '--otya-near-black: #050812',
    '--otya-surface: #0A1020',
  ]) assert.match(brand, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))

  assert.match(manifest, /otya-app-icon\.webp/)
  assert.match(manifest, /#050812/)
  assert.match(secondaryManifest, /otya-app-icon\.webp/)
  assert.match(secondaryManifest, /#050812/)
  assert.match(download, /src="\/otya-app-icon\.webp"/)
  assert.doesNotMatch(download, /web-app-manifest-192x192\.png/)

  assert.match(sync, /EXPECTED_SHA256/)
  assert.doesNotMatch(sync, /fetch\(|raw\.githubusercontent\.com/)
  assert.match(sync, /63be1b59f1a261c853aab786cef584a70e29989d/)
  assert.match(sync, /EXPECTED_WIDTH = 512/)
  assert.match(sync, /EXPECTED_HEIGHT = 512/)
  assert.doesNotMatch(brand, /--otya-red:|--otya-yellow:|--otya-blue: #2979FF/i)
})
