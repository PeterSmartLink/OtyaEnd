import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../migrations/0014_ai_runtime_schema_alignment.sql', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('../src/lib/d1.ts', import.meta.url), 'utf8')

 test('AI/support schema alignment is versioned and additive', () => {
  assert.match(migration, /ALTER TABLE feedback ADD COLUMN sentiment TEXT/)
  assert.match(migration, /ALTER TABLE feedback ADD COLUMN ai_processed INTEGER DEFAULT 0/)
  assert.match(migration, /ALTER TABLE ratings ADD COLUMN user_id TEXT/)
  assert.match(migration, /ALTER TABLE bookmarks ADD COLUMN duration_ms INTEGER DEFAULT 0/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS feedback_replies/)
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_feedback_replies_fid/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS crash_reports/)
  assert.match(migration, /ALTER TABLE devices ADD COLUMN model TEXT/)
  assert.match(migration, /ALTER TABLE devices ADD COLUMN android_version TEXT/)
  assert.match(migration, /ALTER TABLE devices ADD COLUMN locale TEXT/)
  assert.match(migration, /ALTER TABLE devices ADD COLUMN user_id TEXT/)
  assert.match(migration, /ALTER TABLE user_preferences ADD COLUMN theme TEXT/)
  assert.match(migration, /ALTER TABLE user_preferences ADD COLUMN accent_color TEXT/)
  assert.match(migration, /ALTER TABLE eq_presets ADD COLUMN preset_name TEXT/)
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i)
})

test('runtime D1 helpers keep legacy schema repair additive and do not delete data', () => {
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS crash_reports/)
  assert.match(runtime, /ALTER TABLE feedback ADD COLUMN sentiment TEXT/)
  assert.doesNotMatch(runtime, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i)
})
