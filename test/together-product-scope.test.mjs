import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const production = JSON.parse(readFileSync(
  new URL('../config/app-remote-config.production.json', import.meta.url),
  'utf8',
))
const routeSource = readFileSync(
  new URL('../src/app/api/app-config/route.ts', import.meta.url),
  'utf8',
)

test('production remote config publishes Together, Nearby and Anywhere as enabled', () => {
  assert.equal(production.revision, 11)
  assert.equal(production.features.together, true)
  assert.equal(production.features.togetherNearby, true)
  assert.equal(production.features.togetherAnywhere, true)
})

test('app-config product scope prevents another config layer from disabling Together', () => {
  assert.match(routeSource, /const CURRENT_REVISION = 11/)
  assert.match(routeSource, /together:\s*true/)
  assert.match(routeSource, /togetherNearby:\s*true/)
  assert.match(routeSource, /togetherAnywhere:\s*true/)
  assert.doesNotMatch(routeSource, /together:\s*false/)
  assert.doesNotMatch(routeSource, /togetherNearby:\s*false/)
  assert.doesNotMatch(routeSource, /togetherAnywhere:\s*false/)
})
