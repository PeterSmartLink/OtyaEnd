-- Release announcement idempotency ledger.
-- Telegram does not provide a provider-side idempotency key, so the release
-- workflow reserves a tag before sending and leaves uncertain sends in
-- pending-review instead of automatically replaying them.
CREATE TABLE IF NOT EXISTS release_announcements (
  tag TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending-review', 'sent')),
  message_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_release_announcements_status
  ON release_announcements(status, created_at DESC);
