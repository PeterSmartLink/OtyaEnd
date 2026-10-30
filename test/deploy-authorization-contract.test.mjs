import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')

test('workflow changes are not excluded from push or pull-request validation', () => {
  const ignored = [...deploy.matchAll(/paths-ignore:\s*\[([^\]]+)\]/g)].map(match => match[1])
  assert.ok(ignored.length >= 2, 'expected push and pull-request path filters')
  for (const paths of ignored) {
    assert.doesNotMatch(paths, /\.github\//, 'workflow files must trigger validation')
  }
})

test('auth deployment requires a separate exact remote D1 repair approval', () => {
  assert.match(deploy, /confirm_auth_db_repair:/)
  assert.match(deploy, /REPAIR_AUTH_DB:otya-auth-db:b05595f6-260a-4720-acca-4f8b13f5c43e/)
  assert.match(deploy, /ERROR: auth deployment includes remote D1 schema repair/)
  assert.match(deploy, /grep -Fq 'database_name = "otya-auth-db"' wrangler\.toml/)
  assert.match(deploy, /grep -Fq 'database_id   = "b05595f6-260a-4720-acca-4f8b13f5c43e"' wrangler\.toml/)
})
