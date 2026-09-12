#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${OTYA_AUTH_DB_NAME:-otya-auth-db}"

run_sql() {
  npx wrangler d1 execute "$DB_NAME" --remote --command "$1" >/dev/null
}

columns_for() {
  npx wrangler d1 execute "$DB_NAME" --remote --json --command "PRAGMA table_info($1)" \
    | jq -r '.[0].results[]?.name'
}

has_column() {
  local table="$1"
  local column="$2"
  columns_for "$table" | grep -Fxq "$column"
}

ensure_column() {
  local table="$1"
  local column="$2"
  local definition="$3"
  if ! has_column "$table" "$column"; then
    echo "Adding missing $table.$column"
    run_sql "ALTER TABLE $table ADD COLUMN $column $definition"
  fi
}

# Create only when absent. Existing production data is preserved.
run_sql "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, otya_id TEXT, email TEXT UNIQUE, password_hash TEXT, google_id TEXT UNIQUE, name TEXT, avatar_url TEXT, is_verified INTEGER DEFAULT 0, phone_number TEXT, phone_verified_at TEXT, phone_verification_method TEXT, recovery_email TEXT, recovery_email_verified_at TEXT, country_code TEXT, locale TEXT, timezone TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"

# A production identity table without these two core columns is not safely
# repairable automatically. Fail closed rather than mutate account identity.
has_column users id || { echo 'users.id is missing; refusing destructive repair' >&2; exit 1; }
has_column users email || { echo 'users.email is missing; refusing destructive repair' >&2; exit 1; }

ensure_column users otya_id "TEXT"
ensure_column users password_hash "TEXT"
ensure_column users google_id "TEXT"
ensure_column users name "TEXT"
ensure_column users avatar_url "TEXT"
ensure_column users is_verified "INTEGER DEFAULT 0"
ensure_column users phone_number "TEXT"
ensure_column users phone_verified_at "TEXT"
ensure_column users phone_verification_method "TEXT"
ensure_column users recovery_email "TEXT"
ensure_column users recovery_email_verified_at "TEXT"
ensure_column users country_code "TEXT"
ensure_column users locale "TEXT"
ensure_column users timezone "TEXT"
ensure_column users created_at "TEXT"
ensure_column users updated_at "TEXT"

run_sql "CREATE TABLE IF NOT EXISTS user_products (user_id TEXT NOT NULL, product_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', first_seen_at TEXT DEFAULT (datetime('now')), last_seen_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (user_id, product_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
ensure_column user_products user_id "TEXT"
ensure_column user_products product_id "TEXT"
ensure_column user_products status "TEXT DEFAULT 'active'"
ensure_column user_products first_seen_at "TEXT"
ensure_column user_products last_seen_at "TEXT"

run_sql "CREATE TABLE IF NOT EXISTS linked_identities (user_id TEXT NOT NULL, provider TEXT NOT NULL, provider_subject TEXT NOT NULL, provider_username TEXT, provider_email TEXT, linked_at TEXT DEFAULT (datetime('now')), last_used_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (provider, provider_subject), UNIQUE (user_id, provider), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)"
ensure_column linked_identities user_id "TEXT"
ensure_column linked_identities provider "TEXT"
ensure_column linked_identities provider_subject "TEXT"
ensure_column linked_identities provider_username "TEXT"
ensure_column linked_identities provider_email "TEXT"
ensure_column linked_identities linked_at "TEXT"
ensure_column linked_identities last_used_at "TEXT"

# Durable identity security evidence. The ledger is deliberately narrow: it
# stores event/outcome metadata and request correlation only, never credentials,
# OTPs, request bodies or raw IP addresses.
run_sql "CREATE TABLE IF NOT EXISTS auth_security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, user_id TEXT, status TEXT NOT NULL, http_status INTEGER NOT NULL, request_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
ensure_column auth_security_events event_type "TEXT"
ensure_column auth_security_events user_id "TEXT"
ensure_column auth_security_events status "TEXT"
ensure_column auth_security_events http_status "INTEGER"
ensure_column auth_security_events request_id "TEXT"
ensure_column auth_security_events created_at "TEXT"

# Indexes are idempotent. If preserved data violates a uniqueness invariant,
# deployment fails here so the problem is visible instead of becoming a 503.
run_sql "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)"
run_sql "CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id)"
run_sql "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_otya_id ON users(otya_id) WHERE otya_id IS NOT NULL"
run_sql "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number) WHERE phone_number IS NOT NULL"
run_sql "CREATE INDEX IF NOT EXISTS idx_user_products_product ON user_products(product_id, last_seen_at DESC)"
run_sql "CREATE INDEX IF NOT EXISTS idx_linked_identities_user ON linked_identities(user_id, provider)"
run_sql "CREATE INDEX IF NOT EXISTS idx_auth_security_events_created ON auth_security_events(created_at DESC)"
run_sql "CREATE INDEX IF NOT EXISTS idx_auth_security_events_user_created ON auth_security_events(user_id, created_at DESC) WHERE user_id IS NOT NULL"

echo 'Remote OTYA auth schema is compatible.'
