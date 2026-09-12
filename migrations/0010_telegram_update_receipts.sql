-- Atomic Telegram webhook deduplication ledger.
-- Telegram may deliver the same update concurrently or retry it. D1's primary
-- key + INSERT OR IGNORE provides a single claim boundary that KV GET/PUT
-- cannot provide atomically.
CREATE TABLE IF NOT EXISTS telegram_update_receipts (
  update_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'done', 'failed')),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_telegram_update_receipts_status_received
  ON telegram_update_receipts(status, received_at);
