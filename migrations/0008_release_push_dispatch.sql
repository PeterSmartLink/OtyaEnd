-- Durable idempotency ledger for release push dispatch.
-- Release delivery code must never create production schema inside a request.
CREATE TABLE IF NOT EXISTS release_push_dispatch (
  tag TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_release_push_dispatch_status_updated
  ON release_push_dispatch(status, updated_at);
