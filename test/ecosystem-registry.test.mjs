import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('ecosystem registry validates and preserves isolation and release gates', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-ecosystem-registry.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /5 products/)
  assert.match(result.stdout, /all production release gates remain closed/)
})
