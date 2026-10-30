-- Align the deployed core D1 schema with the AI/support runtime contract.
-- Additive only: preserve all existing rows and identifiers.
ALTER TABLE feedback ADD COLUMN sentiment TEXT;
ALTER TABLE feedback ADD COLUMN ai_processed INTEGER DEFAULT 0;
ALTER TABLE ratings ADD COLUMN user_id TEXT;
ALTER TABLE bookmarks ADD COLUMN duration_ms INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS feedback_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id INTEGER NOT NULL,
  reply_text TEXT NOT NULL,
  generated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_fid ON feedback_replies(feedback_id);
