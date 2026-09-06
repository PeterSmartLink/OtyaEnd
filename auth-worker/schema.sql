-- OTYA shared identity schema
-- One user identity is shared across OTYA products. Product-specific data stays
-- in each product service and is keyed by users.id.

CREATE TABLE IF NOT EXISTS users (
  id                         TEXT PRIMARY KEY,
  otya_id                    TEXT,
  username                   TEXT,
  username_changed_at        TEXT,
  email                      TEXT UNIQUE,
  password_hash              TEXT,
  google_id                  TEXT UNIQUE,
  name                       TEXT,
  avatar_url                 TEXT,
  is_verified                INTEGER DEFAULT 0,
  phone_number               TEXT,
  phone_verified_at          TEXT,
  phone_verification_method  TEXT,
  recovery_email             TEXT,
  recovery_email_verified_at TEXT,
  country_code               TEXT,
  locale                     TEXT,
  timezone                   TEXT,
  created_at                 TEXT DEFAULT (datetime('now')),
  updated_at                 TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_otya_id ON users(otya_id) WHERE otya_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_ci ON users(lower(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number) WHERE phone_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_products (
  user_id       TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_products_product
  ON user_products(product_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS linked_identities (
  user_id            TEXT NOT NULL,
  provider           TEXT NOT NULL,
  provider_subject   TEXT NOT NULL,
  provider_username  TEXT,
  provider_email     TEXT,
  linked_at          TEXT DEFAULT (datetime('now')),
  last_used_at       TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_subject),
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_linked_identities_user ON linked_identities(user_id, provider);
