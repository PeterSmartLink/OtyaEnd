-- OTYA New Way: optional public username for Together identity.
-- Existing OTYA IDs remain unchanged and continue to be the compatibility-safe
-- public account identifier. Username is additive and may be NULL.

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN username_changed_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_ci
  ON users(lower(username))
  WHERE username IS NOT NULL;
