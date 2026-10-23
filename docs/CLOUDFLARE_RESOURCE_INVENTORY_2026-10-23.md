# Cloudflare Resource Inventory — 2026-10-23

## Scope and safety

Read-only inventory of the Cloudflare account resources visible to the connected API on 2026-10-23. This records resource configuration metadata only. No database rows, KV values, R2 object contents, queue messages, secrets, or customer data were read or changed.

This is a point-in-time inventory, not a backup and not proof of recoverability. Resource counts and bindings can change after the snapshot.

## Inventory observed

| Resource type | Count | Names observed |
|---|---:|---|
| Workers | 3 | `otya-auth`, `otya-core`, `otya-next` |
| D1 databases | 2 | `otya-auth-db`, `otya-store-db` |
| KV namespaces | 2 | `otya-auth-kv`, `otya-core-kv` |
| R2 buckets | 2 | `otya-assets`, `otya-player-releases` |
| Queues | 6 | `otya-next-jobs`, `otya-next-jobs-dlq`, `otya-push`, `otya-push-dlq`, `otya-release-events`, `otya-release-events-dlq` |
| Workflows | 1 | `otya-release` |
| Durable Object namespaces returned by the API | 0 | None listed |
| Cloudflare Pages projects returned by the API | 0 | None listed |

An empty list means the API returned no resources for that endpoint during this check; it does not prove that no related capability is used indirectly or in another account.

## Queue configuration observed

| Queue | Producer | Consumer | Retry / retention notes |
|---|---|---|---|
| `otya-next-jobs` | `otya-core` | `otya-next` | Consumer max retries 3; DLQ `otya-next-jobs-dlq`; message retention 24 hours |
| `otya-push` | `otya-core` | `otya-core` | Consumer max retries 3; DLQ `otya-push-dlq`; message retention 24 hours |
| `otya-release-events` | R2 bucket `otya-player-releases` | No consumer listed | Review whether this queue is intentionally awaiting a consumer or is unfinished. DLQ `otya-release-events-dlq` has no consumer listed. |
| `otya-next-jobs-dlq` | None listed | None listed | Expected to be inspected/replayed through a controlled operator process if used |
| `otya-push-dlq` | None listed | None listed | Expected to be inspected/replayed through a controlled operator process if used |
| `otya-release-events-dlq` | None listed | None listed | Expected to be inspected/replayed through a controlled operator process if used |

Cloudflare reported 24-hour retention for the listed queues. Confirm that this retention matches business recovery requirements; do not assume a queue is a long-term backup.

## Recovery gaps still to close

1. **No backup was created by this inventory.** This was a read-only API inspection.
2. **No Supabase restore has been demonstrated.** The ecosystem-wide Supabase recovery plan remains a design until a snapshot is transformed, integrity-checked, restored into an isolated target, and validated.
3. **D1 data:** design a supported, encrypted export for each database, record migration/schema version and checksums, and test restore separately. Do not blindly copy SQLite dumps into PostgreSQL.
4. **KV:** classify keys by purpose and sensitivity. Session tokens and revocation state require a separate security-aware recovery plan; do not export them into ordinary tables or logs.
5. **R2:** inventory object counts, sizes, keys/versioning and checksums using read-only listing, then prove approved objects can be copied and restored to an independent target.
6. **Queues:** document event schemas, idempotency keys, replay rules, and what happens when a provider accepted a message but the acknowledgement was lost. Queue messages are not covered by a database backup.
7. **Identity and secrets:** record secret *references* and owners, not secret values. Plan rotation/revocation where recovery changes signing keys or session validity.
8. **External failure domain:** retain an encrypted recovery copy outside the primary Cloudflare account where practical and cost-approved.
9. **Monitoring:** add measured backup age, last restore test, queue lag, oldest pending item and dead-letter counts to a recovery dashboard.

## Next safe validation sequence

- Choose a low-risk dataset and define explicit inclusion/exclusion rules.
- Create an encrypted export with a versioned manifest and checksum.
- Restore only into a disposable, isolated Supabase target—not the retained OmniPoint project without approval.
- Run schema, row-count, referential-integrity and application-level assertions.
- Record measured recovery point and time, then repeat on a schedule.
- Expand coverage only after the first restore passes.

## Change boundary

This document does not authorize production migrations, new paid resources, secrets movement, queue changes, restores over existing data, or traffic switching. Keep Cloudflare as the only writer unless a formally approved and tested recovery incident explicitly establishes another writer and fences the primary.
