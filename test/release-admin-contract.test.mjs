import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/app/admin/page.tsx', import.meta.url), 'utf8')

test('Admin publishes the same immutable release identity used by the app pipeline', () => {
  assert.match(source, /tag: `v\$\{version\.trim\(\)\}\+\$\{versionCode\}`/)
  assert.match(source, /version: version\.trim\(\)/)
  assert.match(source, /version_code: versionCode/)
  assert.match(source, /Release \$\{version\.trim\(\)\}\+\$\{versionCode\} metadata published/)
  assert.doesNotMatch(source, /tag: `v\$\{version\.trim\(\)\}`,/)
})

test('Admin visible identity uses canonical Otya branding', () => {
  assert.match(source, /src="\/otya-app-icon\.webp" alt="Otya"/)
  assert.match(source, />Otya Admin<\/h1>/)
  assert.doesNotMatch(source, /src="\/android-chrome-192x192\.png" alt="OTYA"/)
})
