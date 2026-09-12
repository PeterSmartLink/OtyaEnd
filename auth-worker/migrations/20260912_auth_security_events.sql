-- Privacy-minimized identity security ledger.
-- Never store passwords, OTPs, bearer/refresh tokens, request bodies or raw IPs.
CREATE TABLE IF NOT EXISTS auth_security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_created
  ON auth_security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_security_events_user_created
  ON auth_security_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
