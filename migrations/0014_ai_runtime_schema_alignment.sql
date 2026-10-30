-- Align the deployed core D1 schema with the AI/support runtime contract.
-- Additive only: preserve all existing rows and identifiers.
-- This migration is versioned and must be explicitly applied; runtime requests never run DDL.
CREATE TABLE IF NOT EXISTS crash_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  user_id TEXT,
  app_version TEXT,
  version_code INTEGER,
  error_type TEXT,
  stack_trace TEXT,
  description TEXT,
  group_id TEXT,
  ai_processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_crash_created ON crash_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crash_group ON crash_reports(group_id);
CREATE INDEX IF NOT EXISTS idx_crash_device ON crash_reports(device_id);
CREATE INDEX IF NOT EXISTS idx_crash_user ON crash_reports(user_id);

ALTER TABLE feedback ADD COLUMN sentiment TEXT;
ALTER TABLE feedback ADD COLUMN ai_processed INTEGER DEFAULT 0;
ALTER TABLE ratings ADD COLUMN user_id TEXT;
ALTER TABLE bookmarks ADD COLUMN duration_ms INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN model TEXT;
ALTER TABLE devices ADD COLUMN android_version TEXT;
ALTER TABLE devices ADD COLUMN locale TEXT;
ALTER TABLE devices ADD COLUMN user_id TEXT;
ALTER TABLE user_preferences ADD COLUMN theme TEXT;
ALTER TABLE user_preferences ADD COLUMN accent_color TEXT;
ALTER TABLE eq_presets ADD COLUMN preset_name TEXT;

CREATE TABLE IF NOT EXISTS feedback_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id INTEGER NOT NULL,
  reply_text TEXT NOT NULL,
  generated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_fid ON feedback_replies(feedback_id);
