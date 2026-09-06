import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin AI and product surfaces use one approved Otya identity', () => {
  const mark = read('src/components/OtyaBrandMark.tsx')
  const consoleUi = read('src/app/admin/ai/ConsoleClient.tsx')
  const loading = read('src/app/loading.tsx')
  const brandCss = read('src/app/brand-overrides.css')

  assert.match(mark, /ai\?: boolean/)
  assert.match(mark, /Otya assistant/)
  assert.match(mark, /src="\/otya-mark-current\.png"/)
  assert.match(mark, /thinking \? 'otya-brand-thinking' : ''/)
  assert.doesNotMatch(mark, /otya-ai-thinking\.svg|otya-ai\.svg|otya-icon\.svg|otya-icon-dark\.svg/)

  assert.match(consoleUi, /<OtyaBrandMark ai/)
  assert.match(consoleUi, /<OtyaBrandMark ai[^>]*thinking/)
  assert.match(consoleUi, /Next/)

  assert.match(loading, /<OtyaBrandMark size=\{64\}/)
  assert.match(loading, /Loading Otya Player/)
  assert.match(brandCss, /@keyframes otya-brand-thinking/)
  assert.match(brandCss, /prefers-reduced-motion: reduce/)
})

test('website metadata and visual tokens match the approved app brand', () => {
  const layout = read('src/app/layout.tsx')
  const brand = read('src/app/brand-overrides.css')
  const manifest = read('public/manifest.json')
  const secondaryManifest = read('public/site.webmanifest')
  const sync = read('scripts/sync-brand-assets.mjs')

  assert.match(layout, /const APP_VERSION = '1\.0\.0'/)
  assert.match(layout, /const OTYA_MARK = '\/otya-mark-current\.png'/)
  assert.match(layout, /import '\.\/brand-overrides\.css'/)
  assert.match(layout, /#050812/)

  for (const token of [
    '--otya-cyan: #27E8FF',
    '--otya-blue: #126BFF',
    '--otya-deep-blue: #173BFF',
    '--otya-near-black: #050812',
    '--otya-surface: #0A1020',
  ]) assert.match(brand, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))

  assert.match(manifest, /otya-mark-current\.png/)
  assert.match(manifest, /#050812/)
  assert.match(secondaryManifest, /otya-mark-current\.png/)
  assert.match(secondaryManifest, /#050812/)

  assert.match(sync, /OtyaPlayer\/\$\{APPROVED_APP_COMMIT\}\/assets\/branding\/otya_mark_current\.png/)
  assert.match(sync, /49348d06f1bb2d6e59ddcb186f9be5e06f86475d/)
  assert.doesNotMatch(brand, /--otya-red:|--otya-yellow:|--otya-blue: #2979FF/i)
})
