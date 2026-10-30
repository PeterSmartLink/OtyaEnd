import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const guardPath = new URL('../scripts/require-remote-d1-migration-approval.mjs', import.meta.url)

test('normal deploy lifecycle never applies remote D1 migrations automatically', () => {
  assert.doesNotMatch(packageJson.scripts.predeploy, /migrations apply|--remote/)
  assert.match(packageJson.scripts['migrate:remote:apply'], /require-remote-d1-migration-approval\.mjs/)
  assert.match(packageJson.scripts['migrate:remote:apply'], /migrations apply DB --remote/)
})

test('remote migration guard fails closed without approval and exact target', () => {
  const result = spawnSync(process.execPath, [guardPath.pathname], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /remote D1 migrations require an explicit approval marker/)
})

test('guard binds approval to the reviewed Otya Server D1 identity', () => {
  const guard = readFileSync(guardPath, 'utf8')
  assert.match(guard, /otya-store-db:ab157fc6-2cbb-4d46-9789-2e4392e16aea/)
  assert.match(guard, /OTYA_ALLOW_REMOTE_D1_MIGRATIONS/)
  assert.match(guard, /OTYA_REMOTE_D1_TARGET/)
})
