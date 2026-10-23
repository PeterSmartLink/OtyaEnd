# Cloudflare Recovery Inventory Refresh — 2026-10-23

## Scope and safety

Read-only inventory refresh for recovery planning. No customer row contents were queried; no KV values were read; no queue messages were peeked, acknowledged, retried, or deleted; no R2 object bodies were downloaded; no D1 export job was started; no resources, secrets, bindings, deployments, or traffic were changed.

Cloudflare remains the primary writer. Supabase `Otya-Recovery-Lab` remains isolated.

## D1 databases

The Cloudflare D1 API's database-list metadata reports `num_tables: 0` for both databases, which conflicts with direct read-only `sqlite_master` queries. Use the actual SQL metadata results below rather than the list endpoint's table-count field.

| Database | Tables in sqlite_master | Indexes in sqlite_master | Triggers | D1 file size |
|---|---:|---:|---:|---:|
| `otya-auth-db` | 8 | 16 | 0 | 106,496 bytes |
| `otya-store-db` | 32 | 63 | 1 | 17,182,720 bytes |

These counts include Cloudflare's internal `_cf_KV` table/index metadata. Earlier application-table inventory excludes the internal table and reports 7 Auth tables and 31 store tables. No row contents were read.

**Operational consideration:** Cloudflare D1 SQL export is an asynchronous export job and may affect availability during export. This refresh deliberately did not start exports. Schedule an export during a reviewed low-traffic window and verify the documented impact first.

## KV namespaces

Key listings were fully paginated. Only key names and counts were inspected; values were not read.

| Namespace | Keys listed |
|---|---:|
| `otya-core-kv` | 21 |
| `otya-auth-kv` | 4 |

Auth KV key names include per-user login-IP and resend-login-IP entries. Treat these as security-related metadata and protect them in any backup. Do not put key names or user identifiers into public reports.

## R2 buckets

Object metadata listing completed with no further cursor reported. Object bodies were not downloaded.

| Bucket | Objects | Total listed bytes | Oldest listed modification | Newest listed modification |
|---|---:|---:|---|---|
| `otya-assets` | 17 | 26,512 | 2026-09-01T19:29:15.295Z | 2026-09-08T09:21:58.178Z |
| `otya-player-releases` | 25 | 314,870,793 | 2026-07-23T13:07:50.970Z | 2026-09-28T20:29:51.393Z |

For a real backup, capture object keys, size, ETag/checksum where supported, HTTP/custom metadata, and the downloaded body's cryptographic checksum. R2 ETags must not automatically be assumed to be SHA-256 content hashes.

## Queues and backlog

Queue metrics are best-effort snapshots.

| Queue | Backlog count | Backlog bytes | Consumer / handling |
|---|---:|---:|---|
| `otya-next-jobs` | 0 | 0 | `otya-next`; DLQ `otya-next-jobs-dlq` |
| `otya-next-jobs-dlq` | 0 | 0 | No consumer configured |
| `otya-push` | 0 | 0 | `otya-core`; DLQ `otya-push-dlq` |
| `otya-push-dlq` | **1** | **393** | No consumer configured |
| `otya-release-events` | 0 | 0 | R2 producer exists; no consumer configured |
| `otya-release-events-dlq` | 0 | 0 | No consumer configured |

**Action needed:** investigate the single message in `otya-push-dlq` through a controlled, authorized review of the consumer's expected schema and a safe redacted message inspection. Do not purge, acknowledge, replay, or add a consumer automatically. Also decide whether release-event messages are intentionally unconsumed or whether a consumer/recovery path is missing.

Queue messages are transient state, not a conventional static database backup. Recovery design should explicitly document how to preserve or reconstruct idempotency keys, delivery state, and pending work. Never blindly replay payment-related or other side-effecting jobs.

## Recovery status after this refresh

- Confirmed: resource inventory and counts; KV key counts; R2 object listing and total listed sizes; queue configuration and a non-zero DLQ backlog.
- Not done: D1 SQL exports, encrypted backup artifacts, KV value exports, R2 object-body copies, queue payload inspection/recovery, restore into a separate Cloudflare test environment, or end-to-end application recovery.
- Still required: encrypted/checksummed backups, isolated restore, integrity reconciliation, and measured recovery-time/data-loss objectives.
