# Cloudflare Data Recovery Pilot — Read-Only Discovery

**Checked:** 2026-10-23  
**Status:** discovery complete; snapshot/restore not yet performed.

## Safety

All D1 queries in this discovery used SELECT against `sqlite_master` only. They did not read customer rows or modify data. R2 checks listed object metadata only; no object contents were downloaded. No backup/export job was started because Cloudflare's D1 export API can temporarily make a database unavailable while an export runs. No Supabase target was created or modified.

## D1 inventory

| Database | Tables (including internal `_cf_KV` and migration table) | Explicit indexes | Triggers |
|---|---:|---:|---:|
| `otya-auth-db` | 7 | 8 | 0 |
| `otya-store-db` | 31 | 44 | 1 |

### `otya-auth-db` tables

`_cf_KV`, `account_two_factor`, `auth_security_events`, `d1_migrations`, `linked_identities`, `user_products`, `users`.

**Sensitive recovery concern:** the schema includes `account_two_factor.encrypted_secret` and recovery hashes. Auth backups need strict encryption/access controls, and recovery must account for signing keys, session revocation and 2FA recovery semantics. Do not copy auth state into a general-purpose unprotected export.

### `otya-store-db` tables

`_cf_KV`, `ai_support_audit`, `announcements`, `blog_posts`, `bookmarks`, `bot_config`, `bot_logs`, `crash_reports`, `d1_migrations`, `devices`, `downloads`, `eq_presets`, `faq`, `feedback`, `history`, `notification_events`, `notification_reads`, `operational_events`, `owner_action_executions`, `play_history`, `playlists`, `pro_status`, `queue_delivery_events`, `ratings`, `release_announcements`, `release_push_dispatch`, `releases`, `resend_webhook_events`, `security_events`, `telegram_update_receipts`, `user_preferences`.

This database contains a mix of public product metadata, operational/audit records, user/device-linked data, queue-delivery records, and notification state. Recovery policy must classify these separately and honor retention/privacy rules. The single trigger observed is on `telegram_update_receipts`; migrations and trigger definitions must be included in restore validation.

## R2 object listing

The read-only object listing returned:

| Bucket | Objects returned in first page | Bytes represented by first page | Interpretation |
|---|---:|---:|---|
| `otya-assets` | 17 | 26,512 | First-page metadata only; total count not verified |
| `otya-player-releases` | 25 | 314,870,793 | First-page metadata only; total count not verified |

The listing response did not expose a usable truncation/cursor indicator through the current tool wrapper. These figures are therefore **not confirmed total bucket counts**. Do not treat them as a complete manifest or a backup.

## Recovery pilot decision

The first safe pilot should be a **schema-only export** or a deliberately selected low-risk dataset, with the following sequence:

1. Confirm that the selected data is low risk and has a defined owner and retention policy.
2. Choose an isolated recovery target without touching the existing OmniPoint Supabase project.
3. Confirm cost/plan implications before provisioning any target.
4. Export using the supported Cloudflare process during an approved maintenance window if the export may affect availability.
5. Encrypt the artifact before placing it in independent storage; calculate a cryptographic checksum and record schema/migration versions.
6. Transform D1/SQLite schema to the intended PostgreSQL representation explicitly; do not feed a SQLite dump directly to PostgreSQL.
7. Restore into the isolated target and run schema, constraint, count and application-level validation.
8. Record the actual RPO/RTO and cleanup only after the evidence is retained.

## What this discovery proves—and does not prove

- **Proves:** the named D1 schemas are queryable; the table/index/trigger counts above were returned; R2 object metadata can be listed.
- **Does not prove:** a complete backup exists, object listings are exhaustive, exports are encrypted, a Supabase restore works, queue messages are backed up, or failover is ready.

No production data was modified. No new paid resources, migrations, secrets movement, deployment or traffic switch occurred.
