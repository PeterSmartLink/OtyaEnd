-- Durable operational evidence and user-visible notification history.
-- This migration is additive only; it does not delete or rewrite existing data.

CREATE TABLE IF NOT EXISTS notification_events (
  id               TEXT PRIMARY KEY,
  user_id          TEXT,
  device_id        TEXT,
  event_type       TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'info',
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  data_json        TEXT,
  source           TEXT NOT NULL DEFAULT 'core',
  delivery_channel TEXT,
  delivery_status  TEXT NOT NULL DEFAULT 'created',
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_events_user_created
  ON notification_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_events_global_created
  ON notification_events(created_at DESC) WHERE user_id IS NULL;

-- Read state is stored separately so a global announcement can be read by one
-- user without becoming read for every other account.
CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  read_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user
  ON notification_reads(user_id, read_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id             TEXT PRIMARY KEY,
  user_id        TEXT,
  event_type     TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'info',
  actor_type     TEXT NOT NULL DEFAULT 'system',
  source         TEXT NOT NULL,
  correlation_id TEXT,
  ip_hash        TEXT,
  metadata_json  TEXT,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_created
  ON security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_created
  ON security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_correlation
  ON security_events(correlation_id);

CREATE TABLE IF NOT EXISTS operational_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  component      TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  status         TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'info',
  correlation_id TEXT,
  details_json   TEXT,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operational_events_component_created
  ON operational_events(component, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_events_type_created
  ON operational_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS queue_delivery_events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_name       TEXT NOT NULL,
  message_type     TEXT,
  scope            TEXT,
  sent_count       INTEGER NOT NULL DEFAULT 0,
  failed_count     INTEGER NOT NULL DEFAULT 0,
  transient_failed INTEGER NOT NULL DEFAULT 0,
  removed_count    INTEGER NOT NULL DEFAULT 0,
  total_count      INTEGER NOT NULL DEFAULT 0,
  outcome          TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_delivery_events_queue_created
  ON queue_delivery_events(queue_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_delivery_events_outcome_created
  ON queue_delivery_events(outcome, created_at DESC);
