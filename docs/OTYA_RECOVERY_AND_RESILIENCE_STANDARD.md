# Otya Ecosystem Recovery and Resilience Standard

**Owner:** Otya Hold Ltd  
**Canonical platform:** Otya OS  
**Shared backend:** Otya End  
**Primary infrastructure:** GitHub + Cloudflare  
**Status:** Implementation standard; recovery automation remains disabled until evidence gates pass.

## Decision

Cloudflare is the primary and currently preferred runtime/data platform. Do not add Supabase, Appwrite, Vercel, or another runtime as a second writer. Resilience must first come from verified backups, tested restores, idempotent operations, durable queues, health checks, and clear service ownership—not speculative multi-cloud failover.

## Recovery layers

1. **Source and configuration:** versioned GitHub source, reviewed changes, protected production environments, least-privilege tokens and auditable deployment records.
2. **Data protection:** D1 exports/snapshots and private R2 copies only after access, retention, encryption, integrity and restore procedures are verified. A bucket's existence is not proof of a usable backup.
3. **Restore verification:** validate manifest schema, hashes, expected files, SQLite integrity, foreign keys, schema/migration version and business invariants in an isolated environment. Never print business rows or upload dumps to public artifacts.
4. **Application recovery:** deploy a reviewed, known-good Worker version only after data/schema compatibility is established. Do not automatically roll back a database migration because code rollback succeeded.
5. **Queue recovery:** preserve retry limits, idempotency, dead-letter queues and manual replay authorization. Financial operations require deduplication and reconciliation before replay.
6. **Business reconciliation:** verify sales, stock movements, payment attempts, cash/float and ledger totals before reopening money movement.

## Failover is a decision gate, not a traffic switch

The scripts/recovery/failover-gate.mjs helper is a pure readiness evaluator. It cannot route traffic, change DNS, copy data or start a second writer. A future failover controller must be separately authenticated, owner-approved, single-writer fenced, observable, reversible and tested with synthetic data. Do not implement automatic DNS failover or dual writes until RPO/RTO, data replication semantics, and payment-provider reconciliation are documented and proven.

## Required release gates

- Backup export completed and checksum recorded.
- Restore performed from the exported artifact in an isolated environment.
- SQLite integrity and foreign-key checks pass.
- Required schema and migration history are consistent.
- Business invariants pass: no orphan sale lines, no invalid stock, balanced ledger sources and idempotency constraints.
- Recovery smoke tests pass without live provider calls.
- Owner-approved rollback plan and recovery contact are available.
- Production route changes and live payment operations receive separate explicit approval.

## What is not claimed

No automatic failover is deployed. No cross-cloud replication is configured. No current RPO/RTO is guaranteed. A test with synthetic data does not prove production data can be restored. Cloudflare inventory, backup bucket presence, or a successful build alone is not backup/restore evidence.

## Operational boundaries

- Keep OtyaPoint retail/agency records in its owned D1 schema and keep Otya Auth identity data under Otya Auth ownership.
- Cross-product calls use authenticated service bindings/API contracts; products do not read one another's databases directly.
- Resend is a notification provider, not a transaction system. Email delivery failure must never reverse committed business writes.
- Never include secrets, tokens, customer rows, payment credentials, or raw financial exports in GitHub issues, logs or artifacts.
