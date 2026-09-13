import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PRODUCTION_KV_SOURCES,
  readBindingNamespaceId,
  syncProductionKv,
} from '../scripts/sync-production-kv.mjs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('production KV sources are valid and retain the Otya 1.0.0 baseline', () => {
  assert.deepEqual(
    PRODUCTION_KV_SOURCES.map(source => source.key),
    ['app:remote-config', 'themes:catalog'],
  )

  const appConfig = JSON.parse(read('config/app-remote-config.production.json'))
  const themes = JSON.parse(read('config/themes-catalog.production.json'))
  assert.equal(appConfig.revision, 11)
  assert.equal(appConfig.versions.minimumBuild, 0)
  assert.equal(appConfig.versions.recommendedBuild, 0)
  assert.equal(appConfig.versions.forceUpdate, false)
  assert.equal(appConfig.features.together, true)
  assert.equal(appConfig.features.togetherNearby, true)
  assert.equal(appConfig.features.togetherAnywhere, true)
  assert.ok(Array.isArray(themes.themes) && themes.themes.length > 0)
})

test('KV sync resolves the existing binding and uploads each repository source', async () => {
  const wrangler = read('wrangler.toml')
  const namespaceId = readBindingNamespaceId(wrangler)
  const calls = []

  await syncProductionKv({
    accountId: 'account-test',
    apiToken: 'token-test',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return new Response(null, { status: 200 })
    },
    log: () => {},
  })

  assert.equal(calls.length, PRODUCTION_KV_SOURCES.length)
  for (const [index, call] of calls.entries()) {
    assert.match(call.url, new RegExp(`/accounts/account-test/storage/kv/namespaces/${namespaceId}/values/`))
    assert.ok(call.url.endsWith(encodeURIComponent(PRODUCTION_KV_SOURCES[index].key)))
    assert.equal(call.init.method, 'PUT')
    assert.equal(call.init.headers.Authorization, 'Bearer token-test')
    assert.doesNotThrow(() => JSON.parse(call.init.body))
  }
})

test('core deployment publishes KV only after the Worker deploy succeeds', () => {
  const workflow = read('.github/workflows/deploy.yml')
  const deploy = workflow.indexOf('npm run deploy')
  const sync = workflow.indexOf('node scripts/sync-production-kv.mjs')
  assert.ok(deploy >= 0)
  assert.ok(sync > deploy)
})
